import { describe, expect, it } from "vitest";
import { daysLeft, exportFileName, expiresAt } from "@/lib/delivery/rules";

describe("expiresAt / daysLeft", () => {
  it("expira 30 dias depois", () => {
    expect(expiresAt(new Date("2026-10-14T00:00:00Z")).toISOString().slice(0, 10)).toBe("2026-11-13");
  });

  it("daysLeft conta dias que faltam e não passa de zero", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    expect(daysLeft(new Date("2026-10-18T12:00:00Z"), now)).toBe(4);
    expect(daysLeft(new Date("2026-10-01T12:00:00Z"), now)).toBe(0);
  });
});

describe("exportFileName", () => {
  it("nomes dos arquivos", () => {
    expect(exportFileName("final", null, "mp4")).toBe("final.mp4");
    expect(exportFileName("cut", 2, "mp4")).toBe("corte-02.mp4");
    expect(exportFileName("cover", 12, "jpg")).toBe("capa-12.jpg");
  });
});
