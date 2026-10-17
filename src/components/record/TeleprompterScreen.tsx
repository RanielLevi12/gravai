"use client";

import { Gauge, Rabbit, RefreshCw, Settings2, Turtle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MAX_TAKE_SECONDS } from "@/lib/record/limits";
import { DEFAULT_SPEED_WPM, stepSpeed } from "@/lib/record/scroll";
import { clock } from "@/components/script/format";
import { Prompter } from "./Prompter";
import { autoLabel, DEFAULT_CAPTURE, type CaptureSettings } from "@/lib/record/capture";
import { CaptureSettingsPanel, loadCapture, saveCapture } from "./CaptureSettings";
import { DEFAULT_PREFS, loadPrefs, PrompterSettings, savePrefs, type PrompterPrefs } from "./PrompterSettings";
import styles from "./record.module.css";
import { useRecorder } from "./useRecorder";

export function TeleprompterScreen({
  projectId,
  modo,
  blockId,
  text,
  heading,
}: {
  projectId: string;
  modo: "take" | "blocos";
  blockId: string | null;
  text: string;
  /** "Corte 2 · bloco 3 de 6" (só por blocos). */
  heading: string | null;
}) {
  const router = useRouter();
  const rec = useRecorder({ projectId, kind: modo === "take" ? "take" : "block", blockId, maxSeconds: MAX_TAKE_SECONDS });
  const video = useRef<HTMLVideoElement>(null);
  const [prefs, setPrefs] = useState<PrompterPrefs>(DEFAULT_PREFS);
  const [speed, setSpeed] = useState(DEFAULT_SPEED_WPM);
  const [playing, setPlaying] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [capture, setCapture] = useState<CaptureSettings>(DEFAULT_CAPTURE);

  useEffect(() => {
    setPrefs(loadPrefs());
    setCapture(loadCapture());
  }, []);
  useEffect(() => {
    if (video.current) video.current.srcObject = rec.stream;
  }, [rec.stream]);
  useEffect(() => {
    if (rec.state !== "stopped" || !rec.result) return;
    const q = new URLSearchParams({ gravacao: rec.result.recordingId, dur: String(rec.result.durationSeconds) });
    if (blockId) q.set("bloco", blockId);
    router.push(`/projetos/${projectId}/gravar/aprovar?${q}`);
  }, [rec.state, rec.result, router, projectId, modo, blockId]);

  const recording = rec.state === "recording";
  // Câmera de trás não espelha; a da frente espelha como um espelho de verdade.
  const trackFacing = rec.stream?.getVideoTracks()[0]?.getSettings().facingMode;
  const mirrored = trackFacing !== "environment";
  const facing = trackFacing === "environment" || trackFacing === "user" ? trackFacing : (capture.facing ?? rec.profile?.facing ?? "user");
  const locked = recording || rec.state === "counting";
  const apply = (c: CaptureSettings) => {
    setCapture(c);
    saveCapture(c);
    void rec.configure(c);
  };
  const back = `/projetos/${projectId}/gravar`;

  if (rec.state === "denied" || rec.state === "unsupported") {
    return (
      <main className={styles.studio}>
        <div className={styles.denied}>
          <h1>{rec.state === "denied" ? "Preciso da câmera e do microfone" : "Este navegador não grava vídeo"}</h1>
          <p>
            {rec.state === "denied"
              ? "Toque no cadeado ao lado do endereço do site, libere a câmera e o microfone e recarregue a página."
              : "Abra o Gravaí no Chrome ou no Safari atualizado."}
          </p>
          <Link href={back} className={styles.link}>
            Enviar vídeo feito fora
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.studio}>
      {/* Moldura 9:16: o object-fit: cover corta o centro, igual ao corte que o worker faz no vídeo final. */}
      <div className={styles.frame}>
        <video
          ref={video}
          className={styles.cam}
          autoPlay
          muted
          playsInline
          style={mirrored ? { transform: "scaleX(-1)" } : undefined}
          onLoadedMetadata={(e) => rec.setFrame(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
          onResize={(e) => rec.setFrame(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
        />
      </div>
      <header className={styles.studioTop}>
        <Link href={back} className={styles.round} aria-label="Fechar">
          <X size={22} strokeWidth={2} aria-hidden />
        </Link>
        <span className={styles.rec} role="timer" aria-label="Tempo gravado">
          <i className={recording ? styles.dot : styles.dotOff} aria-hidden />
          {recording ? "REC" : "Pronto"} {clock(rec.elapsed)}
        </span>
        <button type="button" className={styles.round} aria-label="Ajustes" onClick={() => setShowSettings(true)}>
          <Settings2 size={22} strokeWidth={2} aria-hidden />
        </button>
      </header>
      {capture.auto && rec.profile ? (
        <p className={styles.badge} data-testid="selo-automatico">
          {autoLabel(rec.profile)}
        </p>
      ) : null}
      {heading ? <p className={styles.heading}>{heading}</p> : null}
      {rec.warn ? (
        <p className={styles.warn} role="status">
          Faltam 20 segundos para o limite. Termine a frase.
        </p>
      ) : null}
      {rec.error ? (
        <p className={styles.alert} role="alert">
          {rec.error}
        </p>
      ) : null}

      <Prompter text={text} speedWpm={speed} playing={playing} prefs={prefs} onToggle={() => setPlaying((p) => !p)} />

      {rec.state === "counting" ? (
        <div className={styles.count} aria-live="assertive">
          {rec.count}
        </div>
      ) : null}

      <footer className={styles.studioBottom}>
        <div className={styles.speed} role="group" aria-label="Velocidade do texto">
          <button type="button" aria-label="Mais devagar" onClick={() => setSpeed((s) => stepSpeed(s, -1))}>
            <Turtle size={20} strokeWidth={2} aria-hidden />
          </button>
          <span className={styles.speedValue}>
            <Gauge size={16} strokeWidth={2} aria-hidden /> {speed}
          </span>
          <button type="button" aria-label="Mais rápido" onClick={() => setSpeed((s) => stepSpeed(s, 1))}>
            <Rabbit size={20} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          className={`${styles.recBtn} ${recording ? styles.recBtnOn : ""}`}
          aria-label={recording ? "Parar gravação" : "Começar a gravar"}
          disabled={rec.state === "counting" || rec.state === "stopped" || !rec.stream}
          onClick={() => (recording ? rec.stop() : void rec.start())}
        >
          <i aria-hidden />
        </button>
        <button type="button" className={styles.round} aria-label="Virar câmera" disabled={locked} onClick={() => apply({ ...capture, facing: facing === "user" ? "environment" : "user", cameraId: null })}>
          <RefreshCw size={22} strokeWidth={2} aria-hidden />
        </button>
      </footer>

      {showSettings ? (
        <PrompterSettings
          prefs={prefs}
          onChange={(p) => {
            setPrefs(p);
            savePrefs(p);
          }}
          onClose={() => setShowSettings(false)}
          cameraTab={<CaptureSettingsPanel settings={capture} profile={rec.profile} info={rec.info} locked={locked} onChange={apply} />}
        />
      ) : null}
    </main>
  );
}
