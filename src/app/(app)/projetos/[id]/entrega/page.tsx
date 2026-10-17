import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import styles from "@/components/record/record.module.css";
import { clock } from "@/components/script/format";
import scriptStyles from "@/components/script/script.module.css";
import { TrashMenu } from "@/components/trash/TrashMenu";
import { Button } from "@/components/ui/Button";
import { supabaseDeliveryDb } from "@/lib/delivery/db";
import { SIGNED_URL_SECONDS, needsRegeneration, type ExportRow } from "@/lib/delivery/service";
import { PLATFORM_LABELS, PLATFORMS } from "@/lib/interview/steps";
import { createServerClient } from "@/lib/supabase/server";
import { AdjustCut } from "./AdjustCut";
import { CutCard, type CardFile } from "./CutCard";
import entrega from "./entrega.module.css";
import { JobPanel } from "./JobProgress";
import { RegenerateButton } from "./RegenerateButton";
import { ZipButton } from "./ZipButton";

export const metadata: Metadata = { title: "Entrega · Gravaí" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EntregaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createServerClient();
  const db = supabaseDeliveryDb({ supabase });
  const project = await db.project(id);
  if (!project) notFound();
  if (project.status !== "gravado" && project.status !== "pronto") redirect(`/projetos/${id}/gravar`);

  const [job, exports, cuts] = await Promise.all([db.latestJob(id), db.exportsOf(id), db.cuts(id)]);
  const generating = job?.status === "queued" || job?.status === "running";
  // Refazer um corte não esconde os vídeos que já existem; só gerar tudo de novo esconde.
  const recutting = generating && job?.kind === "recut" && exports.length > 0;
  const ready = exports.length > 0 && (!generating || recutting);

  const files = new Map<string, CardFile>();
  if (ready) {
    await Promise.all(
      exports.map(async (e: ExportRow) => files.set(e.id, { id: e.id, url: await db.signUrl(e.storagePath, SIGNED_URL_SECONDS, null) })),
    );
  }
  const find = (kind: ExportRow["kind"], cutId: string | null) => exports.find((e) => e.kind === kind && e.cutId === cutId);
  const final = find("final", null);
  const stale =
    ready && !generating && final?.createdAt
      ? needsRegeneration(new Date(final.createdAt), await db.latestRecordingAt(id), project.scriptStale)
      : false;

  return (
    <main className={styles.page}>
      <nav className={scriptStyles.nav}>
        <Button href={`/projetos/${id}/gravar/aprovar`} variant="soft" icon={ArrowLeft}>
          Voltar
        </Button>
        <TrashMenu kind="video" id={id} title="este vídeo" then="/projetos" />
      </nav>
      <h1 className={styles.title}>{ready ? "Seus vídeos estão prontos." : "Gerar vídeos"}</h1>
      {ready ? null : (
        <p className={styles.hint}>Montamos o vídeo final e um vídeo para cada corte. Leva alguns minutos.</p>
      )}
      {recutting ? <JobPanel projectId={id} initial={job} /> : null}
      {ready && job?.status === "failed" ? (
        <p className={styles.alert} role="alert">
          {job.error ?? "Não foi possível gerar os vídeos."}
        </p>
      ) : null}
      {stale ? <RegenerateButton projectId={id} /> : null}
      {ready ? <ZipButton projectId={id} /> : null}
      {ready ? (
        <ul className={entrega.list}>
          {final ? (
            <CutCard
              projectId={id}
              title="Vídeo final"
              meta={final.durationSeconds ? clock(final.durationSeconds) : ""}
              video={files.get(final.id)!}
              cover={null}
              descriptions={[]}
            />
          ) : null}
          {cuts.flatMap((cut, i) => {
            const video = find("cut", cut.id);
            if (!video) return [];
            const cover = find("cover", cut.id);
            return [
              <CutCard
                key={cut.id}
                projectId={id}
                title={`Corte ${i + 1}${cut.title ? ` · ${cut.title}` : ""}`}
                meta={video.durationSeconds ? clock(video.durationSeconds) : ""}
                video={files.get(video.id)!}
                cover={cover ? files.get(cover.id)! : null}
                adjust={
                  final?.durationSeconds && !generating ? (
                    <AdjustCut
                      key={`${video.id}`}
                      projectId={id}
                      cutId={cut.id}
                      title={`corte ${i + 1}`}
                      finalUrl={files.get(final.id)!.url}
                      duration={final.durationSeconds}
                      start={video.startSeconds ?? 0}
                      end={video.endSeconds ?? video.durationSeconds ?? 0}
                    />
                  ) : null
                }
                descriptions={PLATFORMS.filter((p) => cut.descriptions[p]).map((p) => ({ platform: PLATFORM_LABELS[p], text: cut.descriptions[p]! }))}
              />,
            ];
          })}
        </ul>
      ) : (
        <JobPanel projectId={id} initial={job} />
      )}
    </main>
  );
}
