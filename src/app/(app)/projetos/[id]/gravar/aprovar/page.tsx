import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ApproveButton, BlockList } from "@/components/record/BlockList";
import { Preview } from "@/components/record/Preview";
import styles from "@/components/record/record.module.css";
import { blockLabel, clock } from "@/components/script/format";
import scriptStyles from "@/components/script/script.module.css";
import { Button } from "@/components/ui/Button";
import { canApprove, type RecordMode } from "@/lib/record/rules";
import type { BlockKind } from "@/lib/script/generate";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Aprovar · Gravaí" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODE_OF = { take: "take", block: "blocks", external: "external" } as const;

export default async function AprovarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gravacao?: string; dur?: string }>;
}) {
  const { id } = await params;
  const { gravacao, dur } = await searchParams;
  if (!UUID.test(id)) notFound();

  const supabase = await createServerClient();
  const { data: project } = await supabase.from("projects").select("id, status").eq("id", id).maybeSingle();
  if (!project) notFound();

  const back = (
    <nav className={scriptStyles.nav}>
      <Button href={`/projetos/${id}/gravar`} variant="soft" icon={ArrowLeft}>
        Voltar
      </Button>
    </nav>
  );

  // Acabou de gravar: prévia do que está no aparelho.
  if (gravacao && UUID.test(gravacao)) {
    const { data: rec } = await supabase
      .from("recordings")
      .select("id, kind, block_id, storage_path, mime, status")
      .eq("id", gravacao)
      .eq("project_id", id)
      .maybeSingle();
    if (rec && rec.status === "uploading") {
      const seconds = Number(dur);
      return (
        <main className={styles.page}>
          {back}
          <h1 className={styles.title}>Prévia</h1>
          <Preview
            projectId={id}
            recordingId={rec.id}
            path={rec.storage_path}
            mime={rec.mime}
            blockId={rec.block_id}
            durationSeconds={Number.isFinite(seconds) && seconds >= 0 && seconds <= 600 ? Math.round(seconds) : null}
          />
        </main>
      );
    }
  }

  if (project.status === "gravado" || project.status === "pronto") {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Seu vídeo está guardado.</h1>
        <p className={styles.hint}>Cortes e entrega chegam na próxima versão.</p>
        <Button href="/projetos">Ir para Projetos</Button>
      </main>
    );
  }

  const [{ data: readyRows }, { data: blockRows }] = await Promise.all([
    supabase
      .from("recordings")
      .select("kind, block_id, duration_seconds, created_at")
      .eq("project_id", id)
      .eq("status", "ready")
      .order("created_at", { ascending: false }),
    supabase.from("script_blocks").select("id, kind, cut_index").eq("project_id", id).order("position"),
  ]);
  const ready = readyRows ?? [];
  const blocks = blockRows ?? [];
  if (ready.length === 0) redirect(`/projetos/${id}/gravar`);

  const mode: RecordMode = MODE_OF[ready[0].kind as keyof typeof MODE_OF] ?? "take";
  const check = canApprove({
    mode,
    ready: ready.map((r) => ({ kind: r.kind as "take" | "block" | "external", blockId: r.block_id })),
    blockIds: blocks.map((b) => b.id),
  });
  const total = ready.reduce((sum, r) => sum + Number(r.duration_seconds ?? 0), 0);

  let bodyIndex = 0;
  const labels = blocks.map((b) => {
    if (b.kind === "body") bodyIndex += 1;
    return { id: b.id, label: b.kind === "body" ? `Trecho ${bodyIndex}` : blockLabel(b.kind as BlockKind, b.cut_index) };
  });
  const recorded = Object.fromEntries(ready.filter((r) => r.block_id).map((r) => [r.block_id as string, true]));

  return (
    <main className={styles.page}>
      {back}
      <h1 className={styles.title}>Aprovar</h1>
      <p className={styles.hint}>
        {ready.length === 1 ? "1 gravação" : `${ready.length} gravações`}
        {total > 0 ? ` · ${clock(total)} no total` : ""}
      </p>
      {mode === "blocks" ? <BlockList projectId={id} blocks={labels} recorded={recorded} /> : null}
      {mode === "blocks" && !check.ok ? (
        <p className={styles.hint}>Se o script mudou, grave de novo os blocos que ficaram sem vídeo.</p>
      ) : null}
      <ApproveButton projectId={id} mode={mode} blocked={check.ok ? null : check.error} />
    </main>
  );
}
