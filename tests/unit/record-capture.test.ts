import { describe, expect, it, vi } from "vitest";
import {
  autoLabel,
  cameraName,
  captureConstraints,
  computeCrop,
  DEFAULT_CAPTURE,
  maxRecordSeconds,
  nameCameras,
  nativeTarget,
  parseCapture,
  parseCrop,
  QUALITY,
  readTech,
  resolveCapture,
  tuneTrack,
  type AutoProfile,
} from "@/lib/record/capture";
import { AUDIO_BPS, MAX_FILE_BYTES, MAX_TAKE_SECONDS } from "@/lib/record/limits";

const HD: AutoProfile = { tier: "1080p", longSide: 1920, videoBps: 7_000_000, audioBps: 128_000, facing: "environment", micId: "lav", noiseSuppression: false, echoCancellation: false, autoGainControl: false };

describe("captureConstraints", () => {
  it("nunca pede quadro em pé (que faria o navegador cortar uma faixa) e não reduz a imagem", () => {
    const c = captureConstraints(resolveCapture(DEFAULT_CAPTURE, null));
    const v = c.video as Record<string, { ideal: number }>;
    expect(v.width.ideal).toBeGreaterThan(v.height.ideal);
    expect(c.video).toMatchObject({ facingMode: "user", resizeMode: "none", frameRate: { ideal: 30 } });
  });
  it("automático usa o perfil: 1080p, câmera de trás, microfone e filtros decididos por ele", () => {
    const c = captureConstraints(resolveCapture(DEFAULT_CAPTURE, HD));
    expect(c.video).toMatchObject({ facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } });
    expect(c.audio).toEqual({ deviceId: { exact: "lav" }, noiseSuppression: false, echoCancellation: false, autoGainControl: false });
  });
  it("virar a câmera vale mesmo no automático", () => {
    const r = resolveCapture({ ...DEFAULT_CAPTURE, facing: "user" }, HD);
    expect(r.facing).toBe("user");
    expect(r.longSide).toBe(1920);
  });
  it("manual: os três filtros de áudio são separados", () => {
    const r = resolveCapture({ ...DEFAULT_CAPTURE, auto: false, quality: "alta", noiseSuppression: true, echoCancellation: false, autoGainControl: false }, HD);
    expect(r).toMatchObject({ longSide: 1920, videoBps: QUALITY.alta.videoBps, noiseSuppression: true, echoCancellation: false, autoGainControl: false });
    expect(captureConstraints(r).audio).toEqual({ noiseSuppression: true, echoCancellation: false, autoGainControl: false });
  });
  it("aparelho escolhido (manual) vence a direção", () => {
    const c = captureConstraints(resolveCapture({ ...DEFAULT_CAPTURE, auto: false, cameraId: "cam2", micId: "mic9" }, HD));
    expect(c.video).toMatchObject({ deviceId: { exact: "cam2" } });
    expect(c.video).not.toHaveProperty("facingMode");
    expect(c.audio).toMatchObject({ deviceId: { exact: "mic9" } });
  });
  it("selo do automático", () => {
    expect(autoLabel(HD)).toBe("Automático · 1080p");
  });
});

describe("computeCrop", () => {
  it("1920×1080 deitado: corte 9:16 central de 606×1080", () => {
    const c = computeCrop(1920, 1080)!;
    expect(c).toEqual({ x: 656, y: 0, w: 606, h: 1080 });
    expect(c.x * 2 + c.w).toBe(1918);
    expect(Math.abs(c.w / c.h - 9 / 16)).toBeLessThan(0.002);
  });
  it("4:3 deitado também recorta o centro", () => {
    expect(computeCrop(1440, 1080)).toEqual({ x: 416, y: 0, w: 606, h: 1080 });
  });
  it("em pé ou quadrado: sem corte", () => {
    expect(computeCrop(1080, 1920)).toBeNull();
    expect(computeCrop(1080, 1080)).toBeNull();
  });
  it("tamanho inválido: sem corte", () => {
    expect(computeCrop(0, 0)).toBeNull();
  });
});

describe("parseCrop", () => {
  it("aceita o que é válido e descarta o resto", () => {
    expect(parseCrop({ x: 656, y: 0, w: 608, h: 1080 })).toEqual({ x: 656, y: 0, w: 608, h: 1080 });
    expect(parseCrop({ x: -1, y: 0, w: 608, h: 1080 })).toBeNull();
    expect(parseCrop({ x: 0.5, y: 0, w: 608, h: 1080 })).toBeNull();
    expect(parseCrop({ x: 0, y: 0, w: 99999, h: 1080 })).toBeNull();
    expect(parseCrop("x")).toBeNull();
    expect(parseCrop(null)).toBeNull();
  });
});

describe("nativeTarget", () => {
  const caps = { width: { max: 4000 }, height: { max: 3000 } };
  it("limita o lado maior e mantém a proporção do sensor", () => {
    expect(nativeTarget(caps, 1920, false)).toEqual({ width: 1920, height: 1440 });
    expect(nativeTarget(caps, 1920, true)).toEqual({ width: 1440, height: 1920 });
  });
  it("câmera menor que o pedido: usa o máximo dela", () => {
    expect(nativeTarget({ width: { max: 1280 }, height: { max: 720 } }, 1920, false)).toEqual({ width: 1280, height: 720 });
  });
  it("sem capacidades: nada a pedir", () => {
    expect(nativeTarget({}, 1920, false)).toBeNull();
  });
});

