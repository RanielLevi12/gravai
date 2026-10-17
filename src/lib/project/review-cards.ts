/** Dados dos dois cards da conferência: o vídeo (gravações) e o projeto em que ele está. */
export type VideoCard = { count: number; seconds: number; approved: boolean };
export type ProjectCard = { kind: "folder"; name: string; color: string; videos: number } | { kind: "loose" };

export function videoCard(clips: { duration_seconds: number | null }[], status: string): VideoCard {
  return {
    count: clips.length,
    seconds: clips.reduce((sum, c) => sum + Number(c.duration_seconds ?? 0), 0),
    approved: status === "gravado" || status === "pronto",
  };
}

export function projectCard(folder: { name: string; color: string } | null, videos: number): ProjectCard {
  return folder ? { kind: "folder", name: folder.name, color: folder.color, videos } : { kind: "loose" };
}

export const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);
