"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ChipOption } from "@/components/ui/Chip";
import { Field } from "@/components/ui/Field";
import { saveCtas, saveProfile } from "@/lib/profile/actions";
import { normalizeCtas, TONE_LABELS, TONES, ValidationError, type CtaInput, type Tone } from "@/lib/profile/schema";
import styles from "./passos.module.css";

function Passo({
  etapa,
  titulo,
  voltar,
  onSubmit,
  erro,
  children,
  acoes,
}: {
  etapa: string;
  titulo: string;
  voltar: string | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  erro: string | null;
  children: ReactNode;
  acoes: ReactNode;
}) {
  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        {voltar ? (
          <Link href={voltar} className={styles.back}>
            <ArrowLeft size={20} strokeWidth={2} aria-hidden />
            Voltar
          </Link>
        ) : (
          <span />
        )}
        <span className={styles.navTitle}>Perfil</span>
        <span />
      </nav>
      <form onSubmit={onSubmit} className={styles.form}>
        <p className={styles.etapa}>{etapa}</p>
        <h1 className="display">{titulo}</h1>
        <div className={styles.fields}>{children}</div>
        {erro ? (
          <p role="alert" className={styles.alert}>
            {erro}
          </p>
        ) : null}
        <div className={styles.actions}>{acoes}</div>
      </form>
    </main>
  );
}

/** Executa a gravação e navega; mostra a mensagem de erro (validação ou servidor) se falhar. */
function useSalvar(destino: string) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function salvar(trabalho: () => Promise<void>) {
    setErro(null);
    iniciar(async () => {
      try {
        await trabalho();
        router.push(destino);
      } catch (e) {
        setErro(e instanceof ValidationError ? e.message : "Não foi possível salvar agora. Tente de novo.");
      }
    });
  }
  return { salvar, pendente, erro };
}

export function NichoStep({ editando, niche, audience }: { editando: boolean; niche: string; audience: string }) {
  const { salvar, pendente, erro } = useSalvar(editando ? "/perfil" : "/boas-vindas/tom");
  const pular = useSalvar("/projetos");

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    salvar(() =>
      saveProfile({ niche: String(dados.get("niche") ?? ""), audience: String(dados.get("audience") ?? "") }),
    );
  }

  return (
    <Passo
      etapa="1 de 3 · Sobre você"
      titulo="Sobre o que você fala?"
      voltar={editando ? "/perfil" : null}
      onSubmit={enviar}
      erro={erro ?? pular.erro}
      acoes={
        <>
          <Button type="submit" disabled={pendente || pular.pendente}>
            {editando ? "Salvar" : "Continuar"}
          </Button>
          {editando ? null : (
            <Button
              variant="soft"
              disabled={pendente || pular.pendente}
              onClick={() => pular.salvar(() => saveProfile({ onboarded: true }))}
            >
              Pular por agora
            </Button>
          )}
        </>
      }
    >
      <Field
        label="Seu assunto"
        name="niche"
        defaultValue={niche}
        maxLength={120}
        placeholder="Ex.: finanças pessoais, fé, nutrição…"
      />
      <Field
        label="Para quem?"
        name="audience"
        defaultValue={audience}
        maxLength={120}
        placeholder="Ex.: mães que trabalham fora"
      />
    </Passo>
  );
}

export function TomStep({ editando, tone, phrases }: { editando: boolean; tone?: Tone; phrases: string }) {
  const { salvar, pendente, erro } = useSalvar(editando ? "/perfil" : "/boas-vindas/cta");

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const escolhido = dados.get("tom");
    salvar(() =>
      saveProfile({
        tone: typeof escolhido === "string" ? (escolhido as Tone) : undefined,
        phrases: String(dados.get("phrases") ?? ""),
      }),
    );
  }

  return (
    <Passo
      etapa="2 de 3 · Seu jeito de falar"
      titulo="Como você fala nos vídeos?"
      voltar={editando ? "/perfil" : "/boas-vindas/nicho"}
      onSubmit={enviar}
      erro={erro}
      acoes={
        <Button type="submit" disabled={pendente}>
          {editando ? "Salvar" : "Continuar"}
        </Button>
      }
    >
      <div role="radiogroup" aria-label="Tom de voz" className={styles.chips}>
        {TONES.map((t) => (
          <ChipOption key={t} name="tom" value={t} defaultChecked={t === tone}>
            {TONE_LABELS[t]}
          </ChipOption>
        ))}
      </div>
      <Field
        multiline
        label="Frases que você costuma usar (opcional)"
        name="phrases"
        defaultValue={phrases}
        maxLength={500}
        placeholder={'"Fala, pessoal!" · "Bora pro conteúdo"'}
      />
    </Passo>
  );
}

export function CtaStep({
  editando,
  link,
  whatsapp,
  bio,
  phone,
}: {
  editando: boolean;
  link: string;
  whatsapp: string;
  bio: string;
  phone: string;
}) {
  const { salvar, pendente, erro } = useSalvar(editando ? "/perfil" : "/projetos");

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const campo = (nome: string) => String(dados.get(nome) ?? "").trim();
    const candidatos: { kind: CtaInput["kind"]; value: string }[] = [
      { kind: "link", value: campo("link") },
      { kind: "whatsapp", value: campo("whatsapp") },
      { kind: "bio", value: campo("bio") },
      { kind: "phone", value: campo("phone") },
    ];
    salvar(async () => {
      const ctas = normalizeCtas(candidatos.filter((c) => c.value !== "").map((c) => ({ ...c, label: "" })));
      await saveCtas(ctas);
      if (!editando) await saveProfile({ onboarded: true });
    });
  }

  return (
    <Passo
      etapa="3 de 3 · Para onde mandar o público"
      titulo="Seus links (opcional)"
      voltar={editando ? "/perfil" : "/boas-vindas/tom"}
      onSubmit={enviar}
      erro={erro}
      acoes={
        <Button type="submit" disabled={pendente}>
          {editando ? "Salvar" : "Concluir"}
        </Button>
      }
    >
      <Field label="Link (site, loja, curso)" name="link" defaultValue={link} inputMode="url" autoCapitalize="none" placeholder="gravai.app/loja" />
      <Field label="WhatsApp" name="whatsapp" defaultValue={whatsapp} type="tel" inputMode="tel" placeholder="11 99999-0000" />
      <Field label="@ do Instagram (bio)" name="bio" defaultValue={bio} autoCapitalize="none" placeholder="@seuperfil" />
      <Field label="Telefone" name="phone" defaultValue={phone} type="tel" inputMode="tel" placeholder="11 3333-0000" />
      <p className={styles.hint}>Você escolhe qual usar em cada vídeo.</p>
    </Passo>
  );
}
