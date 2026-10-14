import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRecorder, type RecorderEnv } from "@/components/record/recorder";

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

const opts = { projectId: "p", kind: "take" as "take" | "block", blockId: null as string | null, maxSeconds: 200 };

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
      videoBitsPerSecond: 1_800_000,
      audioBitsPerSecond: 96_000,
    });
    expect(FakeMR.last!.slice).toBe(1000);
    expect(env.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ audio: true, video: expect.objectContaining({ facingMode: "user" }) }),
    );
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

  it("falha ao criar a gravação volta com erro", async () => {
    const env = makeEnv({ startRecording: vi.fn(async () => ({ error: "Não foi possível agora." })) });
    const r = createRecorder(opts, env);
    const p = r.start();
    await vi.advanceTimersByTimeAsync(3000);
    await p;
    expect(r.getSnapshot()).toMatchObject({ state: "ready", error: "Não foi possível agora." });
  });
});
