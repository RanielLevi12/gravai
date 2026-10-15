"use client";

import { useEffect, useState } from "react";
import { clock } from "@/components/script/format";
import { DEFAULT_CAPTURE, maxRecordSeconds, parseCapture, type CaptureSettings } from "@/lib/record/capture";
import styles from "./record.module.css";

const KEY = "gravai:capture";

export function loadCapture(): CaptureSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseCapture(JSON.parse(raw)) : DEFAULT_CAPTURE;
  } catch {
    return DEFAULT_CAPTURE;
  }
}

export function saveCapture(s: CaptureSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sem armazenamento: vale só nesta tela */
  }
}

type Device = { id: string; label: string };

/** Câmeras e microfones do aparelho; os nomes só aparecem depois da permissão. */
function useDevices() {
  const [devices, setDevices] = useState<{ cams: Device[]; mics: Device[] }>({ cams: [], mics: [] });
  useEffect(() => {
    const md = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
    if (!md?.enumerateDevices) return;
    let alive = true;
    const load = () =>
      md
        .enumerateDevices()
        .then((all) => {
          if (!alive) return;
          const pick = (kind: MediaDeviceKind, name: string) =>
            all.filter((d) => d.kind === kind && d.deviceId).map((d, i) => ({ id: d.deviceId, label: d.label || `${name} ${i + 1}` }));
          setDevices({ cams: pick("videoinput", "Câmera"), mics: pick("audioinput", "Microfone") });
        })
        .catch(() => {});
    void load();
    md.addEventListener?.("devicechange", load);
    return () => {
      alive = false;
      md.removeEventListener?.("devicechange", load);
    };
  }, []);
  return devices;
}

export function CaptureSettingsPanel({
  settings,
  onChange,
  locked,
}: {
  settings: CaptureSettings;
  onChange: (s: CaptureSettings) => void;
  /** Gravando: não dá para trocar. */
  locked: boolean;
}) {
  const { cams, mics } = useDevices();
  const set = (patch: Partial<CaptureSettings>) => onChange({ ...settings, ...patch });
  const chip = (on: boolean) => `${styles.chip} ${on ? styles.chipOn : ""}`;
  const facing = (f: CaptureSettings["facing"]) => !settings.cameraId && settings.facing === f;

  return (
    <fieldset className={styles.group} disabled={locked}>
      <legend className={styles.groupTitle}>Câmera e som</legend>
      {locked ? <p className={styles.hint}>Pare a gravação para trocar.</p> : null}
      <div className={styles.setting} role="group" aria-label="Câmera">
        Câmera
        <div className={styles.chips}>
          <button type="button" className={chip(facing("user"))} aria-pressed={facing("user")} onClick={() => set({ facing: "user", cameraId: null })}>
            Frente
          </button>
          <button
            type="button"
            className={chip(facing("environment"))}
            aria-pressed={facing("environment")}
            onClick={() => set({ facing: "environment", cameraId: null })}
          >
            Trás (melhor imagem)
          </button>
        </div>
        {cams.length > 2 ? (
          <select className={styles.select} aria-label="Outra câmera" value={settings.cameraId ?? ""} onChange={(e) => set({ cameraId: e.target.value || null })}>
            <option value="">Outra câmera…</option>
            {cams.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <label className={styles.setting}>
        Microfone
        <select className={styles.select} value={settings.micId ?? ""} onChange={(e) => set({ micId: e.target.value || null })}>
          <option value="">Do aparelho</option>
          {mics.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.setting} role="group" aria-label="Qualidade">
        Qualidade
        <div className={styles.chips}>
          <button type="button" className={chip(settings.quality === "normal")} aria-pressed={settings.quality === "normal"} onClick={() => set({ quality: "normal" })}>
            Normal
          </button>
          <button type="button" className={chip(settings.quality === "alta")} aria-pressed={settings.quality === "alta"} onClick={() => set({ quality: "alta" })}>
            Alta
          </button>
        </div>
        <span className={styles.hint}>
          {settings.quality === "alta"
            ? `Mais nítida. Cada gravação vai até ${clock(maxRecordSeconds("alta"))}.`
            : `Cada gravação vai até ${clock(maxRecordSeconds("normal"))}.`}
        </span>
      </div>
      <div className={styles.setting} role="group" aria-label="Som">
        Som
        <div className={styles.chips}>
          <button type="button" className={chip(settings.noiseReduction)} aria-pressed={settings.noiseReduction} onClick={() => set({ noiseReduction: !settings.noiseReduction })}>
            Reduzir ruído
          </button>
        </div>
        <span className={styles.hint}>Com microfone de lapela, desligue para a voz ficar mais natural.</span>
      </div>
    </fieldset>
  );
}
