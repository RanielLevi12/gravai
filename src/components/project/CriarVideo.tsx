"use client";

import { ChevronLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { COLOR_VAR, isFolderColor } from "@/lib/folders/schema";
import { novoVideoHref } from "@/lib/project/status-label";
import { ORIGENS } from "./origens";
import styles from "./CriarVideo.module.css";

export type ProjetoEscolha = { id: string; name: string; color: string };

/** Botão grande "Criar vídeo": pergunta o projeto (ou "Sem projeto") e depois a origem do conteúdo. */
export function CriarVideo({ projetos }: { projetos: ProjetoEscolha[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={styles.cta} onClick={() => setOpen(true)}>
        <Plus size={26} strokeWidth={2.5} aria-hidden />
        Criar vídeo
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Criar vídeo">
        <Passos projetos={projetos} />
      </Sheet>
    </>
  );
}

function Passos({ projetos }: { projetos: ProjetoEscolha[] }) {
  // undefined = ainda não escolheu; null = "Sem projeto"
  const [escolha, setEscolha] = useState<ProjetoEscolha | null | undefined>(projetos.length === 0 ? null : undefined);

  if (escolha === undefined) {
    return (
      <div className={styles.step}>
        <p className={styles.ask}>Em qual projeto vai este vídeo?</p>
        <ul className={styles.choices}>
          {projetos.map((p) => (
            <li key={p.id}>
              <button type="button" className={styles.choice} onClick={() => setEscolha(p)}>
                <span className={styles.dot} style={{ background: COLOR_VAR[isFolderColor(p.color) ? p.color : "rosa"] }} aria-hidden />
                {p.name}
              </button>
            </li>
          ))}
          <li>
            <button type="button" className={`${styles.choice} ${styles.loose}`} onClick={() => setEscolha(null)}>
              Sem projeto
            </button>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <div className={styles.step}>
      <p className={styles.ask}>
        De onde vem o conteúdo?
        <small className={styles.where}>{escolha ? `Projeto: ${escolha.name}` : "Vídeo solto, sem projeto"}</small>
      </p>
      <div className={styles.sources}>
        {ORIGENS.map(({ id, curto, icon: Icon }) => (
          <Link key={id} href={novoVideoHref(id, escolha?.id ?? null)} className={styles.source}>
            <span className={styles.sourceIc}>
              <Icon size={20} strokeWidth={2} aria-hidden />
            </span>
            {curto}
          </Link>
        ))}
      </div>
      {projetos.length > 0 ? (
        <button type="button" className={styles.back} onClick={() => setEscolha(undefined)}>
          <ChevronLeft size={18} strokeWidth={2} aria-hidden />
          Trocar o projeto
        </button>
      ) : null}
    </div>
  );
}
