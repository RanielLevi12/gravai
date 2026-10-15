const API = "https://api.machines.dev/v1";

/**
 * Liga as máquinas paradas do worker no Fly. Sem FLY_API_TOKEN/FLY_APP (dev local) não faz nada.
 * Nunca lança: o pedido já está na fila e o worker o pega quando acordar.
 */
export async function wakeWorker(): Promise<void> {
  const token = process.env.FLY_API_TOKEN;
  const app = process.env.FLY_APP;
  if (!token || !app) return;
  const headers = { Authorization: `Bearer ${token}` };
  try {
    const list = await fetch(`${API}/apps/${encodeURIComponent(app)}/machines`, { headers, signal: AbortSignal.timeout(5000) });
    if (!list.ok) return;
    const machines = (await list.json()) as { id: string; state: string }[];
    await Promise.all(
      machines
        .filter((m) => m.state === "stopped")
        .map((m) =>
          fetch(`${API}/apps/${encodeURIComponent(app)}/machines/${encodeURIComponent(m.id)}/start`, {
            method: "POST",
            headers,
            signal: AbortSignal.timeout(5000),
          }),
        ),
    );
  } catch (e) {
    console.error("[delivery] não consegui ligar o worker", e instanceof Error ? e.message : e);
  }
}
