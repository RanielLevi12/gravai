"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ChipOption } from "@/components/ui/Chip";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import type { ActionError } from "@/lib/script/actions";
import { MAX_CUSTOM, type RewriteInstruction as RewriteMode } from "@/lib/script/prompts";
import styles from "./script.module.css";

const MODES: { value: Exclude<RewriteMode, { custom: string }>; label: string }[] = [
  { value: "shorter", label: "Mais curto" },
  { value: "direct", label: "Mais direto" },
  { value: "emotional", label: "Mais emocional" },
  { value: "hook", label: "Gancho mais forte" },
  { value: "simpler", label: "Mais simples" },
];

/** Folha "Reescrever": um jeito pronto ou um pedido livre. Fica aberta se a IA falhar. */
export function RewriteSheet({
  label,
  onClose,
  onSubmit,
}: {
  /** Nome do bloco (ex.: "Corte 1"); `null` = fechada. */
  label: string | null;
  onClose: () => void;
  onSubmit: (mode: RewriteMode) => Promise<ActionError | null>;
}) {
  return (
    <Sheet open={label !== null} onClose={onClose} title={`Reescrever ${label ?? ""}`.trim()}>
      <RewriteForm onClose={onClose} onSubmit={onSubmit} />
    </Sheet>
  );
}

function RewriteForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (mode: RewriteMode) => Promise<ActionError | null> }) {
  const [preset, setPreset] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ActionError | null>(null);

  const mode: RewriteMode | null = custom.trim() ? { custom: custom.trim() } : (MODES.find((m) => m.value === preset)?.value ?? null);

  async function submit() {
    if (!mode || busy) return;
    setBusy(true);
    setError(null);
    try {
      const failure = await onSubmit(mode);
      if (failure) setError(failure);
    } catch {
      setError({ error: "Não foi possível reescrever agora. Tente de novo." });
    }
    setBusy(false);
  }

  return (
    <>
      <div className={styles.modes} role="radiogroup" aria-label="Como reescrever">
        {MODES.map((m) => (
          <ChipOption
            key={m.value}
            name="modo"
            value={m.value}
            checked={!custom.trim() && preset === m.value}
            onChange={() => {
              setPreset(m.value);
              setCustom("");
            }}
          >
            {m.label}
          </ChipOption>
        ))}
      </div>
      <Field
        label="Ou diga como quer"
        placeholder="Ex.: com um exemplo do dia a dia"
        value={custom}
        maxLength={MAX_CUSTOM}
        onChange={(e) => setCustom(e.target.value)}
      />
      {error ? (
        <p role="alert" className={styles.sheetError}>
          {error.error}
          {error.notConnected ? (
            <>
              {" "}
              <a href="/api/ai/connect">Conectar sua IA</a>
            </>
          ) : null}
        </p>
      ) : null}
      <Button onClick={submit} disabled={!mode || busy}>
        {busy ? "Reescrevendo…" : "Reescrever"}
      </Button>
      <Button variant="soft" onClick={onClose} disabled={busy}>
        Cancelar
      </Button>
    </>
  );
}
