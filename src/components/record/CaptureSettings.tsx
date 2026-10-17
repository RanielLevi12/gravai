"use client";

import { useEffect, useState } from "react";
import { clock } from "@/components/script/format";
import { autoLabel, cameraName, DEFAULT_CAPTURE, nameCameras, maxRecordSeconds, parseCapture, type AutoProfile, type CaptureSettings, type TechInfo } from "@/lib/record/capture";
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

const mbps = (bps: number) => `${(bps / 1_000_000).toFixed(1).replace(".", ",")} Mbps`;

/** Números reais lidos do track e do gravador: a prova de que nada foi mascarado. */
export function TechInfoBlock({ info }: { info: TechInfo | null }) {
  if (!info || !info.width) return <p className={styles.hint}>A câmera ainda não abriu.</p>;
  const rows: [string, string][] = [
    ["Resolução da câmera", `${info.width}×${info.height}`],
    ["Enquadramento final", info.crop ? `corte 9:16 de ${info.crop.w}×${info.crop.h} (a partir de x=${info.crop.x})` : "vídeo em pé, sem corte"],
    ["Quadros por segundo", info.fps ? `${info.fps} fps` : "—"],
    ["Formato", info.mime ? `${info.codec} (${info.mime.split(";")[0].replace("video/", "")})` : info.codec],
    ["Bitrate", info.videoBps ? `${mbps(info.videoBps)} vídeo + ${Math.round((info.audioBps ?? 0) / 1000)} kbps áudio` : "—"],
    ["Zoom da câmera", info.zoom === null ? "não informado" : `${info.zoom}×`],
  ];
  return (
    <dl className={styles.tech} data-testid="info-tecnica">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CaptureSettingsPanel({
  settings,
  profile,
  info,
  onChange,
  locked,
}: {
  settings: CaptureSettings;
  profile: AutoProfile | null;
  info: TechInfo | null;
  onChange: (s: CaptureSettings) => void;
  /** Gravando: não dá para trocar. */
  locked: boolean;
}) {
  const { cams, mics } = useDevices();
  // Mexer em qualquer ajuste manual desliga o automático.
  const manual = (patch: Partial<CaptureSettings>) => onChange({ ...settings, ...patch, auto: false });
  const chip = (on: boolean) => `${styles.chip} ${on ? styles.chipOn : ""}`;
  const facing = (f: NonNullable<CaptureSettings["facing"]>) => !settings.cameraId && settings.facing === f;
  const named = nameCameras(cams);
  const current = info?.deviceId ? named.find((c) => c.id === info.deviceId) : undefined;
  const now = current ?? (info ? cameraName(info.label, null) : null);

  return (
    <fieldset className={styles.group} disabled={locked}>
      <legend className={styles.groupTitle}>Câmera e som</legend>
      {locked ? <p className={styles.lockNote}>Gravando agora: a câmera não pode ser trocada no meio. Pare a gravação para mudar estes ajustes. O texto pode ser mudado na aba Texto.</p> : null}
      {now && info?.width ? (
        <div className={styles.camNow} data-testid="camera-em-uso">
          Câmera em uso
          <strong>{now.name}</strong>
          {now.hint ? <span>{now.hint}</span> : null}
          <span>
            Imagem de {info.width}×{info.height}
            {info.fps ? ` · ${info.fps} fps` : ""}
          </span>
        </div>
      ) : null}
      <div className={styles.setting} role="group" aria-label="Automático">
        Automático
        <div className={styles.chips}>
          <button
            type="button"
            className={chip(settings.auto)}
            aria-pressed={settings.auto}
            onClick={() => onChange({ ...settings, auto: !settings.auto, cameraId: null, micId: null })}
          >
            {settings.auto ? (profile ? autoLabel(profile) : "Automático · ligado") : "Automático · desligado"}
          </button>
        </div>
        <span className={styles.hint}>O app escolhe a melhor câmera, resolução e áudio deste aparelho.</span>
      </div>
      <details className={styles.advanced}>
        <summary>Avançado</summary>
        <div className={styles.group}>
          <div className={styles.setting} role="group" aria-label="Câmera">
            Câmera
            {named.length > 0 ? (
              <div className={styles.camList}>
                {named.map((c) => {
                  const on = settings.cameraId ? settings.cameraId === c.id : current?.id === c.id;
                  return (
                    <button key={c.id} type="button" className={styles.camOption} aria-pressed={on} onClick={() => manual({ cameraId: c.id, facing: null })}>
                      {c.name}
                      {c.hint ? <span>{c.hint}</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className={styles.chips}>
                <button type="button" className={chip(facing("user"))} aria-pressed={facing("user")} onClick={() => manual({ facing: "user", cameraId: null })}>
                  Frontal (selfie)
                </button>
                <button type="button" className={chip(facing("environment"))} aria-pressed={facing("environment")} onClick={() => manual({ facing: "environment", cameraId: null })}>
                  Traseira (melhor imagem)
                </button>
              </div>
            )}
            <span className={styles.hint}>Toque numa câmera e veja a imagem mudar atrás deste painel.</span>
          </div>
          <label className={styles.setting}>
            Microfone
            <select className={styles.select} value={settings.micId ?? ""} onChange={(e) => manual({ micId: e.target.value || null })}>
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
              <button type="button" className={chip(settings.quality === "normal")} aria-pressed={settings.quality === "normal"} onClick={() => manual({ quality: "normal" })}>
                720p
              </button>
              <button type="button" className={chip(settings.quality === "alta")} aria-pressed={settings.quality === "alta"} onClick={() => manual({ quality: "alta" })}>
                1080p
              </button>
            </div>
            <span className={styles.hint}>Cada gravação vai até {clock(maxRecordSeconds(settings.quality))}.</span>
          </div>
          <div className={styles.setting} role="group" aria-label="Som">
            Som
            <div className={styles.chips}>
              <button type="button" className={chip(settings.noiseSuppression)} aria-pressed={settings.noiseSuppression} onClick={() => manual({ noiseSuppression: !settings.noiseSuppression })}>
                Reduzir ruído
              </button>
              <button type="button" className={chip(settings.autoGainControl)} aria-pressed={settings.autoGainControl} onClick={() => manual({ autoGainControl: !settings.autoGainControl })}>
                Volume automático
              </button>
              <button type="button" className={chip(settings.echoCancellation)} aria-pressed={settings.echoCancellation} onClick={() => manual({ echoCancellation: !settings.echoCancellation })}>
                Cancelar eco
              </button>
            </div>
            <span className={styles.hint}>Com microfone de lapela, desligue os filtros para a voz ficar natural. Com uma voz só, o eco fica desligado.</span>
          </div>
        </div>
        <details className={styles.advanced}>
          <summary>Info técnica</summary>
          <TechInfoBlock info={info} />
        </details>
      </details>
    </fieldset>
  );
}
