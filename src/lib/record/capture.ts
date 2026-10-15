import { AUDIO_BPS, MAX_FILE_BYTES, MAX_TAKE_SECONDS } from "./limits";

export type Quality = "normal" | "alta";

export type CaptureSettings = {
  facing: "user" | "environment";
  /** Câmera escolhida na lista; vence `facing`. */
  cameraId: string | null;
  micId: string | null;
  quality: Quality;
  /** Redução de ruído, eco e ganho automático do navegador. */
  noiseReduction: boolean;
};

export const DEFAULT_CAPTURE: CaptureSettings = { facing: "user", cameraId: null, micId: null, quality: "normal", noiseReduction: true };

export const QUALITY: Record<Quality, { width: number; height: number; videoBps: number }> = {
  normal: { width: 720, height: 1280, videoBps: 1_800_000 },
  alta: { width: 1080, height: 1920, videoBps: 4_500_000 },
};

export function captureConstraints(s: CaptureSettings): MediaStreamConstraints {
  const q = QUALITY[s.quality];
  const nr = s.noiseReduction;
  return {
    video: {
      ...(s.cameraId ? { deviceId: { exact: s.cameraId } } : { facingMode: s.facing }),
      width: { ideal: q.width },
      height: { ideal: q.height },
      frameRate: { ideal: 30 },
    },
    audio: { ...(s.micId ? { deviceId: { exact: s.micId } } : {}), noiseSuppression: nr, echoCancellation: nr, autoGainControl: nr },
  };
}

/** Segundos que cabem num arquivo do bucket (com 5% de folga), nunca acima do limite de sempre. */
export function maxRecordSeconds(quality: Quality): number {
  const bytesPerSecond = (QUALITY[quality].videoBps + AUDIO_BPS) / 8;
  return Math.min(MAX_TAKE_SECONDS, Math.floor((MAX_FILE_BYTES * 0.95) / bytesPerSecond));
}

const str = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length <= 512 ? v : null);

export function parseCapture(raw: unknown): CaptureSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_CAPTURE;
  const p = raw as Record<string, unknown>;
  return {
    facing: p.facing === "environment" ? "environment" : "user",
    cameraId: str(p.cameraId),
    micId: str(p.micId),
    quality: p.quality === "alta" ? "alta" : "normal",
    noiseReduction: p.noiseReduction !== false,
  };
}
