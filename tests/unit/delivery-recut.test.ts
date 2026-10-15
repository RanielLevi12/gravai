import { describe, expect, it } from "vitest";
import {
  MSG_ALREADY_RUNNING,
  MSG_BAD_RANGE,
  MSG_CUT_NOT_FOUND,
  MSG_NOT_GENERATED,
  recutWith,
  type DeliveryDb,
  type ExportRow,
  type JobView,
} from "@/lib/delivery/service";

const final: ExportRow = {
  id: "f",
  kind: "final",
  cutId: null,
  storagePath: "u/p/f.mp4",
  mime: "video/mp4",
  durationSeconds: 60,
  sizeBytes: 1,
  expiresAt: "2026-11-13T00:00:00Z",
};

function fakeDb(opts: { exports?: ExportRow[]; active?: boolean } = {}): DeliveryDb & { created: { kind: string; payload: object }[] } {
  const created: { kind: string; payload: object }[] = [];
  const jobs: JobView[] = [];
  return {
    created,
    async project(id) {
      return { id, status: "pronto", scriptStale: false };
    },
    async latestJob() {
      return jobs.at(-1) ?? null;
    },
    async createJob(_p, kind, payload) {
      if (opts.active) throw new Error(MSG_ALREADY_RUNNING);
      created.push({ kind, payload });
      return "job-1";
    },
    async exportsOf() {
      return opts.exports ?? [final];
    },
    async cuts() {
      return [{ id: "c1", title: "A", start: 1, end: 2, descriptions: {} }];
    },
    async signUrl() {
      return "";
    },
    async download() {
      return new Uint8Array();
    },
    async latestRecordingAt() {
      return null;
    },
  };
}

describe("recutWith", () => {
  it("aceita 12,3–40,0 e cria o pedido recut com os tempos", async () => {
    const db = fakeDb();
    await expect(recutWith(db, "p", "c1", 12.3, 40)).resolves.toEqual({ jobId: "job-1" });
    expect(db.created).toEqual([{ kind: "recut", payload: { cutId: "c1", start: 12.3, end: 40 } }]);
  });

  it.each([
    ["início depois do fim", 10, 5],
    ["início igual ao fim", 10, 10],
    ["fim acima da duração do final", 10, 61],
    ["corte de 0,5 s", 10, 10.5],
    ["corte acima de 180 s", 0, 181],
    ["início negativo", -1, 5],
    ["passo fora de 0,1 s", 10.05, 20],
    ["não é número", Number.NaN, 20],
  ])("recusa %s", async (_nome, start, end) => {
    const dur = end === 181 ? 300 : 60;
    const db = fakeDb({ exports: [{ ...final, durationSeconds: dur }] });
    await expect(recutWith(db, "p", "c1", start, end)).rejects.toThrow(MSG_BAD_RANGE);
    expect(db.created).toHaveLength(0);
  });

  it("corte que não existe", async () => {
    await expect(recutWith(fakeDb(), "p", "zzz", 1, 5)).rejects.toThrow(MSG_CUT_NOT_FOUND);
  });

  it("sem vídeo final gerado", async () => {
    await expect(recutWith(fakeDb({ exports: [] }), "p", "c1", 1, 5)).rejects.toThrow(MSG_NOT_GENERATED);
  });

  it("já há um pedido rodando", async () => {
    await expect(recutWith(fakeDb({ active: true }), "p", "c1", 1, 5)).rejects.toThrow(MSG_ALREADY_RUNNING);
  });
});
