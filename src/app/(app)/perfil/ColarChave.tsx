"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { connectWithKey } from "@/lib/ai/actions";
import styles from "./perfil.module.css";

/** Opção discreta: quem já tem uma chave do OpenRouter cola aqui em vez de usar o botão "Conectar". */
export function ColarChave() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await connectWithKey(key);
      if (!r.ok) {
        setError(r.error);
      } else {
        setKey("");
        router.replace("/perfil?ia=conectada");
        router.refresh();
      }
    } catch {
      setError("Não foi possível conectar agora. Tente de novo.");
    }
    setBusy(false);
  }

  return (
    <details className={styles.colar}>
      <summary>Prefiro colar minha chave</summary>
      <form onSubmit={submit} className={styles.colarForm}>
        <Field
          label="Chave do OpenRouter"
          hint="Crie em openrouter.ai › Keys e cole aqui. Ela fica guardada cifrada e não aparece mais na tela."
          type="password"
          name="openrouter-key"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        {error ? (
          <p role="alert" className={styles.avisoErro}>
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="soft" disabled={busy || key.trim() === ""} aria-busy={busy}>
          {busy ? "Conferindo…" : "Conectar com esta chave"}
        </Button>
      </form>
    </details>
  );
}
