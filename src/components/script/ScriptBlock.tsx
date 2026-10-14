"use client";

import { Pencil, Scissors, Type, WandSparkles } from "lucide-react";
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
const QUICK: { mode: RewriteInstruction; label: string }[] = [
  { mode: "noGreeting", label: "Tirar saudação" },
  { mode: "shorter", label: "Encurtar" },
  { mode: "simpler", label: "Mais simples" },
  { mode: "hook", label: "Mais forte" },
];

export function ScriptBlock({
  block,
  label,
  text,
  busy,
  disabled,
  onChange,
  onRewrite,
  onQuick,
}: {
  block: ScriptBlockData;
  label: string;
  text: string;
  /** Um botão rápido deste bloco está reescrevendo. */
  busy: boolean;
  /** Outro bloco está reescrevendo: espera. */
  disabled: boolean;
  onChange: (text: string) => void;
  onRewrite: () => void;
  onQuick: (mode: RewriteInstruction) => void;
}) {
  const [editing, setEditing] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const isCut = block.kind === "cut" && block.cutIndex !== null;

  useEffect(() => {
    if (editing) editor.current?.focus();
  }, [editing]);

  return (
    <section
      aria-label={label}
      className={isCut ? `${styles.block} ${styles.cut}` : styles.block}
      style={isCut ? ({ "--c": cutVar(block.cutIndex!) } as CSSProperties) : undefined}
    >
      <div className={styles.blockHead}>
        <span className={styles.tag}>
          {isCut ? <Scissors size={14} strokeWidth={2} aria-hidden /> : null}
          {label}
        </span>
        <span className={styles.dur}>{clock(estimateSeconds(text))}</span>
      </div>
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
      <div className={styles.quick} role="group" aria-label={`Ajustes rápidos do ${label}`} aria-busy={busy}>
        {QUICK.map((q) => (
          <button key={q.label} type="button" className={styles.quickBtn} disabled={disabled} onClick={() => onQuick(q.mode)}>
            {q.label}
          </button>
        ))}
        {busy ? <span className={styles.quickWait}>Ajustando…</span> : null}
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
      </div>
    </section>
  );
}
