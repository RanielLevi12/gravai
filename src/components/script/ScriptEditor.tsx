"use client";

import { ArrowLeft, Cloud, CloudCheck, Info, RefreshCw, Timer, Video } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { notifyCost } from "@/lib/ai/cost-events";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";
import { Toast } from "@/components/ui/Toast";
import { estimateSeconds } from "@/lib/rules/duration";
import type { Cut } from "@/lib/script/cuts";
import { regenerateScript, rewriteBlock, updateBlockText, type ActionError } from "@/lib/script/actions";
import type { RewriteInstruction } from "@/lib/script/prompts";
import { blockLabel, clock } from "./format";
import { RewriteSheet } from "./RewriteSheet";
import { CutsPanel } from "./CutsPanel";
import { VideoInfo, type MainInfo } from "./VideoInfo";
import { ScriptBlock, type ScriptBlockData } from "./ScriptBlock";
import styles from "./script.module.css";
import { useAutosave } from "./useAutosave";

export type EditorBlock = ScriptBlockData & { text: string };

const textsOf = (blocks: EditorBlock[]): Record<string, string> => Object.fromEntries(blocks.map((b) => [b.id, b.text]));

async function saveText(id: string, text: string): Promise<boolean> {
  const r = await updateBlockText(id, text);
  return "ok" in r;
}

