import { createClient } from "@supabase/supabase-js";
import { claimJob, requeueStale } from "./claim";
import { handle } from "./jobs";
import { purgeTrash, sweepOrphans } from "./purge";

const POLL_MS = 5_000;
// 0 (padrão) = fica ligado esperando pedidos (VPS); >0 = sai após esse tempo ocioso (máquinas que ligam sob demanda).
const IDLE_EXIT_MS = Number(process.env.WORKER_IDLE_EXIT_MS ?? 0);
const PURGE_EVERY_MS = 3_600_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta a variável ${name}`);
  return v;
}

async function main() {
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  let idleSince = Date.now();
  let lastPurge = 0; // limpa logo ao ligar e depois no máximo 1 vez por hora
  for (;;) {
    if (Date.now() - lastPurge > PURGE_EVERY_MS) {
      lastPurge = Date.now();
      await sweepOrphans(db).then((n) => n > 0 && console.log(`[worker] ${n} arquivos órfãos apagados`)).catch((e) => console.error("[worker] limpeza falhou:", e.message));
      await purgeTrash(db)
        .then((n) => (n.videos > 0 || n.folders > 0) && console.log(`[worker] lixeira: ${n.videos} vídeo(s) e ${n.folders} projeto(s) apagados de vez`))
        .catch((e) => console.error("[worker] limpeza da lixeira falhou:", e.message));
    }
    await requeueStale(db);
    const job = await claimJob(db);
    if (job) {
      await handle(db, job);
      idleSince = Date.now();
      continue;
    }
    if (IDLE_EXIT_MS > 0 && Date.now() - idleSince > IDLE_EXIT_MS) break; // sem trabalho: sai e a máquina desliga
    await sleep(POLL_MS);
  }
}

main().catch((e) => {
  console.error("[worker] parou:", e instanceof Error ? e.message : e);
  process.exit(1);
});
