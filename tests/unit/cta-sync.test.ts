import { describe, expect, it } from "vitest";
import { planCtaSync } from "@/lib/profile/sync";

const wa = { kind: "whatsapp" as const, label: "WhatsApp", value: "11999990000" };
const bio = { kind: "bio" as const, label: "Instagram", value: "@eu" };

describe("planCtaSync", () => {
  it("editar um valor atualiza a mesma linha (id preservado)", () => {
    const plan = planCtaSync([{ id: "a", ...wa }, { id: "b", ...bio }], [{ ...wa, value: "11988880000" }, bio]);
    expect(plan).toEqual({ updates: [{ id: "a", row: { ...wa, value: "11988880000" } }], inserts: [], deletes: [] });
  });

  it("sem mudanças não escreve nada", () => {
    expect(planCtaSync([{ id: "a", ...wa }], [wa])).toEqual({ updates: [], inserts: [], deletes: [] });
  });

  it("insere os novos e remove só os que saíram", () => {
    const plan = planCtaSync([{ id: "a", ...wa }, { id: "b", ...bio }], [wa, { kind: "phone", label: "Telefone", value: "1133330000" }]);
    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toEqual([{ kind: "phone", label: "Telefone", value: "1133330000" }]);
    expect(plan.deletes).toEqual(["b"]);
  });

  it("dois do mesmo tipo casam primeiro pelo rótulo", () => {
    const a = { id: "a", kind: "link" as const, label: "Loja", value: "https://a.com/" };
    const b = { id: "b", kind: "link" as const, label: "Blog", value: "https://b.com/" };
    const plan = planCtaSync([a, b], [{ kind: "link", label: "Blog", value: "https://novo.com/" }]);
    expect(plan.updates).toEqual([{ id: "b", row: { kind: "link", label: "Blog", value: "https://novo.com/" } }]);
    expect(plan.deletes).toEqual(["a"]);
  });

  it("lista vazia remove tudo", () => {
    expect(planCtaSync([{ id: "a", ...wa }], []).deletes).toEqual(["a"]);
  });
});
