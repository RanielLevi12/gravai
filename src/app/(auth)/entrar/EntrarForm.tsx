"use client";

import { Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { createBrowserClient } from "@/lib/supabase/client";
import styles from "./entrar.module.css";

type Estado = { fase: "pedindo" } | { fase: "enviando" } | { fase: "enviado"; email: string } | { fase: "erro"; mensagem: string };

function mensagemDeErro(message: string) {
  if (/rate limit|too many|seconds/i.test(message)) return "Muitos pedidos seguidos. Espere um minuto e tente de novo.";
  if (/invalid/i.test(message) && /email/i.test(message)) return "Confira o e-mail digitado.";
  return "Não foi possível enviar o link agora. Tente de novo.";
}

export function EntrarForm() {
  const [estado, setEstado] = useState<Estado>({ fase: "pedindo" });
  const [email, setEmail] = useState("");
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

  async function entrarComGoogle() {
    const { error } = await createBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (error) setEstado({ fase: "erro", mensagem: "Não foi possível entrar com o Google agora. Tente com o e-mail." });
  }

  if (estado.fase === "enviado") {
    return (
      <section className={styles.sent} aria-live="polite">
        <Mail size={32} strokeWidth={2} aria-hidden />
        <h2 className={styles.sentTitle}>Confira seu e-mail</h2>
        <p>
          Enviamos o link para <strong>{estado.email}</strong>. Abra neste aparelho e toque no link para entrar.
        </p>
        <Button variant="soft" onClick={() => setEstado({ fase: "pedindo" })}>
          Usar outro e-mail
        </Button>
      </section>
    );
  }

  return (
    <div className={styles.form}>
      <Button variant="soft" onClick={entrarComGoogle}>
        Entrar com Google
      </Button>
      <p className={styles.or} aria-hidden>
        ou
      </p>
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
          {estado.fase === "enviando" ? "Enviando…" : "Receber link de acesso"}
        </Button>
        <p className={styles.hint}>Sem senha. Já tem conta? O mesmo botão serve.</p>
      </form>
    </div>
  );
}
