"use client";

import { Video } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { OptionCard } from "@/components/ui/OptionCard";
import type { RecordMode } from "@/lib/record/rules";
import { ExternalUpload } from "./ExternalUpload";
import styles from "./record.module.css";

const LABELS: Record<RecordMode, { label: string; sub: string }> = {
  blocks: { label: "Por partes", sub: "Grava bloco a bloco, refaz só o que errar" },
  take: { label: "Tudo de uma vez", sub: "Um take só" },
  external: { label: "Já gravei", sub: "Enviar vídeo da galeria" },
};
const ORDER: RecordMode[] = ["blocks", "take", "external"];

export function ModeCards({ projectId, modes }: { projectId: string; modes: RecordMode[] }) {
  const [mode, setMode] = useState<RecordMode>("blocks");
  return (
    <>
      <fieldset className={styles.options}>
        <legend className={styles.title}>Como quer gravar?</legend>
        {ORDER.map((m) => (
          <OptionCard
            key={m}
            name="modo"
            value={m}
            label={LABELS[m].label}
            sub={LABELS[m].sub}
            checked={mode === m}
            disabled={!modes.includes(m)}
            reason={m === "take" ? "Vídeo de 5 min: grave por blocos." : undefined}
            onChange={() => setMode(m)}
          />
        ))}
      </fieldset>
      <p className={styles.hint}>Grave na vertical. Vamos pedir acesso à câmera e ao microfone.</p>
      {mode === "external" ? (
        <ExternalUpload projectId={projectId} />
      ) : (
        <div className={styles.actions}>
          <Button href={`/projetos/${projectId}/gravar/teleprompter?modo=${mode === "take" ? "take" : "blocos"}`} icon={Video}>
            {mode === "take" ? "Gravar tudo de uma vez" : "Gravar por blocos"}
          </Button>
        </div>
      )}
    </>
  );
}
