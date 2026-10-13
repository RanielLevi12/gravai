"use client";

import { ArrowLeft, CircleCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import flow from "@/components/project/flow.module.css";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { saveSource } from "@/lib/project/actions";
import { formatMaxVideo, formatWords, MAX_SOURCE_CHARS } from "@/lib/project/source";
import styles from "./fonte.module.css";

/** Texto-fonte (wireframe texto-fonte): confere e corrige o texto extraído antes da entrevista. */
export function SourceReview({ projectId, initialText, truncated }: { projectId: string; initialText: string; truncated: boolean }) {
  const router = useRouter();
  const [texto, setTexto] = useState(initialText);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const emAndamento = useRef(false);
  const vazio = texto.trim() === "";

  async function continuar() {
    if (vazio || emAndamento.current) return;
    emAndamento.current = true;
    setPendente(true);
    setErro(null);
    try {
      const r = await saveSource(projectId, texto);
      if (r.ok) {
        router.push(r.href);
        return;
      }
      setErro(r.error);
    } catch {
      setErro("Não foi possível salvar agora. Tente de novo.");
    }
    emAndamento.current = false;
    setPendente(false);
  }

  return (
    <main className={flow.page}>
      <nav className={flow.nav}>
        <Link href="/projetos" className={flow.back}>
          <ArrowLeft size={20} strokeWidth={2} aria-hidden />
          Voltar
        </Link>
        <h1 className={flow.navTitle}>Seu conteúdo</h1>
        <span />
      </nav>
      <form
        className={flow.body}
        onSubmit={(e) => {
          e.preventDefault();
          void continuar();
        }}
      >
        <div className={styles.head}>
          <p className={styles.ok}>
            <CircleCheck size={20} strokeWidth={2} aria-hidden />
            Texto extraído
          </p>
          <p className={flow.lead}>Confira e corrija se precisar.</p>
        </div>
        {truncated ? (
          <p className={styles.notice} role="note">
            Usamos só o início do arquivo (60 mil caracteres).
          </p>
        ) : null}
        <Field
          label="Texto do vídeo"
          multiline
          rows={14}
          value={texto}
          maxLength={MAX_SOURCE_CHARS}
          onChange={(e) => setTexto(e.target.value)}
          hint={`${formatWords(texto)} · ${formatMaxVideo(texto)}`}
          className={styles.textarea}
        />
        {erro ? (
          <p role="alert" className={flow.alert}>
            {erro}
          </p>
        ) : null}
        <div className={flow.actions}>
          <Button type="submit" className={flow.full} disabled={vazio || pendente}>
            Continuar
          </Button>
        </div>
      </form>
    </main>
  );
}
