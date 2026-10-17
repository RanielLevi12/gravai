"use client";

import { Eraser, Flame, Minimize2, Pencil, RotateCcw, Scissors, Sparkles, Type, WandSparkles, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { estimateSeconds } from "@/lib/rules/duration";
import type { BlockKind } from "@/lib/script/generate";
import type { RewriteInstruction } from "@/lib/script/prompts";
import { clock, cutVar } from "./format";
import styles from "./script.module.css";

export type ScriptBlockData = {
  id: string;
  kind: BlockKind;
  cutIndex: number | null;
  cutTitle: string | null;
};

/** Um bloco do script: etiqueta, duração calculada ao vivo, texto (editável) e ações. */
const QUICK: { mode: RewriteInstruction; label: string; icon: LucideIcon; tone: "tangerine" | "sky" | "mint" | "sun" }[] = [
  { mode: "noGreeting", label: "Tirar saudação", icon: Eraser, tone: "tangerine" },
  { mode: "shorter", label: "Encurtar", icon: Minimize2, tone: "sky" },
  { mode: "simpler", label: "Mais simples", icon: Sparkles, tone: "mint" },
  { mode: "hook", label: "Mais forte", icon: Flame, tone: "sun" },
];

const TAG_BY_KIND: Partial<Record<BlockKind, string>> = { opening: "tagOpening", body: "tagBody", bridge: "tagBridge", closing: "tagClosing" };

export function ScriptBlock({
  block,
  cutNumber = null,
  label,
  text,
  busy,
  disabled,
  onChange,
  onRewrite,
  versions = 0,
  onQuick,
  onRestore,
}: {
  block: ScriptBlockData;
  /** Número do corte que inclui este bloco (null = fora de qualquer corte). */
  cutNumber?: number | null;
  label: string;
  text: string;
  /** Um botão rápido deste bloco está reescrevendo. */
  busy: boolean;
  /** Outro bloco está reescrevendo: espera. */
  disabled: boolean;
  onChange: (text: string) => void;
  onRewrite: () => void;
  /** Quantas versões anteriores deste trecho existem. */
  versions?: number;
  onQuick: (mode: RewriteInstruction) => void;
  onRestore: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const cut = block.kind === "cut" ? block.cutIndex : cutNumber;
  const isCut = cut !== null;

  useEffect(() => {
    if (editing) editor.current?.focus();
  }, [editing]);

  return (
    <section
      aria-label={label}
      className={isCut ? `${styles.block} ${styles.cut}` : styles.block}
      style={isCut ? ({ "--c": cutVar(cut!) } as CSSProperties) : undefined}
    >
      <div className={styles.blockHead}>
        <span className={isCut ? styles.tag : `${styles.tag} ${styles[TAG_BY_KIND[block.kind] ?? "tagBridge"]}`}>
          {isCut ? <Scissors size={14} strokeWidth={2} aria-hidden /> : null}
          {label}
          {cutNumber !== null && block.kind !== "cut" ? ` · Corte ${cutNumber}` : ""}
        </span>
        <span className={styles.dur}>{clock(estimateSeconds(text))}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.bodyText}>
          {editing ? (
            <textarea
              ref={editor}
              className={styles.editor}
              aria-label={`Texto do ${label}`}
              value={text}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : (
            <p className={styles.text}>{text}</p>
          )}
          {block.cutTitle ? (
            <p className={styles.cutTitle}>
              <Type size={15} strokeWidth={2} aria-hidden />“{block.cutTitle}”
            </p>
          ) : null}
        </div>
        <div className={styles.quick} role="group" aria-label={`Ajustes rápidos do ${label}`} aria-busy={busy}>
          {QUICK.map((q) => (
            <button key={q.label} type="button" className={`${styles.quickBtn} ${styles[`quick_${q.tone}`]}`} disabled={disabled} onClick={() => onQuick(q.mode)}>
              <q.icon size={16} strokeWidth={2.25} aria-hidden />
              {q.label}
            </button>
          ))}
          {busy ? <span className={styles.quickWait}>Ajustando…</span> : null}
        </div>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.mini} onClick={onRewrite}>
          <WandSparkles size={16} strokeWidth={2} aria-hidden />
          Reescrever
        </button>
        <button type="button" className={styles.mini} onClick={() => setEditing((v) => !v)}>
          <Pencil size={16} strokeWidth={2} aria-hidden />
          {editing ? "Pronto" : "Editar"}
        </button>
        <button type="button" className={styles.mini} disabled={versions === 0 || disabled} onClick={onRestore}>
          <RotateCcw size={16} strokeWidth={2} aria-hidden />
          Voltar à versão anterior
        </button>
      </div>
    </section>
  );
}