describe("tuneTrack", () => {
  it("pede a resolução nativa, sem reduzir e com o zoom no mínimo", async () => {
    const apply = vi.fn(async () => {});
    await tuneTrack(
      { getSettings: () => ({ width: 640, height: 480 }), getCapabilities: () => ({ width: { max: 1920 }, height: { max: 1080 }, zoom: { min: 1, max: 4 } }), applyConstraints: apply },
      1920,
    );
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ width: { ideal: 1920 }, height: { ideal: 1080 }, resizeMode: "none", advanced: [{ zoom: 1 }] }));
  });
  it("se o zoom não for aceito, tenta de novo só com o tamanho", async () => {
    const apply = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue(undefined);
    await tuneTrack({ getSettings: () => ({}), getCapabilities: () => ({ width: { max: 1920 }, height: { max: 1080 }, zoom: { min: 1 } }), applyConstraints: apply }, 1920);
    expect(apply).toHaveBeenCalledTimes(2);
  });
  it("navegador sem getCapabilities (Safari antigo): não quebra", async () => {
    await expect(tuneTrack({ getSettings: () => ({}) }, 1920)).resolves.toBeUndefined();
  });
});

describe("readTech", () => {
  it("lê resolução e fps reais do track e junta o que o gravador usa", () => {
    const t = readTech({ getSettings: () => ({ width: 1920, height: 1080, frameRate: 29.97 }) }, { mime: "video/mp4;codecs=avc1,mp4a", videoBps: 7_000_000, audioBps: 128_000 });
    expect(t).toMatchObject({ width: 1920, height: 1080, fps: 30, codec: "H.264", videoBps: 7_000_000, zoom: null });
    expect(t.crop).toEqual(computeCrop(1920, 1080));
  });

  it("o quadro real do <video> vale mais que o getSettings (celular em pé que diz 1920×1080)", () => {
    const t = readTech({ getSettings: () => ({ width: 1920, height: 1080 }) }, { mime: null, videoBps: null, audioBps: null }, { width: 1080, height: 1920 });
    expect(t).toMatchObject({ width: 1080, height: 1920, crop: null });
  });

  it("quadro zerado é ignorado", () => {
    const t = readTech({ getSettings: () => ({ width: 1920, height: 1080 }) }, { mime: null, videoBps: null, audioBps: null }, { width: 0, height: 0 });
    expect(t.width).toBe(1920);
  });
});

describe("cameraName", () => {
  it("traduz os nomes do Android", () => {
    expect(cameraName("camera2 1, facing front", null).name).toBe("Frontal (selfie)");
    expect(cameraName("camera2 0, facing back", null).name).toBe("Traseira principal");
    expect(cameraName("camera2 2, facing back", null, 1).name).toBe("Traseira 2");
  });

  it("traduz os nomes do iPhone", () => {
    expect(cameraName("Back Ultra Wide Camera", null).name).toBe("Traseira grande-angular");
    expect(cameraName("Back Telephoto Camera", null).name).toBe("Traseira com zoom");
    expect(cameraName("Câmera Frontal", null).name).toBe("Frontal (selfie)");
  });

  it("sem nome, usa a direção da câmera", () => {
    expect(cameraName("", "environment").name).toBe("Traseira principal");
    expect(cameraName("", "user").name).toBe("Frontal (selfie)");
  });
});

describe("nameCameras", () => {
  it("numera as traseiras comuns na ordem", () => {
    const n = nameCameras([
      { id: "a", label: "camera2 0, facing back" },
      { id: "b", label: "camera2 1, facing front" },
      { id: "c", label: "camera2 2, facing back" },
    ]);
    expect(n.map((c) => c.name)).toEqual(["Traseira principal", "Frontal (selfie)", "Traseira 2"]);
    expect(n.every((c) => c.hint.length > 0)).toBe(true);
  });
});

describe("maxRecordSeconds", () => {
  it("720p e 1080p vão até o limite de sempre e cabem no arquivo", () => {
    for (const q of ["normal", "alta"] as const) {
      const s = maxRecordSeconds(q);
      expect(s).toBe(MAX_TAKE_SECONDS);
      expect((s * (QUALITY[q].videoBps + AUDIO_BPS)) / 8).toBeLessThanOrEqual(MAX_FILE_BYTES);
    }
  });
});

describe("parseCapture", () => {
  it("lixo vira o padrão", () => {
    expect(parseCapture(null)).toEqual(DEFAULT_CAPTURE);
    expect(parseCapture("x")).toEqual(DEFAULT_CAPTURE);
    expect(parseCapture({ quality: "ultra", facing: 3, cameraId: 5 })).toEqual(DEFAULT_CAPTURE);
  });
  it("mantém o que é válido", () => {
    const s = { auto: false, facing: "environment", cameraId: "c", micId: "m", quality: "alta", noiseSuppression: false, echoCancellation: true, autoGainControl: false };
    expect(parseCapture(s)).toEqual(s);
  });
  it("formato antigo: 'noiseReduction' desligado apaga os filtros de ruído e ganho", () => {
    expect(parseCapture({ facing: "user", noiseReduction: false })).toMatchObject({ auto: true, facing: "user", noiseSuppression: false, autoGainControl: false });
  });
});
