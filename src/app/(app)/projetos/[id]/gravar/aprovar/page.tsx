import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ApproveButton, BlockList } from "@/components/record/BlockList";
import { Preview } from "@/components/record/Preview";
import styles from "@/components/record/record.module.css";
import scriptStyles from "@/components/script/script.module.css";
import { PhaseCards } from "@/components/review/PhaseCards";
import { Button } from "@/components/ui/Button";
import { projectCard, videoCard } from "@/lib/project/review-cards";
import { MissingAlert, NextBlockCard } from "@/components/record/MissingParts";
import { labelBlocks, missingBlocks, nextMissing } from "@/lib/record/missing";
import { canApprove, recordingsInOrder, type RecordMode } from "@/lib/record/rules";
import { getR2, r2Key } from "@/lib/storage/r2";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Aprovar · Gravaí" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODE_OF = { take: "take", block: "blocks", external: "external" } as const;

export default async function AprovarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gravacao?: string; dur?: string; feito?: string }>;
}) {
  const { id } = await params;
  const { gravacao, dur, feito } = await searchParams;
  if (!UUID.test(id)) notFound();

  const supabase = await createServerClient();
  const { data: project } = await supabase.from("projects").select("id, status, folder_id, folders(name, color)").eq("id", id).maybeSingle();
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
            kind={rec.kind as "take" | "block" | "external"}
            durationSeconds={Number.isFinite(seconds) && seconds >= 0 && seconds <= 600 ? Math.round(seconds) : null}
          />
        </main>
      );
    }
  }

  const [{ data: readyRows }, { data: blockRows }] = await Promise.all([
    supabase
      .from("recordings")
      .select("id, kind, block_id, storage_path, duration_seconds, created_at")
      .eq("project_id", id)
      .eq("status", "ready")
      .order("created_at", { ascending: false }),
    supabase.from("script_blocks").select("id, kind, cut_index").eq("project_id", id).order("position"),
  ]);
  const ready = readyRows ?? [];
  const folder = project.folders as unknown as { name: string; color: string } | null;
  const { count: folderVideos } = project.folder_id
    ? await supabase.from("projects").select("id", { count: "exact", head: true }).eq("folder_id", project.folder_id)
    : { count: 0 };
  const cards = <PhaseCards video={videoCard(ready, project.status)} project={projectCard(folder, folderVideos ?? 0)} />;
  const blocks = blockRows ?? [];

  const labels = labelBlocks(blocks);

  if (project.status === "gravado" || project.status === "pronto") {
    const clips = recordingsInOrder(
      ready.map((r) => ({ ...r, kind: r.kind as "take" | "block" | "external", blockId: r.block_id, createdAt: r.created_at })),
      labels,
    );
    const r2 = clips.length ? getR2() : null;
    const urlOf = new Map(
      await Promise.all(clips.map(async (c) => [c.storage_path, await r2!.presignGet(r2Key("recordings", c.storage_path), 300)] as const)),
    );
    return (
      <main className={styles.page}>
        {back}
        <h1 className={styles.title}>Suas gravações</h1>
        {cards}
        {clips.length === 0 ? <p className={styles.hint}>Não achei as gravações deste projeto.</p> : null}
        <ul className={styles.blocks}>
          {clips.map((c) => {
            const url = urlOf.get(c.storage_path);
            return (
              <li key={c.id} className={styles.clip}>
                <span className={styles.clipLabel}>{c.label}</span>
                {url ? (
                  <video className={styles.preview} src={url} controls playsInline preload="metadata" aria-label={`Gravação: ${c.label}`} />
                ) : (
                  <p className={styles.hint}>Não consegui abrir este vídeo agora. Recarregue a página.</p>
                )}
              </li>
            );
          })}
        </ul>
        <Button href={`/projetos/${id}/entrega`}>Gerar vídeos</Button>
        <Button href={`/projetos/${id}/gravar`} variant="soft">
          Gravar de novo
        </Button>
      </main>
    );
  }

  if (ready.length === 0) redirect(`/projetos/${id}/gravar`);

  const mode: RecordMode = MODE_OF[ready[0].kind as keyof typeof MODE_OF] ?? "take";
  const check = canApprove({
    mode,
    ready: ready.map((r) => ({ kind: r.kind as "take" | "block" | "external", blockId: r.block_id })),
    blockIds: blocks.map((b) => b.id),
    blockLabels: labels.map((l) => l.label),
  });

  const recorded = Object.fromEntries(ready.filter((r) => r.block_id).map((r) => [r.block_id as string, true]));
  const missing = mode === "blocks" ? missingBlocks(labels, recorded) : [];
  const justDone = feito && UUID.test(feito) ? feito : null;
  const next = justDone && missing.length > 0 ? nextMissing(labels, recorded, justDone) : null;

  return (
    <main className={styles.page}>
      {back}
      <h1 className={styles.title}>Aprovar</h1>
      {next ? <NextBlockCard projectId={id} next={next} /> : null}
      <MissingAlert projectId={id} missing={missing} />
      {cards}
      {mode === "blocks" ? (
        <div id="partes">
          <BlockList projectId={id} blocks={labels} recorded={recorded} />
        </div>
      ) : null}
      {mode === "blocks" && !check.ok ? (
        <p className={styles.hint}>Se o script mudou, grave de novo os blocos que ficaram sem vídeo.</p>
      ) : null}
      <ApproveButton projectId={id} mode={mode} blocked={check.ok ? null : check.error} />
    </main>
  );
}
