"use client";

import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import styles from "./record.module.css";

export type PrompterPrefs = {
  fontPx: number;
  color: "white" | "sun";
  bgOpacity: number;
  marginPx: number;
  position: "top" | "middle";
  mirror: boolean;
};

export const DEFAULT_PREFS: PrompterPrefs = { fontPx: 27, color: "white", bgOpacity: 0.55, marginPx: 16, position: "top", mirror: false };

const KEY = "gravai:prompter";

export function loadPrefs(): PrompterPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<PrompterPrefs>;
    return {
      fontPx: clamp(p.fontPx, 20, 40, DEFAULT_PREFS.fontPx),
      color: p.color === "sun" ? "sun" : "white",
      bgOpacity: clamp(p.bgOpacity, 0, 0.9, DEFAULT_PREFS.bgOpacity),
      marginPx: clamp(p.marginPx, 8, 48, DEFAULT_PREFS.marginPx),
      position: p.position === "middle" ? "middle" : "top",
      mirror: p.mirror === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(p: PrompterPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* sem armazenamento: vale só nesta tela */
  }
}

function clamp(v: unknown, min: number, max: number, fallback: number) {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

export function PrompterSettings({
  prefs,
  onChange,
  onClose,
  cameraTab,
}: {
  prefs: PrompterPrefs;
  onChange: (p: PrompterPrefs) => void;
  onClose: () => void;
  /** Conteúdo da aba Câmera. */
  cameraTab: ReactNode;
}) {
  const set = (patch: Partial<PrompterPrefs>) => onChange({ ...prefs, ...patch });
  const [tab, setTab] = useState<"texto" | "camera">("texto");
  const chip = (on: boolean) => `${styles.chip} ${on ? styles.chipOn : ""}`;
  // Tecla Esc fecha, como tocar fora.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
    {/* Tocar fora do painel fecha. */}
    <div className={styles.backdrop} aria-hidden data-testid="fundo-ajustes" onClick={onClose} />
    <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Ajustes">
      <div className={styles.sheetTop}>
      <div className={styles.tabs} role="tablist" aria-label="Ajustes">
        <button type="button" role="tab" aria-selected={tab === "texto"} className={chip(tab === "texto")} onClick={() => setTab("texto")}>
          Texto
        </button>
        <button type="button" role="tab" aria-selected={tab === "camera"} className={chip(tab === "camera")} onClick={() => setTab("camera")}>
          Câmera
        </button>
      </div>
        <button type="button" className={styles.sheetClose} aria-label="Fechar ajustes" onClick={onClose}>
          <X size={22} strokeWidth={2} aria-hidden />
        </button>
      </div>
      {tab === "camera" ? cameraTab : <TextTab prefs={prefs} set={set} chip={chip} />}
      <Button onClick={onClose}>Pronto</Button>
    </div>
    </>
  );
}

function TextTab({ prefs, set, chip }: { prefs: PrompterPrefs; set: (p: Partial<PrompterPrefs>) => void; chip: (on: boolean) => string }) {
  return (
    <>
      <label className={styles.setting}>
        Tamanho da letra
        <input type="range" min={20} max={40} step={1} value={prefs.fontPx} onChange={(e) => set({ fontPx: Number(e.target.value) })} />
      </label>
      <label className={styles.setting}>
        Fundo do texto
        <input type="range" min={0} max={0.9} step={0.05} value={prefs.bgOpacity} onChange={(e) => set({ bgOpacity: Number(e.target.value) })} />
      </label>
      <label className={styles.setting}>
        Margem
        <input type="range" min={8} max={48} step={2} value={prefs.marginPx} onChange={(e) => set({ marginPx: Number(e.target.value) })} />
      </label>
      <div className={styles.setting} role="group" aria-label="Cor do texto">
        Cor do texto
        <div className={styles.chips}>
          <button type="button" className={chip(prefs.color === "white")} aria-pressed={prefs.color === "white"} onClick={() => set({ color: "white" })}>
            Branco
          </button>
          <button type="button" className={chip(prefs.color === "sun")} aria-pressed={prefs.color === "sun"} onClick={() => set({ color: "sun" })}>
            Amarelo
          </button>
        </div>
      </div>
      <div className={styles.setting} role="group" aria-label="Posição">
        Posição
        <div className={styles.chips}>
          <button type="button" className={chip(prefs.position === "top")} aria-pressed={prefs.position === "top"} onClick={() => set({ position: "top" })}>
            Perto da câmera
          </button>
          <button type="button" className={chip(prefs.position === "middle")} aria-pressed={prefs.position === "middle"} onClick={() => set({ position: "middle" })}>
            Meio
          </button>
          <button type="button" className={chip(prefs.mirror)} aria-pressed={prefs.mirror} onClick={() => set({ mirror: !prefs.mirror })}>
            Espelhar
          </button>
        </div>
      </div>
    </>
  );
}
