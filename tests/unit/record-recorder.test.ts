import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRecorder, type RecorderEnv, type RecorderOpts } from "@/components/record/recorder";
import { captureConstraints, DEFAULT_CAPTURE, maxRecordSeconds, QUALITY, resolveCapture, type AutoProfile } from "@/lib/record/capture";

class FakeMR {
  static supported = new Set(["video/webm;codecs=vp9,opus", "video/webm"]);
  static isTypeSupported = (t: string) => FakeMR.supported.has(t);
  static last: FakeMR | null = null;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  state = "inactive";
  constructor(
    public stream: unknown,
    public opts: Record<string, unknown>,
  ) {
    FakeMR.last = this;
  }
  start = vi.fn((slice: number) => {
    this.state = "recording";
    this.slice = slice;
  });
  slice = 0;
  stop = vi.fn(() => {
    this.state = "inactive";
    this.onstop?.();
  });
}

const track = { stop: vi.fn() };
const fakeStream = { getTracks: () => [track] } as unknown as MediaStream;

function makeEnv(over: Partial<RecorderEnv> = {}): RecorderEnv {
  return {
    getUserMedia: vi.fn(async () => fakeStream),
    MediaRecorder: FakeMR as unknown as RecorderEnv["MediaRecorder"],
    startRecording: vi.fn(async () => ({ id: "rec-1", path: "u/rec-1.webm" })),
    appendChunk: vi.fn(async () => {}),
    markMeta: vi.fn(async () => {}),
    ...over,
  };
}

const opts: RecorderOpts = { projectId: "p", kind: "take", blockId: null, maxSeconds: 200 };

beforeEach(() => {
  vi.useFakeTimers();
  FakeMR.last = null;
});
afterEach(() => vi.useRealTimers());

async function begin(env: RecorderEnv, o = opts) {
  const r = createRecorder(o, env);
  const p = r.start();
  await vi.advanceTimersByTimeAsync(3000);
  await p;
  return r;
}

