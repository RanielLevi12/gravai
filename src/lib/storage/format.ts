const GB = 1024 ** 3;

/** "1,2 GB", "340 MB" ou "0 MB": tamanho em português, sem casas inúteis. */
export function formatBytes(bytes: number): string {
  if (bytes >= GB / 10) return `${(bytes / GB).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;
  return `${Math.round(bytes / 1024 ** 2).toLocaleString("pt-BR")} MB`;
}

/** "1,2 de 5 GB": o texto do medidor de espaço. */
export function quotaText(used: number, limit: number): string {
  if (used >= GB / 10) return `${(used / GB).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} de ${formatBytes(limit)}`;
  return `${formatBytes(used)} de ${formatBytes(limit)}`;
}
