import { AUDIO_BPS, maxSecondsFor } from "./limits";
import { codecLabel } from "./mime";

export type Quality = "normal" | "alta";
export type Facing = "user" | "environment";

/** Retângulo de corte 9:16, em pixels do vídeo gravado. */
export type Crop = { x: number; y: number; w: number; h: number };

export type CaptureSettings = {
  /** Ligado: o app escolhe câmera, resolução, bitrate e áudio sozinho (ver autoconfig.ts). */
  auto: boolean;
  /** Frente ou trás; nulo = o automático decide. */
  facing: Facing | null;
  /** Câmera escolhida na lista (só no manual); vence `facing`. */
  cameraId: string | null;
  micId: string | null;
  quality: Quality;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
};

export const DEFAULT_CAPTURE: CaptureSettings = {
  auto: true,
  facing: null,
  cameraId: null,
  micId: null,
  quality: "normal",
  noiseSuppression: true,
  echoCancellation: false,
  autoGainControl: true,
};

/** Perfil escolhido para este aparelho (ver autoconfig.ts). */
export type AutoProfile = {
  tier: "1080p" | "720p";
  /** Lado maior pedido à câmera. */
  longSide: number;
  videoBps: number;
  audioBps: number;
  facing: Facing;
  micId: string | null;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
};

export const QUALITY: Record<Quality, { longSide: number; videoBps: number }> = {
  normal: { longSide: 1280, videoBps: 4_000_000 },
  alta: { longSide: 1920, videoBps: 7_000_000 },
};

export const FALLBACK_FACING: Facing = "user";

export const autoLabel = (p: AutoProfile) => `Automático · ${p.tier}`;

/** O que de fato vai para a câmera e o gravador, depois de juntar ajustes e perfil. */
export type Resolved = {
  facing: Facing;
  cameraId: string | null;
  micId: string | null;
  longSide: number;
  videoBps: number;
  audioBps: number;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
};

export function resolveCapture(s: CaptureSettings, profile: AutoProfile | null): Resolved {
  if (s.auto && profile) {
    return {
      facing: s.facing ?? profile.facing,
      cameraId: null,
      micId: profile.micId,
      longSide: profile.longSide,
      videoBps: profile.videoBps,
      audioBps: profile.audioBps,
      noiseSuppression: profile.noiseSuppression,
      echoCancellation: profile.echoCancellation,
      autoGainControl: profile.autoGainControl,
    };
  }
  const q = QUALITY[s.quality];
  return {
    facing: s.facing ?? FALLBACK_FACING,
    cameraId: s.auto ? null : s.cameraId,
    micId: s.auto ? null : s.micId,
    longSide: q.longSide,
    videoBps: q.videoBps,
    audioBps: AUDIO_BPS,
    noiseSuppression: s.noiseSuppression,
    echoCancellation: s.echoCancellation,
    autoGainControl: s.autoGainControl,
  };
}

/** Primeiro pedido: quadro deitado (nunca em pé, que faria o navegador cortar uma faixa) e sem reduzir. */
export function captureConstraints(r: Resolved): MediaStreamConstraints {
  return {
    video: {
      ...(r.cameraId ? { deviceId: { exact: r.cameraId } } : { facingMode: r.facing }),
      width: { ideal: r.longSide },
      height: { ideal: Math.round((r.longSide * 9) / 16) },
      frameRate: { ideal: 30 },
      resizeMode: "none",
    } as unknown as MediaTrackConstraints,
    audio: {
      ...(r.micId ? { deviceId: { exact: r.micId } } : {}),
      noiseSuppression: r.noiseSuppression,
      echoCancellation: r.echoCancellation,
      autoGainControl: r.autoGainControl,
    },
  };
}

type Range = { min?: number; max?: number };
export type TrackCaps = { width?: Range; height?: Range; frameRate?: Range; zoom?: Range };

/** Maior tamanho que a câmera entrega com o lado maior até `longSide`, mantendo a proporção do sensor. */
export function nativeTarget(caps: TrackCaps, longSide: number, portrait: boolean): { width: number; height: number } | null {
  const mw = caps.width?.max;
  const mh = caps.height?.max;
  if (!mw || !mh) return null;
  const sensorLong = Math.max(mw, mh);
  const sensorShort = Math.min(mw, mh);
  const long = Math.min(longSide, sensorLong);
  const short = Math.round((long * sensorShort) / sensorLong / 2) * 2;
  return portrait ? { width: short, height: long } : { width: long, height: short };
}

type TrackLike = Pick<MediaStreamTrack, "getSettings"> & {
  getCapabilities?: () => TrackCaps;
  applyConstraints?: (c: MediaTrackConstraints) => Promise<void>;
};

/** Pede a maior resolução nativa, sem reduzir e com o zoom no mínimo. Falha em silêncio: vale o que a câmera deu. */
export async function tuneTrack(track: TrackLike, longSide: number): Promise<void> {
  if (!track.getCapabilities || !track.applyConstraints) return;
  try {
    const caps = track.getCapabilities();
    const s = track.getSettings();
    const target = nativeTarget(caps, longSide, (s.height ?? 0) > (s.width ?? 0));
    if (!target) return;
    const base = { width: { ideal: target.width }, height: { ideal: target.height }, frameRate: { ideal: 30 }, resizeMode: "none" } as unknown as MediaTrackConstraints;
    const zoomMin = caps.zoom?.min;
    try {
      await track.applyConstraints(zoomMin === undefined ? base : ({ ...base, advanced: [{ zoom: zoomMin }] } as unknown as MediaTrackConstraints));
    } catch {
      await track.applyConstraints({ width: base.width, height: base.height });
    }
  } catch {
    /* o navegador não deixou ajustar: segue com o que veio */
  }
}