/** Tela do script: blocos editáveis com autosave, reescrita por bloco e "gerar de novo" com confirmação. */
export function ScriptEditor({
  projectId,
  title,
  blocks,
  warnings,
  stale,
  cutSeconds,
  initialCuts,
  info,
}: {
  projectId: string;
  title: string;
  blocks: EditorBlock[];
  warnings: string[];
  /** Respostas ou texto-fonte mudaram depois de este script ser gerado. */
  stale: boolean;
  /** Tamanho do corte escolhido na entrevista; null = sem cortes. */
  cutSeconds: number | null;
  initialCuts: Cut[];
  info: MainInfo;
}) {
  const [cuts, setCuts] = useState(initialCuts);
  const [texts, setTexts] = useState(() => textsOf(blocks));
  const [rewriting, setRewriting] = useState<EditorBlock | null>(null);
  const [quickBusy, setQuickBusy] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ id: string; text: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [outdated, setOutdated] = useState(stale);
  const [regenError, setRegenError] = useState<ActionError | null>(null);
  const autosave = useAutosave(saveText);
  const closeToast = useCallback(() => setToast(null), []);
  const undoAction = useMemo(
    () => (undo ? { label: "Desfazer", onClick: () => edit(undo.id, undo.text) } : undefined),
    // `edit` só usa setState e o autosave, que são estáveis
    [undo],
  );

  function edit(id: string, text: string) {
    setTexts((t) => ({ ...t, [id]: text }));
    autosave.schedule(id, text);
  }

  async function rewrite(mode: RewriteInstruction): Promise<ActionError | null> {
    const block = rewriting!;
    // A IA lê o texto salvo: tem que ser o que está na tela.
    if (!(await autosave.flush(block.id))) return { error: "Não consegui salvar suas edições antes de reescrever. Tente de novo." };
    const r = await rewriteBlock(block.id, mode);
    notifyCost();
    if ("error" in r) return r;
    setUndo({ id: block.id, text: texts[block.id] });
    edit(block.id, r.text);
    setRewriting(null);
    setToast("Texto reescrito");
    return null;
  }

  /** Botão rápido ao lado do texto: reescreve o bloco na hora, com "Desfazer". */
  async function quick(block: EditorBlock, mode: RewriteInstruction) {
    if (quickBusy) return;
    setQuickBusy(block.id);
    try {
      if (!(await autosave.flush(block.id))) {
        setToast("Não consegui salvar suas edições antes de ajustar. Tente de novo.");
        return;
      }
      const r = await rewriteBlock(block.id, mode);
      notifyCost();
      if ("error" in r) {
        setToast(r.error);
        return;
      }
      setUndo({ id: block.id, text: texts[block.id] });
      edit(block.id, r.text);
      setToast("Texto ajustado");
    } catch {
      setToast("Não foi possível ajustar agora. Tente de novo.");
    } finally {
      setQuickBusy(null);
    }
  }

  async function regenerate() {
    setRegenerating(true);
    setRegenError(null);
    // Se a geração falhar, o banco precisa ter o que está na tela.
    if (!(await autosave.flushAll())) {
      setRegenError({ error: "Não consegui salvar suas edições antes de gerar. Tente de novo." });
      setRegenerating(false);
      return;
    }
    try {
      const r = await regenerateScript(projectId);
      notifyCost();
      if ("error" in r) setRegenError(r);
      else {
        await autosave.reset(); // o script antigo saiu: nada dele pode ser gravado por cima do novo
        setCuts([]); // os cortes apontavam para o texto antigo
        setTexts(r.texts);
        setUndo(null); // "Desfazer" é do texto antigo
        setToast(null);
        setConfirming(false);
        setOutdated(false);
      }
    } catch {
      setRegenError({ error: "Não foi possível gerar agora. Tente de novo." });
    }
    setRegenerating(false);
  }

  const seconds = blocks.reduce((sum, b) => sum + estimateSeconds(texts[b.id] ?? ""), 0);
  let bodyNumber = 0;
  const labels = Object.fromEntries(blocks.map((b) => [b.id, b.kind === "body" ? `Trecho ${++bodyNumber}` : blockLabel(b.kind, b.cutIndex)]));
  // Número do corte de cada bloco (posição = índice + 1); os cortes vêm ordenados pelo início.
  const cutOfBlock = blocks.map((_, k) => {
    const at = cuts.findIndex((c) => c.start <= k + 1 && k + 1 <= c.end);
    return at >= 0 ? at + 1 : null;
  });

  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Script">
        <Link href={`/projetos/${projectId}/entrevista/resumo`} className={styles.iconBtn} aria-label="Voltar">
          <ArrowLeft size={22} strokeWidth={2} aria-hidden />
        </Link>
        <span className={styles.navTitle}>Script</span>
        <button type="button" className={styles.iconBtn} aria-label="Gerar script de novo" onClick={() => setConfirming(true)}>
          <RefreshCw size={22} strokeWidth={2} aria-hidden />
        </button>
      </nav>

      <header className={styles.head}>
        <h1>{title}</h1>
        <div className={styles.meta}>
          <span data-testid="tempo-total">
            <Chip icon={Timer}>{clock(seconds)}</Chip>
          </span>
          <Chip icon={autosave.status === "saved" ? CloudCheck : Cloud} tone={autosave.status === "saved" ? "saved" : "neutral"}>
            {autosave.status === "saved" ? "Salvo" : autosave.status === "saving" ? "Salvando…" : "Não salvou"}
          </Chip>
        </div>
      </header>

      {outdated ? (
        <aside className={styles.warn} aria-label="Script desatualizado">
          <Info size={18} strokeWidth={2} aria-hidden />
          <div>
            <p className={styles.warnTitle}>Suas respostas mudaram desde este script</p>
            <p>O texto abaixo foi escrito com as respostas antigas.</p>
            <button type="button" className={styles.warnAction} onClick={() => setConfirming(true)}>
              Gerar de novo
            </button>
          </div>
        </aside>
      ) : null}

      {warnings.length > 0 ? (
        <aside className={styles.warn} aria-label="Avisos sobre o script">
          <Info size={18} strokeWidth={2} aria-hidden />
          <div>
            <p className={styles.warnTitle}>Vale conferir antes de gravar</p>
            <ul>
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </aside>
      ) : null}

      <div className={styles.blocks}>
        {blocks.map((b, k) => (
          <ScriptBlock
            key={b.id}
            block={b}
            cutNumber={cutOfBlock[k]}
            label={labels[b.id]}
            text={texts[b.id] ?? ""}
            busy={quickBusy === b.id}
            disabled={quickBusy !== null}
            onChange={(t) => edit(b.id, t)}
            onRewrite={() => setRewriting(b)}
            onQuick={(mode) => quick(b, mode)}
          />
        ))}
      </div>

      {cutSeconds !== null ? (
        <CutsPanel
          projectId={projectId}
          cutSeconds={cutSeconds}
          cuts={cuts}
          labels={blocks.map((b) => labels[b.id])}
          texts={blocks.map((b) => texts[b.id] ?? "")}
          onChange={setCuts}
          flush={autosave.flushAll}
        />
      ) : null}

      <VideoInfo info={info} />

      <div className={styles.bottom}>
        <Button href={`/projetos/${projectId}/gravar`} icon={Video} className={styles.full}>
          Gravar
        </Button>
      </div>

      <RewriteSheet
        label={rewriting ? labels[rewriting.id] : null}
        onClose={() => setRewriting(null)}
        onSubmit={rewrite}
      />

      <Sheet open={confirming} onClose={() => setConfirming(false)} busy={regenerating} title="Gerar o script de novo?">
        <p className={styles.confirmText}>Isso substitui o script atual. Continuar?</p>
        {regenError ? (
          <p role="alert" className={styles.sheetError}>
            {regenError.error}
            {regenError.notConnected ? (
              <>
                {" "}
                <a href="/api/ai/connect">Conectar sua IA</a>
              </>
            ) : null}
          </p>
        ) : null}
        <Button onClick={regenerate} disabled={regenerating}>
          {regenerating ? "Gerando…" : "Continuar"}
        </Button>
        <Button variant="soft" onClick={() => setConfirming(false)} disabled={regenerating}>
          Cancelar
        </Button>
      </Sheet>

      <Toast message={toast} onClose={closeToast} action={undoAction} />
    </main>
  );
}
