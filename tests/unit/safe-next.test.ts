import { describe, expect, it } from "vitest";
import { safeNext } from "../../src/lib/auth/safe-next";

const o = "http://localhost:3000";

describe("safeNext", () => {
  it("aceita caminho interno", () => {
    expect(safeNext("/perfil", o)).toBe("/perfil");
  });
  it.each(["/\\evil.com", "/\t/evil.com", "//evil.com", "https://evil.com", "javascript:alert(1)", null, ""])(
    "recusa %s",
    (n) => {
      expect(safeNext(n, o)).toBe("/projetos");
    },
  );
});
