"use client";

import { Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { createBrowserClient } from "@/lib/supabase/client";
import styles from "./entrar.module.css";

type Estado =
  | { fase: "pedindo" }
  | { fase: "enviando" }
  | { fase: "enviado"; email: string; verificando?: boolean; erro?: string }
  | { fase: "erro"; mensagem: string };

function mensagemDeErro(message: string) {
  if (/rate limit|too many|seconds/i.test(message)) return "Muitos pedidos seguidos. Espere um minuto e tente de novo.";
  if (/invalid/i.test(message) && /email/i.test(message)) return "Confira o e-mail digitado.";
  return "Não foi possível enviar o código agora. Tente de novo.";
}

export function EntrarForm() {
  const [estado, setEstado] = useState<Estado>({ fase: "pedindo" });
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const redirectTo = () => `${window.location.origin}/auth/callback`;

  async function receberLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const endereco = email.trim();
    setEstado({ fase: "enviando" });
    const { error } = await createBrowserClient().auth.signInWithOtp({
      email: endereco,
      options: { emailRedirectTo: redirectTo() },
    });
    setEstado(error ? { fase: "erro", mensagem: mensagemDeErro(error.message) } : { fase: "enviado", email: endereco });
  }

  async function entrarComCodigo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (estado.fase !== "enviado") return;
    const { email: endereco } = estado;
    setEstado({ fase: "enviado", email: endereco, verificando: true });
    const { error } = await createBrowserClient().auth.verifyOtp({ email: endereco, token: codigo.trim(), type: "email" });
    if (error) {
      setEstado({ fase: "enviado", email: endereco, erro: "Código errado ou vencido. Confira ou peça outro." });
      return;
    }
    window.location.assign("/projetos");
  }

  if (estado.fase === "enviado") {
    return (
      <section className={styles.sent} aria-live="polite">
        <Mail size={32} strokeWidth={2} aria-hidden />
        <h2 className={styles.sentTitle}>Confira seu e-mail</h2>
        <p>
          Enviamos um código para <strong>{estado.email}</strong>. Digite abaixo, aqui ou em qualquer aparelho.
        </p>
        <form onSubmit={entrarComCodigo} className={styles.mail}>
          <Field
            label="Código do e-mail"
            name="codigo"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6,8}"
            maxLength={8}
            placeholder="123456"
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          />
          {estado.erro ? (
            <p role="alert" className={styles.alert}>
              {estado.erro}
            </p>
          ) : null}
          <Button type="submit" disabled={estado.verificando || codigo.length < 6}>
            {estado.verificando ? "Entrando…" : "Entrar"}
          </Button>
        </form>
        <Button
          variant="soft"
          onClick={() => {
            setCodigo("");
            setEstado({ fase: "pedindo" });
          }}
        >
          Usar outro e-mail
        </Button>
      </section>
    );
  }

  return (
    <div className={styles.form}>
      <form onSubmit={receberLink} className={styles.mail}>
        <Field
          label="E-mail"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="seu@email.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {estado.fase === "erro" ? (
          <p role="alert" className={styles.alert}>
            {estado.mensagem}
          </p>
        ) : null}
        <Button type="submit" disabled={estado.fase === "enviando"}>
          {estado.fase === "enviando" ? "Enviando…" : "Receber código de acesso"}
        </Button>
        <p className={styles.hint}>Sem senha. Já tem conta? O mesmo botão serve.</p>
      </form>
    </div>
  );
}
