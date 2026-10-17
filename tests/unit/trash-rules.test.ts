import { describe, expect, it } from "vitest";
import { daysLeft, daysLeftText, isTrashKind, purgeAt, purgeCutoff, standaloneVideos, TRASH_DAYS } from "@/lib/trash/rules";

const DAY = 24 * 60 * 60 * 1000;
const t0 = new Date("2026-10-17T12:00:00Z");

describe("regras da lixeira", () => {
  it("fica 7 dias", () => {
    expect(TRASH_DAYS).toBe(7);
    expect(purgeAt(t0).getTime() - t0.getTime()).toBe(7 * DAY);
  });

  it("conta os dias que faltam, arredondando para cima", () => {
    expect(daysLeft(t0, t0)).toBe(7);
    expect(daysLeft(t0, new Date(t0.getTime() + 2 * DAY + 1000))).toBe(5);
    expect(daysLeft(t0, new Date(t0.getTime() + 6.5 * DAY))).toBe(1);
  });

  it("nunca fica negativo", () => {
    expect(daysLeft(t0, new Date(t0.getTime() + 30 * DAY))).toBe(0);
  });

  it("texto em português", () => {
    expect(daysLeftText(t0, t0)).toBe("Faltam 7 dias");
    expect(daysLeftText(t0, new Date(t0.getTime() + 6.5 * DAY))).toBe("Falta 1 dia");
    expect(daysLeftText(t0, new Date(t0.getTime() + 8 * DAY))).toBe("Será apagado hoje");
  });

  it("data de corte é 7 dias atrás", () => {
    expect(purgeCutoff(t0).getTime()).toBe(t0.getTime() - 7 * DAY);
  });

  it("vídeo que foi junto com o projeto não aparece solto", () => {
    const folders = [{ id: "f1", deleted_at: "2026-10-17T10:00:00Z" }];
    const videos = [
      { id: "a", folder_id: "f1", deleted_at: "2026-10-17T10:00:00Z" }, // foi junto
      { id: "b", folder_id: "f1", deleted_at: "2026-10-10T10:00:00Z" }, // já estava na lixeira antes
      { id: "c", folder_id: null, deleted_at: "2026-10-17T10:00:00Z" },
      { id: "d", folder_id: "f2", deleted_at: "2026-10-17T10:00:00Z" }, // projeto normal
    ];
    expect(standaloneVideos(videos, folders).map((v) => v.id)).toEqual(["b", "c", "d"]);
  });

  it("só aceita os dois tipos", () => {
    expect(isTrashKind("video")).toBe(true);
    expect(isTrashKind("projeto")).toBe(true);
    expect(isTrashKind("pasta")).toBe(false);
  });
});
