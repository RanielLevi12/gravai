import type { AutoProfile, Facing } from "./capture";
import { pickMimeType } from "./mime";

/** Tudo o que o aparelho diz sobre si, já lido (assim a escolha é uma função pura, fácil de testar). */
export type DeviceEnv = {
  devices: { kind: string; deviceId: string; label: string }[];
  isTypeSupported: (mime: string) => boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: { effectiveType?: string; saveData?: boolean; downlink?: number };
  /** Celular ou tablet: aí a câmera de trás é a melhor. */
  mobile: boolean;
};

export const AUDIO_PROFILE_BPS = 128_000;
const HD = { tier: "1080p", longSide: 1920, videoBps: 7_000_000 } as const;
const SD = { tier: "720p", longSide: 1280, videoBps: 4_000_000 } as const;
const SLOW = new Set(["slow-2g", "2g", "3g"]);
const EXTERNAL_MIC = /lapela|lavalier|lav\b|externo|external|usb|wireless|sem fio|bluetooth|rode|boya|hollyland|shure/i;

/** 1080p só se o aparelho aguenta codificar e a rede manda 7 Mbps; na dúvida sobre o aparelho, tenta 1080p. */
export function canDoHd(env: DeviceEnv): boolean {
  if (env.deviceMemory !== undefined && env.deviceMemory < 4) return false;
  if (env.hardwareConcurrency !== undefined && env.hardwareConcurrency < 4) return false;
  const c = env.connection;
  if (c?.saveData) return false;
  if (c?.effectiveType && SLOW.has(c.effectiveType)) return false;
  if (c?.downlink !== undefined && c.downlink > 0 && c.downlink < 4) return false;
  return true;
}

export function chooseProfile(env: DeviceEnv): AutoProfile {
  const cams = env.devices.filter((d) => d.kind === "videoinput");
  // Antes da permissão a lista vem sem ids; só uma câmera conhecida de verdade segura a da frente.
  const onlyOne = cams.length === 1 && !!cams[0].deviceId;
  const facing: Facing = env.mobile && !onlyOne ? "environment" : "user";
  const mic = env.devices.find((d) => d.kind === "audioinput" && d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications" && EXTERNAL_MIC.test(d.label));
  const t = canDoHd(env) ? HD : SD;
  return {
    ...t,
    audioBps: AUDIO_PROFILE_BPS,
    facing,
    micId: mic?.deviceId ?? null,
    // Voz só de uma pessoa: eco desligado (ele só atrapalha). Microfone externo já vem limpo: sem filtros.
    noiseSuppression: !mic,
    echoCancellation: false,
    autoGainControl: !mic,
  };
}

/** Formato que o gravador vai usar neste aparelho (a escolha de verdade fica em mime.ts). */
export const preferredMime = (env: Pick<DeviceEnv, "isTypeSupported">) => pickMimeType(env.isTypeSupported);

const KEY = "gravai:autoprofile";

type Saved = { sig: string; profile: AutoProfile };

/** Muda quando troca câmera/microfone, formato ou rede: aí o perfil guardado deixa de valer. */
export function signature(env: DeviceEnv): string {
  const ids = env.devices.map((d) => `${d.kind}:${d.deviceId}`).sort().join(",");
  return [ids, preferredMime(env) ?? "-", env.deviceMemory ?? "-", env.hardwareConcurrency ?? "-", canDoHd(env) ? "hd" : "sd", env.mobile ? "m" : "d"].join("|");
}

function isProfile(p: unknown): p is AutoProfile {
  const o = p as Record<string, unknown> | null;
  return !!o && (o.tier === "1080p" || o.tier === "720p") && typeof o.longSide === "number" && typeof o.videoBps === "number" && typeof o.audioBps === "number" && (o.facing === "user" || o.facing === "environment");
}

export function loadProfile(sig: string): AutoProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Saved>;
    return s.sig === sig && isProfile(s.profile) ? s.profile : null;
  } catch {
    return null;
  }
}

export function saveProfile(sig: string, profile: AutoProfile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ sig, profile } satisfies Saved));
  } catch {
    /* sem armazenamento: o perfil é refeito na próxima vez */
  }
}

/** Lê o aparelho de verdade (só no navegador). */
export async function readDeviceEnv(): Promise<DeviceEnv> {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: DeviceEnv["connection"] };
  let devices: DeviceEnv["devices"] = [];
  try {
    devices = (await nav.mediaDevices.enumerateDevices()).map((d) => ({ kind: d.kind, deviceId: d.deviceId, label: d.label }));
  } catch {
    /* sem lista de aparelhos: vale o padrão */
  }
  return {
    devices,
    isTypeSupported: (t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t),
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    connection: nav.connection,
    mobile: /Android|iPhone|iPad|iPod/i.test(nav.userAgent) || (nav.maxTouchPoints > 1 && /Mac/i.test(nav.userAgent)),
  };
}

/** Perfil guardado para este aparelho, ou um novo (e guardado). */
export async function autoProfile(): Promise<AutoProfile> {
  const env = await readDeviceEnv();
  const sig = signature(env);
  const saved = loadProfile(sig);
  if (saved) return saved;
  const profile = chooseProfile(env);
  saveProfile(sig, profile);
  return profile;
}