describe("createRecorder", () => {
  it("permissão negada vira 'denied'", async () => {
    const env = makeEnv({ getUserMedia: vi.fn(async () => Promise.reject(new Error("NotAllowedError"))) });
    const r = createRecorder(opts, env);
    await r.start();
    expect(r.getSnapshot().state).toBe("denied");
  });

  it("sem MediaRecorder vira 'unsupported'", async () => {
    const r = createRecorder(opts, makeEnv({ MediaRecorder: undefined }));
    await r.start();
    expect(r.getSnapshot().state).toBe("unsupported");
  });

  it("escolhe o formato aceito e passa os bitrates", async () => {
    const env = makeEnv();
    await begin(env);
    expect(FakeMR.last!.opts).toMatchObject({
      mimeType: "video/webm;codecs=vp9,opus",
      videoBitsPerSecond: 4_000_000,
      audioBitsPerSecond: 128_000,
    });
    expect(FakeMR.last!.slice).toBe(1000);
    expect(env.getUserMedia).toHaveBeenCalledWith(captureConstraints(resolveCapture(DEFAULT_CAPTURE, null)));
  });

  it("conta 3-2-1 antes de gravar", async () => {
    const r = createRecorder(opts, makeEnv());
    const p = r.start();
    await vi.advanceTimersByTimeAsync(10);
    expect(r.getSnapshot().state).toBe("counting");
    expect(r.getSnapshot().count).toBe(3);
    await vi.advanceTimersByTimeAsync(3000);
    await p;
    expect(r.getSnapshot().state).toBe("recording");
  });

  it("guarda cada pedaço no store", async () => {
    const env = makeEnv();
    await begin(env);
    const data = new Blob(["abc"]);
    FakeMR.last!.ondataavailable!({ data });
    expect(env.appendChunk).toHaveBeenCalledWith("rec-1", data);
  });

  it("para sozinho no limite", async () => {
    const env = makeEnv();
    const r = await begin(env, { ...opts, maxSeconds: 5 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(FakeMR.last!.stop).toHaveBeenCalled();
    expect(r.getSnapshot().state).toBe("stopped");
    expect(r.getSnapshot().result).toMatchObject({ recordingId: "rec-1", durationSeconds: 5 });
  });

  it("avisa aos 180 s só no take", async () => {
    const take = await begin(makeEnv());
    await vi.advanceTimersByTimeAsync(179_000);
    expect(take.getSnapshot().warn).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(take.getSnapshot().warn).toBe(true);

    const block = await begin(makeEnv(), { ...opts, kind: "block", blockId: "b" });
    await vi.advanceTimersByTimeAsync(190_000);
    expect(block.getSnapshot().warn).toBe(false);
  });

  it("qualidade Alta: bitrate maior e limite menor", async () => {
    const env = makeEnv();
    const r = await begin(env, { ...opts, capture: { ...DEFAULT_CAPTURE, auto: false, quality: "alta" } });
    expect(FakeMR.last!.opts).toMatchObject({ videoBitsPerSecond: QUALITY.alta.videoBps });
    const max = maxRecordSeconds("alta");
    await vi.advanceTimersByTimeAsync((max - 20) * 1000);
    expect(r.getSnapshot().warn).toBe(true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(r.getSnapshot().state).toBe("stopped");
  });

  it("trocar a câmera abre de novo com as novas escolhas", async () => {
    track.stop.mockClear();
    const env = makeEnv();
    const r = createRecorder(opts, env);
    await r.open();
    await r.configure({ ...DEFAULT_CAPTURE, facing: "environment" });
    expect(track.stop).toHaveBeenCalled();
    expect(env.getUserMedia).toHaveBeenLastCalledWith(expect.objectContaining({ video: expect.objectContaining({ facingMode: "environment" }) }));
    expect(r.getSnapshot().state).toBe("ready");
  });

  it("aparelho que sumiu: tenta de novo com o padrão", async () => {
    const gum = vi.fn(async (c: MediaStreamConstraints) => {
      if (JSON.stringify(c).includes("exact")) throw new Error("OverconstrainedError");
      return fakeStream;
    });
    const r = createRecorder({ ...opts, capture: { ...DEFAULT_CAPTURE, auto: false, cameraId: "velha" } }, makeEnv({ getUserMedia: gum }));
    expect(await r.open()).toBe(true);
    expect(gum).toHaveBeenCalledTimes(2);
    expect(r.getSnapshot().state).toBe("ready");
  });

  it("não troca a câmera no meio da gravação", async () => {
    const env = makeEnv();
    const r = await begin(env);
    const calls = vi.mocked(env.getUserMedia).mock.calls.length;
    await r.configure({ ...DEFAULT_CAPTURE, facing: "environment" });
    expect(vi.mocked(env.getUserMedia).mock.calls.length).toBe(calls);
    expect(r.getSnapshot().state).toBe("recording");
  });

  it("falha ao criar a gravação volta com erro", async () => {
    const env = makeEnv({ startRecording: vi.fn(async () => ({ error: "Não foi possível agora." })) });
    const r = createRecorder(opts, env);
    const p = r.start();
    await vi.advanceTimersByTimeAsync(3000);
    await p;
    expect(r.getSnapshot()).toMatchObject({ state: "ready", error: "Não foi possível agora." });
  });

  const HD: AutoProfile = { tier: "1080p", longSide: 1920, videoBps: 7_000_000, audioBps: 128_000, facing: "environment", micId: null, noiseSuppression: true, echoCancellation: false, autoGainControl: true };
  const landscape = {
    getTracks: () => [track],
    getVideoTracks: () => [{ ...track, getSettings: () => ({ width: 1920, height: 1080, frameRate: 30 }) }],
  } as unknown as MediaStream;

  it("automático: grava a 7 Mbps com áudio a 128 kbps", async () => {
    const env = makeEnv({ getUserMedia: vi.fn(async () => landscape) });
    await begin(env, { ...opts, profile: HD });
    expect(FakeMR.last!.opts).toMatchObject({ videoBitsPerSecond: 7_000_000, audioBitsPerSecond: 128_000 });
  });

  it("quadro deitado: manda o corte 9:16 central ao criar a gravação e mostra a Info técnica real", async () => {
    const env = makeEnv({ getUserMedia: vi.fn(async () => landscape) });
    const r = await begin(env, { ...opts, profile: HD });
    expect(env.startRecording).toHaveBeenCalledWith(expect.objectContaining({ crop: { x: 656, y: 0, w: 606, h: 1080 } }));
    expect(r.getSnapshot().info).toMatchObject({ width: 1920, height: 1080, fps: 30, videoBps: 7_000_000, codec: "VP9" });
  });

  it("quadro em pé: sem corte", async () => {
    const portrait = { getTracks: () => [track], getVideoTracks: () => [{ getSettings: () => ({ width: 1080, height: 1920 }) }] } as unknown as MediaStream;
    const env = makeEnv({ getUserMedia: vi.fn(async () => portrait) });
    await begin(env, { ...opts, profile: HD });
    expect(env.startRecording).toHaveBeenCalledWith(expect.objectContaining({ crop: null }));
  });
});
