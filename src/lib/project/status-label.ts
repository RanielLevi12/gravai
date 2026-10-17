/** Status legível do vídeo na tela inicial: só três palavras, para o leigo saber o que fazer. */
export type StatusLabel = { label: "Gravar" | "Editar" | "Pronto"; hint: string };

export function statusLabel(status: string, missingParts: number | null = null): StatusLabel {
  switch (status) {
    case "gravacao":
      if (missingParts !== null && missingParts > 0) {
        return { label: "Gravar", hint: missingParts === 1 ? "Falta 1 parte para gravar" : `Faltam ${missingParts} partes para gravar` };
      }
      return { label: "Gravar", hint: "Script pronto, falta gravar" };
    case "pronto":
      return { label: "Pronto", hint: "Vídeos prontos para baixar" };
    case "gravado":
      return { label: "Editar", hint: "Gravado, falta gerar os vídeos" };
    case "script":
      return { label: "Editar", hint: "Revise o script" };
    default:
      return { label: "Editar", hint: "Falta terminar o roteiro" };
  }
}

/** Link de "Criar vídeo": origem e, se houver, o projeto (a tela /novo já lê `projeto`). */
export function novoVideoHref(origem: string, projetoId: string | null): string {
  const q = new URLSearchParams({ origem });
  if (projetoId) q.set("projeto", projetoId);
  return `/novo?${q.toString()}`;
}
