"use client";

import { useEffect, useMemo, useRef } from "react";
import { pxPerSecond } from "@/lib/record/scroll";
import type { PrompterPrefs } from "./PrompterSettings";
import styles from "./record.module.css";

const LINE_HEIGHT = 1.4;
/** Abaixo disso o toque conta como toque (pausar/continuar), não como arraste. */
const DRAG_THRESHOLD_PX = 8;

/** Quebra o texto em frases; cada uma vira um trecho que muda de cor conforme passa pela barra de leitura. */
function sentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((p) => p.split(/(?<=[.!?…])\s+/))
    .map((s) => s.trim())
    .filter(Boolean);
}

export function Prompter({
  text,
  speedWpm,
  playing,
  prefs,
  onToggle,
}: {
  text: string;
  speedWpm: number;
  playing: boolean;
  prefs: PrompterPrefs;
  onToggle: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Dedo na tela: o texto fica parado e acompanha o arraste; ao soltar, segue de onde parou.
  const drag = useRef({ active: false, startY: 0, startTop: 0, moved: false, dirty: false });
  const parts = useMemo(() => sentences(text), [text]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const lineHeightPx = prefs.fontPx * LINE_HEIGHT;
    // ~6 letras por palavra, largura média de letra ≈ 0,5 do tamanho da fonte.
    const wordsPerLine = Math.max(2, (el.clientWidth - prefs.marginPx * 2) / (prefs.fontPx * 0.5 * 6));
    const speed = pxPerSecond(speedWpm, wordsPerLine, lineHeightPx);
    let raf = 0;
    let last = performance.now();
    let acc = el.scrollTop;
    let current = -1;

    const mark = () => {
      const readY = el.getBoundingClientRect().top + el.clientHeight * 0.3;
      const spans = el.querySelectorAll<HTMLElement>("[data-s]");
      let idx = 0;
      spans.forEach((s, i) => {
        if (s.getBoundingClientRect().top <= readY) idx = i;
      });
      if (idx === current) return;
      current = idx;
      spans.forEach((s, i) => {
        s.dataset.s = i < idx ? "past" : i === idx ? "now" : "next";
      });
    };

    const frame = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (drag.current.dirty) {
        acc = el.scrollTop;
        drag.current.dirty = false;
      }
      if (playing && !reduce && !drag.current.active) {
        acc = Math.min(el.scrollHeight - el.clientHeight, acc + speed * dt);
        el.scrollTop = acc;
      }
      mark();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, speedWpm, prefs.fontPx, prefs.marginPx, text]);

  return (
    <div className={styles.prompterWrap}>
    <div
      ref={box}
      className={`${styles.prompter} ${prefs.position === "middle" ? styles.prompterMiddle : ""}`}
      style={{
        fontSize: prefs.fontPx,
        lineHeight: LINE_HEIGHT,
        padding: `${prefs.fontPx * 2}px ${prefs.marginPx}px`,
        background: `rgba(0,0,0,${prefs.bgOpacity})`,
        ["--prompter-ink" as string]: prefs.color === "sun" ? "var(--sun)" : "#fff",
        transform: prefs.mirror ? "scaleX(-1)" : undefined,
      }}
      onPointerDown={(e) => {
        const el = box.current;
        if (!el) return;
        el.setPointerCapture(e.pointerId);
        drag.current = { active: true, startY: e.clientY, startTop: el.scrollTop, moved: false, dirty: false };
      }}
      onPointerMove={(e) => {
        const el = box.current;
        const d = drag.current;
        if (!el || !d.active) return;
        const dy = e.clientY - d.startY;
        if (!d.moved && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
        d.moved = true;
        el.scrollTop = d.startTop - dy;
        d.dirty = true;
      }}
      onPointerUp={() => {
        const d = drag.current;
        if (!d.active) return;
        d.active = false;
        d.dirty = true;
      }}
      // Toque, leitor de tela e chave de acesso chegam como click; só o click logo após um arraste é ignorado.
      onClick={() => {
        if (drag.current.moved) return;
        onToggle();
      }}
      onPointerCancel={() => {
        drag.current.active = false;
        drag.current.dirty = true;
      }}
      role="button"
      tabIndex={0}
      aria-label={playing ? "Pausar texto" : "Continuar texto"}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      {parts.map((p, i) => (
        <span key={i} data-s="next" className={styles.sentence}>
          {p}{" "}
        </span>
      ))}
    </div>
      <span className={styles.readBar} aria-hidden />
    </div>
  );
}
