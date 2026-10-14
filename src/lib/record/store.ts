// Guarda os pedaços da gravação no aparelho (IndexedDB cru), para não perder o vídeo
// se a aba fechar ou a internet cair. Falha em silêncio se IndexedDB não existir.
const DB_NAME = "gravai-recordings";
const CHUNKS = "chunks";
const META = "meta";

type Meta = { mime: string; projectId: string; kind: string; blockId: string | null };
type MetaRow = Meta & { recordingId: string; startedAt: number };
type ChunkRow = { id?: number; recordingId: string; blob: Blob; at: number };

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined" || !indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        const chunks = db.createObjectStore(CHUNKS, { keyPath: "id", autoIncrement: true });
        chunks.createIndex("byRecording", "recordingId");
        db.createObjectStore(META, { keyPath: "recordingId" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function reqResult<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withDb<T>(fallback: T, fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await openDb();
  if (!db) return fallback;
  try {
    return await fn(db);
  } catch {
    return fallback;
  } finally {
    db.close();
  }
}

export async function appendChunk(recordingId: string, chunk: Blob): Promise<void> {
  await withDb(undefined, async (db) => {
    const tx = db.transaction(CHUNKS, "readwrite");
    tx.objectStore(CHUNKS).add({ recordingId, blob: chunk, at: Date.now() } satisfies ChunkRow);
    await done(tx);
  });
}

export async function readRecording(recordingId: string, mime: string): Promise<Blob | null> {
  return withDb<Blob | null>(null, async (db) => {
    const tx = db.transaction(CHUNKS, "readonly");
    const rows = await reqResult<ChunkRow[]>(tx.objectStore(CHUNKS).index("byRecording").getAll(recordingId));
    if (rows.length === 0) return null;
    rows.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    return new Blob(rows.map((r) => r.blob), { type: mime });
  });
}

export async function listPending(): Promise<{ recordingId: string; mime: string; startedAt: number }[]> {
  return withDb<{ recordingId: string; mime: string; startedAt: number }[]>([], async (db) => {
    const tx = db.transaction([CHUNKS, META], "readonly");
    const metas = await reqResult<MetaRow[]>(tx.objectStore(META).getAll());
    const chunks = await reqResult<ChunkRow[]>(tx.objectStore(CHUNKS).getAll());
    const out = new Map<string, { recordingId: string; mime: string; startedAt: number }>();
    for (const c of chunks) {
      const cur = out.get(c.recordingId);
      if (!cur) out.set(c.recordingId, { recordingId: c.recordingId, mime: "", startedAt: c.at });
      else if (c.at < cur.startedAt) cur.startedAt = c.at;
    }
    for (const m of metas) {
      if (out.has(m.recordingId)) out.set(m.recordingId, { recordingId: m.recordingId, mime: m.mime, startedAt: m.startedAt });
    }
    return [...out.values()].sort((a, b) => a.startedAt - b.startedAt);
  });
}

export async function markMeta(recordingId: string, meta: Meta): Promise<void> {
  await withDb(undefined, async (db) => {
    const tx = db.transaction(META, "readwrite");
    const store = tx.objectStore(META);
    const prev = await reqResult<MetaRow | undefined>(store.get(recordingId));
    store.put({ ...meta, recordingId, startedAt: prev?.startedAt ?? Date.now() } satisfies MetaRow);
    await done(tx);
  });
}

export async function clearRecording(recordingId: string): Promise<void> {
  await withDb(undefined, async (db) => {
    const tx = db.transaction([CHUNKS, META], "readwrite");
    const idx = tx.objectStore(CHUNKS).index("byRecording");
    const keys = await reqResult<IDBValidKey[]>(idx.getAllKeys(recordingId));
    for (const k of keys) tx.objectStore(CHUNKS).delete(k);
    tx.objectStore(META).delete(recordingId);
    await done(tx);
  });
}
