import { createClient } from "@supabase/supabase-js";
import { claimJob, requeueStale } from "./claim";
import { handle } from "./jobs";

const POLL_MS = 5_000;
const IDLE_EXIT_MS = 60_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta a variável ${name}`);
  return v;
}

async function main() {
  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  let idleSince = Date.now();
  for (;;) {
    await requeueStale(db);
    const job = await claimJob(db);
    if (job) {
      await handle(db, job);
      idleSince = Date.now();
      continue;
    }
    if (Date.now() - idleSince > IDLE_EXIT_MS) break; // sem trabalho: a máquina do Fly desliga
    await sleep(POLL_MS);
  }
}

main().catch((e) => {
  console.error("[worker] parou:", e instanceof Error ? e.message : e);
  process.exit(1);
});
