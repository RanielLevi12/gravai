/** Aviso, no navegador, de que uma chamada de IA acabou: a barra de custos busca os números de novo. */
export const COST_EVENT = "gravai:custo";

export function notifyCost(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(COST_EVENT));
}
