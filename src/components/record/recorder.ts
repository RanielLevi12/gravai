import {
  captureConstraints,
  DEFAULT_CAPTURE,
  readTech,
  resolveCapture,
  tuneTrack,
  type AutoProfile,
  type CaptureSettings,
  type Crop,
  type TechInfo,
} from "@/lib/record/capture";
import { MAX_TAKE_SECONDS, maxSecondsFor, WARN_TAKE_SECONDS } from "@/lib/record/limits";
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
  /** O que a câmera e o gravador estão usando de verdade (resolução, fps, codec, bitrate). */
  info: TechInfo | null;
};

type MediaRecorderLike = {
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
  mimeType?: string;
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
    crop: Crop | null;
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
  /** Perfil do aparelho (automático); sem ele, 720p. */
  profile?: AutoProfile | null;
};

const INITIAL: RecSnapshot = { state: "idle", stream: null, elapsed: 0, count: 0, warn: false, error: null, result: null, info: null };

/** Gravador sem React (testável): a tela assina por `subscribe` e lê `getSnapshot`. */
export function createRecorder(opts: RecorderOpts, env: RecorderEnv) {
  let snap = INITIAL;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let recorder: MediaRecorderLike | null = null;
  let chunks: Blob[] = [];
  let dead = false;
  let settings = opts.capture ?? DEFAULT_CAPTURE;
  let profile = opts.profile ?? null;
  // Tamanho do quadro que chega no <video>: vale mais que o getSettings() para o corte.
  let frame: { width: number; height: number } | null = null;

  const set = (p: Partial<RecSnapshot>) => {
    snap = { ...snap, ...p };
    listeners.forEach((l) => l());
  };
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const releaseTracks = () => snap.stream?.getTracks().forEach((t) => t.stop());
  const videoTrack = (s: MediaStream | null) => s?.getVideoTracks?.()[0];
  const resolved = () => resolveCapture(settings, profile);
  const techOf = (s: MediaStream | null, mime: string | null, rec?: MediaRecorderLike): TechInfo | null => {
    const t = videoTrack(s);
    const r = resolved();
    return t ? readTech(t, { mime, videoBps: rec?.videoBitsPerSecond ?? r.videoBps, audioBps: rec?.audioBitsPerSecond ?? r.audioBps }, frame) : null;
  };

  async function open(): Promise<boolean> {
    if (snap.stream) return true;
    if (!env.MediaRecorder) return set({ state: "unsupported" }), false;
    let stream: MediaStream;
    try {
      stream = await env.getUserMedia(captureConstraints(resolved()));
    } catch {
      // Câmera ou microfone escolhido sumiu (fone desligado, outro aparelho): tenta o padrão.
      const r = resolved();
      if (!r.cameraId && !r.micId) return set({ state: "denied" }), false;
      try {
        stream = await env.getUserMedia(captureConstraints({ ...r, cameraId: null, micId: null }));
      } catch {
        return set({ state: "denied" }), false;
      }
    }
    if (dead) return stream.getTracks().forEach((t) => t.stop()), false;
    const vt = videoTrack(stream);
    if (vt) await tuneTrack(vt as Parameters<typeof tuneTrack>[0], resolved().longSide);
    if (dead) return stream.getTracks().forEach((t) => t.stop()), false;
    set({ stream, state: "ready", error: null, info: techOf(stream, null) });
    return true;
  }

  /** Troca câmera, microfone ou qualidade; fora da gravação, abre a câmera de novo. */
  async function configure(next: CaptureSettings, nextProfile?: AutoProfile | null): Promise<void> {
    if (snap.state === "counting" || snap.state === "recording") return;
    settings = next;
    if (nextProfile !== undefined) profile = nextProfile;
    if (!snap.stream) return;
    releaseTracks();
    frame = null;
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
    const r = resolved();
    const created = await env.startRecording({
      projectId: opts.projectId,
      kind: opts.kind,
      blockId: opts.blockId,
      mime,
      crop: techOf(snap.stream, mime)?.crop ?? null,
    });
    if ("error" in created) return set({ state: "ready", count: 0, error: created.error });
    await env.markMeta(created.id, { mime, projectId: opts.projectId, kind: opts.kind, blockId: opts.blockId });

    chunks = [];
    const limit = Math.min(opts.maxSeconds, maxSecondsFor(r.videoBps, r.audioBps));
    const warnAt = limit - (MAX_TAKE_SECONDS - WARN_TAKE_SECONDS);
    const rec = new MR(snap.stream, { mimeType: mime, videoBitsPerSecond: r.videoBps, audioBitsPerSecond: r.audioBps });
    recorder = rec;
    set({ info: techOf(snap.stream, rec.mimeType || mime, rec) });
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

  /** A tela informa o tamanho real do quadro (videoWidth × videoHeight) quando ele muda. */
  function setFrame(width: number, height: number) {
    if (!(width > 0) || !(height > 0) || (frame?.width === width && frame?.height === height)) return;
    frame = { width, height };
    if (snap.state === "ready") set({ info: techOf(snap.stream, null) });
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
    setFrame,
    reset,
    release,
  };
}
