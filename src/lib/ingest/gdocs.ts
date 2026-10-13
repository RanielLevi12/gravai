import { IngestError } from "./text";

const INVALID = "Link do Google Docs inválido. Cole o endereço completo do documento.";
const PRIVATE = "Esse documento não está público. No Google Docs, use Compartilhar → Qualquer pessoa com o link.";

export async function extractGdocs(url: string | undefined): Promise<string> {
  const id = /^https:\/\/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]+)/.exec((url ?? "").trim())?.[1];
  if (!id) throw new IngestError(INVALID);
  let res: Response;
  try {
    res = await fetch(`https://docs.google.com/document/d/${id}/export?format=txt`, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new IngestError("Não consegui acessar o Google Docs agora. Tente de novo.");
  }
  const body = res.ok ? await res.text() : "";
  const looksHtml = /text\/html/i.test(res.headers.get("content-type") ?? "") || /^\s*<(!doctype|html)/i.test(body);
  if (!res.ok || looksHtml) throw new IngestError(PRIVATE);
  return body;
}
