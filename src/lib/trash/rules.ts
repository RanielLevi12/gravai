/** Quantos dias um item fica na lixeira antes de ser apagado de vez. */
export const TRASH_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type TrashKind = "video" | "projeto";

/** Instante em que o item passa a poder ser apagado de vez. */
export function purgeAt(deletedAt: string | Date): Date {
  return new Date(new Date(deletedAt).getTime() + TRASH_DAYS * DAY_MS);
}

/** Dias que faltam (arredondado para cima: "1 dia" até o último minuto). Nunca negativo. */
export function daysLeft(deletedAt: string | Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((purgeAt(deletedAt).getTime() - now.getTime()) / DAY_MS));
}

export function daysLeftText(deletedAt: string | Date, now: Date = new Date()): string {
  const n = daysLeft(deletedAt, now);
  if (n === 0) return "Será apagado hoje";
  return n === 1 ? "Falta 1 dia" : `Faltam ${n} dias`;
}

/** Data de corte: o que foi para a lixeira antes dela já passou dos 7 dias. */
export function purgeCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - TRASH_DAYS * DAY_MS);
}

type TrashedVideo = { id: string; deleted_at: string; folder_id: string | null };
type TrashedFolder = { id: string; deleted_at: string };

/**
 * Vídeos que aparecem soltos na lixeira. Os que foram junto com o projeto (mesmo `deleted_at`) ficam
 * dentro dele: restaurar o projeto já os traz de volta.
 */
export function standaloneVideos<V extends TrashedVideo>(videos: V[], folders: TrashedFolder[]): V[] {
  const byId = new Map(folders.map((f) => [f.id, f.deleted_at]));
  return videos.filter((v) => !(v.folder_id && byId.get(v.folder_id) === v.deleted_at));
}

export function isTrashKind(v: unknown): v is TrashKind {
  return v === "video" || v === "projeto";
}