const even = (n: number) => Math.floor(n / 2) * 2;

/** Corte 9:16 central de um quadro deitado. Em pé (ou quadrado), nulo: o preview e o worker já cobrem o quadro. */
export function computeCrop(width: number, height: number): Crop | null {
  if (!(width > 0) || !(height > 0) || width <= height) return null;
  const w = even((height * 9) / 16);
  return { x: even((width - w) / 2), y: 0, w, h: even(height) };
}

const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : null);

/** Lê o corte vindo do navegador ou do banco; qualquer coisa estranha vira nulo. */
export function parseCrop(raw: unknown): Crop | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const [x, y, w, h] = [int(o.x), int(o.y), int(o.w), int(o.h)];
  if (x === null || y === null || w === null || h === null) return null;
  if (x < 0 || y < 0 || w < 16 || h < 16 || x + w > 16384 || y + h > 16384) return null;
  return { x, y, w, h };
}

/** O que a câmera e o gravador realmente estão usando: a prova de que nada foi mascarado. */
export type TechInfo = {
  width: number;
  height: number;
  fps: number | null;
  codec: string;
  mime: string | null;
  videoBps: number | null;
  audioBps: number | null;
  crop: Crop | null;
  zoom: number | null;
  /** Câmera em uso: o id casa com a lista do aparelho para dar o nome legível. */
  deviceId: string | null;
  label: string;
};

/**
 * `frame` é o tamanho do quadro que chega no <video> (videoWidth × videoHeight). Ele vale mais que o
 * getSettings(): no celular em pé, alguns navegadores dizem 1920×1080 mas entregam o quadro já girado (1080×1920).
 */
export function readTech(
  track: Pick<MediaStreamTrack, "getSettings"> & { label?: string },
  rec: { mime: string | null; videoBps: number | null; audioBps: number | null },
  frame?: { width: number; height: number } | null,
): TechInfo {
  const s = track.getSettings() as MediaTrackSettings & { zoom?: number };
  const real = frame && frame.width > 0 && frame.height > 0 ? frame : null;
  const width = real?.width ?? s.width ?? 0;
  const height = real?.height ?? s.height ?? 0;
  return {
    width,
    height,
    fps: typeof s.frameRate === "number" ? Math.round(s.frameRate) : null,
    codec: codecLabel(rec.mime),
    mime: rec.mime,
    videoBps: rec.videoBps,
    audioBps: rec.audioBps,
    crop: computeCrop(width, height),
    zoom: typeof s.zoom === "number" ? s.zoom : null,
    deviceId: s.deviceId ?? null,
    label: track.label ?? "",
  };
}

export type CameraName = { name: string; hint: string };

/**
 * Traduz o nome técnico da câmera ("camera2 0, facing back", "Back Ultra Wide Camera") para algo que dá
 * para entender, com o que muda na imagem. `backIndex` é a posição entre as traseiras (0 = a primeira).
 */
export function cameraName(label: string, facingMode: string | null, backIndex = 0): CameraName {
  const l = label.toLowerCase();
  if (/ultra|grande[- ]angular|0[,.]5x/.test(l)) return { name: "Traseira grande-angular", hint: "Mostra mais coisa em volta. Bom para gravar de perto." };
  if (/tele|zoom|\b[23]x\b/.test(l)) return { name: "Traseira com zoom", hint: "Aproxima a imagem. Só use com o celular longe." };
  if (/front|frontal|user|selfie|facing front/.test(l) || facingMode === "user") return { name: "Frontal (selfie)", hint: "Você se vê enquanto grava. Imagem um pouco mais fraca." };
  if (/back|rear|traseira|environment|facing back/.test(l) || facingMode === "environment") {
    return backIndex === 0
      ? { name: "Traseira principal", hint: "A melhor imagem do aparelho. Você não se vê." }
      : { name: `Traseira ${backIndex + 1}`, hint: "Outra lente de trás (pode ser grande-angular ou zoom). Teste e veja na tela." };
  }
  if (/usb|webcam|hd|logi|camera|câmera/.test(l)) return { name: label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)/i, "").trim() || "Câmera", hint: "Câmera do computador ou ligada por fio." };
  return { name: label || "Câmera", hint: "" };
}

/** Nomes legíveis para a lista do aparelho, numerando as traseiras na ordem em que aparecem. */
export function nameCameras(cams: { id: string; label: string }[]): (CameraName & { id: string })[] {
  let back = 0;
  return cams.map((c) => {
    const isBack = /back|rear|traseira|environment/i.test(c.label) && !/ultra|tele|grande[- ]angular/i.test(c.label);
    const n = cameraName(c.label, null, isBack ? back : 0);
    if (isBack) back++;
    return { id: c.id, ...n };
  });
}

/** Segundos que cabem num arquivo do bucket no bitrate do modo manual. */
export function maxRecordSeconds(quality: Quality): number {
  return maxSecondsFor(QUALITY[quality].videoBps, AUDIO_BPS);
}

const str = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length <= 512 ? v : null);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

export function parseCapture(raw: unknown): CaptureSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_CAPTURE;
  const p = raw as Record<string, unknown>;
  // Formato antigo: um só botão "noiseReduction" ligava ou desligava os três filtros.
  const legacyOff = p.noiseReduction === false;
  return {
    auto: p.auto !== false,
    facing: p.facing === "environment" ? "environment" : p.facing === "user" ? "user" : null,
    cameraId: str(p.cameraId),
    micId: str(p.micId),
    quality: p.quality === "alta" ? "alta" : "normal",
    noiseSuppression: bool(p.noiseSuppression, !legacyOff),
    echoCancellation: bool(p.echoCancellation, false),
    autoGainControl: bool(p.autoGainControl, !legacyOff),
  };
}
