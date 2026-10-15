import { describe, expect, it } from "vitest";
import { captureConstraints, DEFAULT_CAPTURE, maxRecordSeconds, parseCapture, QUALITY } from "@/lib/record/capture";
import { AUDIO_BPS, MAX_FILE_BYTES, MAX_TAKE_SECONDS } from "@/lib/record/limits";

describe("captureConstraints", () => {
  it("padrão: câmera da frente em 720p, com redução de ruído", () => {
    expect(captureConstraints(DEFAULT_CAPTURE)).toEqual({
      video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 30 } },
      audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true },
    });
  });
  it("câmera de trás em Alta, sem redução de ruído", () => {
    const c = captureConstraints({ ...DEFAULT_CAPTURE, facing: "environment", quality: "alta", noiseReduction: false });
    expect(c.video).toMatchObject({ facingMode: "environment", width: { ideal: 1080 }, height: { ideal: 1920 } });
    expect(c.audio).toEqual({ noiseSuppression: false, echoCancellation: false, autoGainControl: false });
  });
  it("aparelho escolhido vence a direção", () => {
    const c = captureConstraints({ ...DEFAULT_CAPTURE, cameraId: "cam2", micId: "mic9" });
    expect(c.video).toMatchObject({ deviceId: { exact: "cam2" } });
    expect(c.video).not.toHaveProperty("facingMode");
    expect(c.audio).toMatchObject({ deviceId: { exact: "mic9" } });
  });
});

describe("maxRecordSeconds", () => {
  it("Normal mantém o limite de sempre", () => {
    expect(maxRecordSeconds("normal")).toBe(MAX_TAKE_SECONDS);
  });
  it("Alta cabe em 50 MB", () => {
    const s = maxRecordSeconds("alta");
    expect(s).toBeGreaterThan(60);
    expect(s).toBeLessThan(MAX_TAKE_SECONDS);
    expect((s * (QUALITY.alta.videoBps + AUDIO_BPS)) / 8).toBeLessThanOrEqual(MAX_FILE_BYTES);
  });
});

describe("parseCapture", () => {
  it("lixo vira o padrão", () => {
    expect(parseCapture(null)).toEqual(DEFAULT_CAPTURE);
    expect(parseCapture("x")).toEqual(DEFAULT_CAPTURE);
    expect(parseCapture({ quality: "ultra", facing: 3, cameraId: 5 })).toEqual(DEFAULT_CAPTURE);
  });
  it("mantém o que é válido", () => {
    const s = { facing: "environment", cameraId: "c", micId: "m", quality: "alta", noiseReduction: false };
    expect(parseCapture(s)).toEqual(s);
  });
});
