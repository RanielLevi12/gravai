import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TeleprompterScreen } from "@/components/record/TeleprompterScreen";
import { blockLabel } from "@/components/script/format";
import { allowedModes } from "@/lib/record/rules";
import type { BlockKind } from "@/lib/script/generate";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Gravando · Gravaí" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TeleprompterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ modo?: string; bloco?: string }>;
}) {
  const { id } = await params;
  const { modo: modoParam, bloco } = await searchParams;
  if (!UUID.test(id)) notFound();
  const modo = modoParam === "blocos" ? "blocos" : "take";

  const supabase = await createServerClient();
  const { data: project } = await supabase.from("projects").select("id, interview").eq("id", id).maybeSingle();
  if (!project) notFound();

  const mainSeconds = (project.interview as { mainSeconds?: number } | null)?.mainSeconds ?? 60;
  if (modo === "take" && !allowedModes(mainSeconds).includes("take")) redirect(`/projetos/${id}/gravar`);

  const { data: rows } = await supabase
    .from("script_blocks")
    .select("id, kind, cut_index, text, position")
    .eq("project_id", id)
    .order("position");
  const blocks = rows ?? [];
  if (blocks.length === 0) redirect(`/projetos/${id}/script`);

  if (modo === "take") {
    return (
      <TeleprompterScreen
        projectId={id}
        modo="take"
        blockId={null}
        text={blocks.map((b) => b.text).join("\n\n")}
        heading={null}
      />
    );
  }

  // Por blocos: o bloco pedido; sem pedido, o primeiro que ainda não tem vídeo pronto.
  let current = bloco && UUID.test(bloco) ? blocks.find((b) => b.id === bloco) : undefined;
  if (!current) {
    const { data: done } = await supabase.from("recordings").select("block_id").eq("project_id", id).eq("status", "ready");
    const doneIds = new Set((done ?? []).map((r) => r.block_id));
    current = blocks.find((b) => !doneIds.has(b.id)) ?? blocks[0];
  }
  const index = blocks.findIndex((b) => b.id === current.id);
  const labelOf = (b: (typeof blocks)[number], k: number) => {
    if (b.kind === "body") return `Trecho ${blocks.slice(0, k + 1).filter((x) => x.kind === "body").length}`;
    return blockLabel(b.kind as BlockKind, b.cut_index);
  };

  return (
    <TeleprompterScreen
      projectId={id}
      modo="blocos"
      blockId={current.id}
      text={current.text}
      heading={`${labelOf(current, index)} · bloco ${index + 1} de ${blocks.length}`}
    />
  );
}
