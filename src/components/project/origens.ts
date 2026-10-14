import { Camera, FileText, FileUp, Link2, Mic, Type, type LucideIcon } from "lucide-react";

/** Atalhos de origem do conteúdo, na ordem de design/telas.html. */
export const ORIGENS = [
  { id: "foto", curto: "Foto", titulo: "Fotografar página", dica: "Câmera · várias páginas seguidas", icon: Camera },
  { id: "texto", curto: "Texto", titulo: "Colar texto", dica: "Copie de onde estiver e cole aqui", icon: Type },
  { id: "arquivo", curto: "Arquivo", titulo: "Enviar arquivo", dica: "PDF, Word, PowerPoint, imagem, TXT", icon: FileUp },
  { id: "link", curto: "Link", titulo: "Link do Google Docs", dica: "Documento compartilhado", icon: Link2 },
  { id: "audio", curto: "Áudio", titulo: "Gravar ou enviar áudio", dica: "Fale sua ideia, a gente transcreve", icon: Mic },
] as const satisfies readonly { id: string; curto: string; titulo: string; dica: string; icon: LucideIcon }[];

export type OrigemId = (typeof ORIGENS)[number]["id"];

export function isOrigem(v: unknown): v is OrigemId {
  return ORIGENS.some((o) => o.id === v);
}

/** Ícone e nome da origem salva no projeto (source_kind). */
export function origemDoProjeto(kind: string): { icon: LucideIcon; nome: string } {
  switch (kind) {
    case "images":
      return { icon: Camera, nome: "fotos" };
    case "audio":
      return { icon: Mic, nome: "áudio" };
    case "gdocs":
      return { icon: Link2, nome: "Google Docs" };
    case "text":
      return { icon: Type, nome: "texto colado" };
    default:
      return { icon: FileText, nome: "arquivo" };
  }
}
