import type { Metadata } from "next";

export const metadata: Metadata = { title: "Projetos · Gravaí" };

// Esqueleto: a lista de projetos chega na Tarefa 4.
export default function ProjetosPage() {
  return (
    <main style={{ padding: "var(--space-xl) var(--space-lg)", display: "grid", gap: "var(--space-sm)" }}>
      <h1 className="display">Projetos</h1>
      <p style={{ margin: 0, color: "var(--ink-2)" }}>Seus vídeos aparecem aqui. Toque em + para começar o primeiro.</p>
    </main>
  );
}
