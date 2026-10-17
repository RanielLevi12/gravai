import { beforeEach, describe, expect, it, vi } from "vitest";
import { autoLabel } from "@/lib/record/capture";
import { canDoHd, chooseProfile, loadProfile, saveProfile, signature, type DeviceEnv } from "@/lib/record/autoconfig";

const phone: DeviceEnv = {
  devices: [
    { kind: "videoinput", deviceId: "front", label: "Frontal" },
    { kind: "videoinput", deviceId: "back", label: "Traseira" },
    { kind: "audioinput", deviceId: "default", label: "Padrão" },
  ],
  isTypeSupported: (t) => t === "video/mp4;codecs=avc1,mp4a" || t === "video/webm",
  deviceMemory: 8,
  hardwareConcurrency: 8,
  connection: { effectiveType: "4g", downlink: 20 },
  mobile: true,
};

describe("chooseProfile", () => {
  it("celular bom: câmera de trás, 1080p a 7 Mbps, áudio a 128 kbps", () => {
    const p = chooseProfile(phone);
    expect(p).toMatchObject({ tier: "1080p", longSide: 1920, videoBps: 7_000_000, audioBps: 128_000, facing: "environment", micId: null });
    expect(autoLabel(p)).toBe("Automático · 1080p");
  });
  it("computador: câmera da frente", () => {
    expect(chooseProfile({ ...phone, mobile: false }).facing).toBe("user");
  });
  it("celular com uma câmera só conhecida: a da frente", () => {
    expect(chooseProfile({ ...phone, devices: [phone.devices[0]] }).facing).toBe("user");
  });
  it("antes da permissão (sem ids) no celular: tenta a de trás", () => {
    expect(chooseProfile({ ...phone, devices: [{ kind: "videoinput", deviceId: "", label: "" }] }).facing).toBe("environment");
  });
  it("voz única: eco desligado; ruído e volume ligados no microfone do aparelho", () => {
    expect(chooseProfile(phone)).toMatchObject({ noiseSuppression: true, echoCancellation: false, autoGainControl: true });
  });
  it("microfone de lapela: usa ele e desliga os filtros", () => {
    const p = chooseProfile({ ...phone, devices: [...phone.devices, { kind: "audioinput", deviceId: "lav1", label: "Microfone de lapela USB" }] });
    expect(p).toMatchObject({ micId: "lav1", noiseSuppression: false, echoCancellation: false, autoGainControl: false });
  });
  it("aparelho fraco ou rede ruim: 720p a 4 Mbps", () => {
    for (const weak of [{ deviceMemory: 2 }, { hardwareConcurrency: 2 }, { connection: { effectiveType: "3g" } }, { connection: { saveData: true } }, { connection: { downlink: 1.5 } }]) {
      expect(chooseProfile({ ...phone, ...weak }), JSON.stringify(weak)).toMatchObject({ tier: "720p", longSide: 1280, videoBps: 4_000_000 });
    }
  });
  it("Safari (sem deviceMemory nem rede): tenta 1080p", () => {
    expect(chooseProfile({ ...phone, deviceMemory: undefined, connection: undefined }).tier).toBe("1080p");
    expect(canDoHd({ ...phone, deviceMemory: undefined, hardwareConcurrency: undefined, connection: undefined })).toBe(true);
  });
});

describe("perfil guardado por aparelho", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  });

  it("guarda e devolve o mesmo perfil enquanto o aparelho é o mesmo", () => {
    const sig = signature(phone);
    const p = chooseProfile(phone);
    saveProfile(sig, p);
    expect(loadProfile(sig)).toEqual(p);
  });
  it("troca de câmera, formato ou rede muda a assinatura e invalida o perfil", () => {
    saveProfile(signature(phone), chooseProfile(phone));
    expect(loadProfile(signature({ ...phone, devices: [...phone.devices, { kind: "videoinput", deviceId: "usb", label: "USB" }] }))).toBeNull();
    expect(loadProfile(signature({ ...phone, isTypeSupported: () => false }))).toBeNull();
    expect(loadProfile(signature({ ...phone, connection: { effectiveType: "2g" } }))).toBeNull();
  });
  it("armazenamento quebrado ou lixo guardado não derruba nada", () => {
    expect(loadProfile("x")).toBeNull();
    store.set("gravai:autoprofile", "{lixo");
    expect(loadProfile("x")).toBeNull();
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("bloqueado"); } });
    expect(loadProfile("x")).toBeNull();
    expect(() => saveProfile("x", chooseProfile(phone))).not.toThrow();
  });
});
