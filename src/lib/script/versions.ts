/** Histórico de versões de um trecho do script (volta ao texto de antes da última reescrita). Banco abstrato. */
export const MAX_VERSIONS = 10;

export interface VersionDb {
  /** Textos guardados do trecho, do mais novo para o mais antigo. */
  list(blockId: string): Promise<string[]>;
  push(blockId: string, text: string): Promise<boolean>;
  /** Tira e devolve a versão mais nova; null se não há. */
  popLatest(blockId: string): Promise<string | null>;
  /** Apaga as mais antigas, deixando só as `keep` mais novas. */
  trim(blockId: string, keep: number): Promise<void>;
  clearProject(projectId: string): Promise<void>;
}

/** Guarda o texto de antes de mudar. Texto vazio ou igual à última versão não vira versão nova. */
export async function saveVersionWith(db: VersionDb, blockId: string, text: unknown): Promise<boolean> {
  if (typeof text !== "string" || text.trim() === "" || text.length > 6000) return false;
  const [latest] = await db.list(blockId);
  if (latest === text) return true;
  if (!(await db.push(blockId, text))) return false;
  await db.trim(blockId, MAX_VERSIONS);
  return true;
}

/** Devolve o texto da versão anterior e a tira do histórico; null se não há versão. */
export async function restoreVersionWith(db: VersionDb, blockId: string): Promise<string | null> {
  return db.popLatest(blockId);
}

/** O mesmo empilhar/desempilhar, em memória, para a tela (a lista em estado do React). */
export function pushLocal(stack: string[], text: string): string[] {
  if (text.trim() === "" || stack[0] === text) return stack;
  return [text, ...stack].slice(0, MAX_VERSIONS);
}
