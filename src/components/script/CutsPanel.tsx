"use client";

import { Minus, Plus, Scissors, Sparkles, Trash2 } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { notifyCost } from "@/lib/ai/cost-events";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { PLATFORM_LABELS, PLATFORMS } from "@/lib/interview/steps";
import { MAX_CUT_TITLE, MAX_CUTS, cutSecondsOf, type Cut } from "@/lib/script/cuts";
import { saveCuts, suggestCuts } from "@/lib/script/actions";
import { clock, cutVar } from "./format";
import styles from "./script.module.css";

/** Cortes do script: a IA sugere, o usuário ajusta começo e fim, apaga ou marca à mão. */
export function CutsPanel({
  projectId,
  cutSeconds,
  cuts,
  labels,
  texts,
  onChange,
  flush,
}: {
  projectId: string;
  cutSeconds: number;
  cuts: Cut[];
  /** Rótulo de cada bloco, na ordem do script ("Abertura", "Trecho 1"…). */
  labels: string[];
  /** Texto atual de cada bloco, na ordem do script. */
  texts: string[];
  onChange: (cuts: Cut[]) => void;
  /** Grava as edições de texto pendentes antes de a IA ler o script. */
  flush: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState<"suggest" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const n = labels.length;

  async function persist(next: Cut[]) {
    const before = cuts;
    onChange(next);
    setBusy("save");
    setError(null);
    try {
      const r = await saveCuts(projectId, next);
      if ("error" in r) {
        onChange(before);
        setError(r.error);
      }
    } catch {
      onChange(before);
      setError("Não foi possível salvar os cortes agora. Tente de novo.");
    }
    setBusy(null);
  }

  async function suggest() {
    setBusy("suggest");
    setError(null);
    try {
      if (!(await flush())) {
        setError("Não consegui salvar suas edições antes de sugerir. Tente de novo.");
        return;
      }
      const r = await suggestCuts(projectId);
      notifyCost();
      if ("error" in r) setError(r.error);
      else {
        onChange(r.cuts);
        setConfirming(false);
      }
    } catch {
      setError("Não foi possível sugerir agora. Tente de novo.");
    } finally {
      setBusy(null);
    }
  }

  function addByHand() {
    const used = new Set(cuts.flatMap((c) => Array.from({ length: c.end - c.start + 1 }, (_, k) => c.start + k)));
    const free = Array.from({ length: n }, (_, k) => k + 1).find((p) => !used.has(p));
    if (!free) {
      setError("Todos os trechos já estão em algum corte.");
      return;
    }
    const id = crypto.randomUUID().slice(0, 8);
    void persist([...cuts, { id, start: free, end: free, title: "", coverPrompt: null, descriptions: {} }].sort((a, b) => a.start - b.start));
  }

  const patch = (id: string, change: Partial<Cut>) => persist(cuts.map((c) => (c.id === id ? { ...c, ...change } : c)));

  return (
    <section className={styles.cuts} aria-labelledby="cortes-titulo">
      <h2 id="cortes-titulo" className={styles.cutsTitle}>
        <Scissors size={18} strokeWidth={2} aria-hidden /> Cortes
      </h2>
      <p className={styles.cutsLead}>Trechos do vídeo para publicar separado, de cerca de {cutSeconds} s cada.</p>
      <div className={styles.cutsActions}>
        <Button icon={Sparkles} onClick={() => (cuts.length > 0 ? setConfirming(true) : void suggest())} disabled={busy !== null} aria-busy={busy === "suggest"}>
          {busy === "suggest" ? "Sugerindo…" : "Sugerir cortes"}
        </Button>
        <Button variant="soft" icon={Plus} onClick={addByHand} disabled={busy !== null || cuts.length >= MAX_CUTS}>
          Marcar à mão
        </Button>
      </div>
      {error ? (
        <p role="alert" className={styles.sheetError}>
          {error}
        </p>
      ) : null}

      <ul className={styles.cutList}>
        {cuts.map((c, k) => {
          const prevEnd = k > 0 ? cuts[k - 1].end : 0;
          const nextStart = k < cuts.length - 1 ? cuts[k + 1].start : n + 1;
          const seconds = cutSecondsOf(texts, c);
          const descriptions = PLATFORMS.filter((p) => c.descriptions[p]);
          return (
            <li key={c.id} className={styles.cutCard} style={{ "--c": cutVar(k + 1) } as CSSProperties}>
              <div className={styles.cutHead}>
                <span className={styles.cutTag}>Corte {k + 1}</span>
                <span className={styles.dur} aria-label={`Duração estimada do corte ${k + 1}`}>
                  {clock(seconds)}
                  {seconds > cutSeconds * 1.3 ? " · passou do tamanho" : ""}
                </span>
                <button type="button" className={styles.iconBtn} aria-label={`Remover o corte ${k + 1}`} disabled={busy !== null} onClick={() => void persist(cuts.filter((x) => x.id !== c.id))}>
                  <Trash2 size={18} strokeWidth={2} aria-hidden />
                </button>
              </div>
              <label className={styles.cutLabel}>
                Título do corte {k + 1}
                <input
                  className={styles.cutInput}
                  defaultValue={c.title}
                  maxLength={MAX_CUT_TITLE}
                  placeholder={`Corte ${k + 1}`}
                  onBlur={(e) => {
                    const title = e.target.value.trim();
                    if (title !== c.title) void patch(c.id, { title });
                  }}
                />
              </label>
              <Stepper
                name={`Começa em, corte ${k + 1}`}
                value={labels[c.start - 1]}
                canDown={c.start > prevEnd + 1 && busy === null}
                canUp={c.start < c.end && busy === null}
                onDown={() => void patch(c.id, { start: c.start - 1 })}
                onUp={() => void patch(c.id, { start: c.start + 1 })}
                caption="Começa em"
              />
              <Stepper
                name={`Termina em, corte ${k + 1}`}
                value={labels[c.end - 1]}
                canDown={c.end > c.start && busy === null}
                canUp={c.end < nextStart - 1 && busy === null}
                onDown={() => void patch(c.id, { end: c.end - 1 })}
                onUp={() => void patch(c.id, { end: c.end + 1 })}
                caption="Termina em"
              />
              {c.coverPrompt || descriptions.length > 0 ? (
                <details className={styles.cutMore}>
                  <summary>Capa e descrições</summary>
                  {c.coverPrompt ? (
                    <p>
                      <b>Capa:</b> {c.coverPrompt}
                    </p>
                  ) : null}
                  {descriptions.map((p) => (
                    <p key={p}>
                      <b>{PLATFORM_LABELS[p]}:</b> {c.descriptions[p]}
                    </p>
                  ))}
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Sheet open={confirming} onClose={() => setConfirming(false)} busy={busy === "suggest"} title="Sugerir cortes de novo?">
        <p className={styles.confirmText}>Isso substitui os cortes atuais, inclusive os que você ajustou. Continuar?</p>
        {error ? (
          <p role="alert" className={styles.sheetError}>
            {error}
          </p>
        ) : null}
        <Button onClick={() => void suggest()} disabled={busy !== null}>
          {busy === "suggest" ? "Sugerindo…" : "Continuar"}
        </Button>
        <Button variant="soft" onClick={() => setConfirming(false)} disabled={busy === "suggest"}>
          Cancelar
        </Button>
      </Sheet>
    </section>
  );
}

function Stepper({ name, caption, value, canDown, canUp, onDown, onUp }: { name: string; caption: string; value: string; canDown: boolean; canUp: boolean; onDown: () => void; onUp: () => void }) {
  return (
    <div className={styles.stepper} role="group" aria-label={name}>
      <span className={styles.stepperCaption}>{caption}</span>
      <button type="button" className={styles.stepBtn} aria-label={`${name}: um trecho antes`} disabled={!canDown} onClick={onDown}>
        <Minus size={18} strokeWidth={2} aria-hidden />
      </button>
      <span className={styles.stepValue}>{value}</span>
      <button type="button" className={styles.stepBtn} aria-label={`${name}: um trecho depois`} disabled={!canUp} onClick={onUp}>
        <Plus size={18} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
