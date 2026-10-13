import { Button } from "@/components/ui/Button";

export default function Home() {
  return (
    <main style={{ padding: "var(--space-lg)", display: "grid", gap: "var(--space-md)" }}>
      <h1 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.05 }}>Gravaí</h1>
      <p>Do material ao post, num lugar só.</p>
      <Button variant="primary" href="/entrar">
        Começar
      </Button>
    </main>
  );
}
