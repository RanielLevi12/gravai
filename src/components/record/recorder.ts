import { captureConstraints, DEFAULT_CAPTURE, maxRecordSeconds, QUALITY, type CaptureSettings } from "@/lib/record/capture";
import { AUDIO_BPS, MAX_TAKE_SECONDS, WARN_TAKE_SECONDS } from "@/lib/record/limits";
import { pickMimeType } from "@/lib/record/mime";

export type RecState = "idle" | "denied" | "unsupported" | "ready" | "counting" | "recording" | "stopped";

export type RecResult = { blob: Blob; mime: string; recordingId: string; durationSeconds: number };

export type RecSnapshot = {
  state: RecState;
  stream: MediaStream | null;
  elapsed: number;
  /** Contagem regressiva 3-2-1 (0 fora dela). */
  count: number;
  warn: boolean;
  error: string | null;
  result: RecResult | null;
};

type MediaRecorderLike = {
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  start(timeslice: number): void;
  stop(): void;
};

export type RecorderEnv = {
  getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>;
  MediaRecorder:
    | ((new (s: MediaStream, o: Record<string, unknown>) => MediaRecorderLike) & {
        isTypeSupported(t: string): boolean;
      })
    | undefined;
  startRecording: (i: {
    projectId: string;
    kind: "take" | "block";
    blockId: string | null;
    mime: string;
  }) => Promise<{ id: string; path: string } | { error: string }>;
  appendChunk: (id: string, chunk: Blob) => Promise<void>;
  markMeta: (id: string, m: { mime: string; projectId: string; kind: string; blockId: string | null }) => Promise<void>;
};

export type RecorderOpts = {
  projectId: string;
  kind: "take" | "block";
  blockId: string | null;
  maxSeconds: number;
  /** Câmera, microfone e qualidade; sem isso, o padrão. */
  capture?: CaptureSettings;
};

const INITIAL: RecSnapshot = { state: "idle", stream: null, elapsed: 0, count: 0, warn: false, error: null, result: null };

/** Gravador sem React (testável): a tela assina por `subscribe` e lê `getSnapshot`. */
export function createRecorder(opts: RecorderOpts, env: RecorderEnv) {
  let snap = INITIAL;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let recorder: MediaRecorderLike | null = null;
  let chunks: Blob[] = [];
  let dead = false;
  let settings = opts.capture ?? DEFAULT_CAPTURE;

  const set = (p: Partial<RecSnapshot>) => {
    snap = { ...snap, ...p };
    listeners.forEach((l) => l());
  };
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const releaseTracks = () => snap.stream?.getTracks().forEach((t) => t.stop());

  async function open(): Promise<boolean> {
    if (snap.stream) return true;
    if (!env.MediaRecorder) return set({ state: "unsupported" }), false;
    let stream: MediaStream;
    try {
      stream = await env.getUserMedia(captureConstraints(settings));
    } catch {
      // Câmera ou microfone escolhido sumiu (fone desligado, outro aparelho): tenta o padrão.
      if (!settings.cameraId && !settings.micId) return set({ state: "denied" }), false;
      try {
        stream = await env.getUserMedia(captureConstraints({ ...settings, cameraId: null, micId: null }));
      } catch {
        return set({ state: "denied" }), false;
      }
    }
    if (dead) return stream.getTracks().forEach((t) => t.stop()), false;
    set({ stream, state: "ready", error: null });
    return true;
  }

  /** Troca câmera, microfone ou qualidade; fora da gravação, abre a câmera de novo. */
  async function configure(next: CaptureSettings): Promise<void> {
    if (snap.state === "counting" || snap.state === "recording") return;
    settings = next;
    if (!snap.stream) return;
    releaseTracks();
    set({ stream: null, state: "idle" });
    await open();
  }

  async function start() {
    const MR = env.MediaRecorder;
    if (!MR) return set({ state: "unsupported" });
    const mime = pickMimeType((t) => MR.isTypeSupported(t));
    if (!mime) return set({ state: "unsupported" });
    if (!(await open()) || !snap.stream) return;
    set({ state: "counting", count: 3, error: null });
    for (let n = 3; n > 0; n--) {
      set({ count: n });
      await sleep(1000);
      if (dead) return;
    }
    const created = await env.startRecording({ projectId: opts.projectId, kind: opts.kind, blockId: opts.blockId, mime });
    if ("error" in created) return set({ state: "ready", count: 0, error: created.error });
    await env.markMeta(created.id, { mime, projectId: opts.projectId, kind: opts.kind, blockId: opts.blockId });

    chunks = [];
    const limit = Math.min(opts.maxSeconds, maxRecordSeconds(settings.quality));
    const warnAt = limit - (MAX_TAKE_SECONDS - WARN_TAKE_SECONDS);
    const rec = new MR(snap.stream, { mimeType: mime, videoBitsPerSecond: QUALITY[settings.quality].videoBps, audioBitsPerSecond: AUDIO_BPS });
    recorder = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size === 0) return;
      chunks.push(e.data);
      void env.appendChunk(created.id, e.data);
    };
    rec.onstop = () => {
      if (timer) clearInterval(timer);
      timer = null;
      releaseTracks();
      set({
        state: "stopped",
        stream: null,
        result: { blob: new Blob(chunks, { type: mime }), mime, recordingId: created.id, durationSeconds: snap.elapsed },
      });
    };
    rec.start(1000);
    set({ state: "recording", count: 0, elapsed: 0, warn: false });
    timer = setInterval(() => {
      const elapsed = snap.elapsed + 1;
      set({ elapsed, warn: opts.kind === "take" && elapsed >= warnAt });
      if (elapsed >= limit) stop();
    }, 1000);
  }

  function stop() {
    if (snap.state === "recording" && recorder) recorder.stop();
  }

  /** Volta à câmera pronta para uma nova gravação. */
  function reset() {
    chunks = [];
    recorder = null;
    set({ ...INITIAL, stream: snap.stream, state: snap.stream ? "ready" : "idle" });
  }

  /** Chamado ao montar a tela (o modo estrito do React monta duas vezes). */
  function revive() {
    dead = false;
  }

  function release() {
    dead = true;
    if (timer) clearInterval(timer);
    timer = null;
    releaseTracks();
    // Trilhas paradas não servem mais: a próxima montagem pede a câmera de novo.
    if (snap.stream) set({ stream: null, state: snap.state === "ready" ? "idle" : snap.state });
  }

  return {
    getSnapshot: () => snap,
    subscribe: (l: () => void) => (listeners.add(l), () => void listeners.delete(l)),
    open,
    configure,
    revive,
    start,
    stop,
    reset,
    release,
  };
}
