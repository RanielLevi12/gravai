import { describe, expect, it } from "vitest";
import { blockCoverage, findSkipped, skippedMessage, type SpokenWord } from "@/lib/record/skipped";
import { encodeWav, pickSampleRate } from "@/lib/record/wav";

const script = [
  { id: "a", label: "Abertura", text: "Oi, eu sou o Raniel e hoje vou falar de gravação de vídeo." },
  { id: "b", label: "Trecho 1", text: "Primeiro, ajuste a luz da janela para ficar na frente do rosto." },
  { id: "c", label: "Trecho 2", text: "Segundo, segure o celular na altura dos olhos sem tremer." },
  { id: "d", label: "Fechamento", text: "Pronto, agora é só gravar e me contar como foi." },
];

const say = (text: string): SpokenWord[] => text.split(/\s+/).map((w, i) => ({ w, s: i * 0.4, e: i * 0.4 + 0.3 }));

describe("trecho pulado no take único", () => {
  it("leu tudo → sem aviso", () => {
    expect(findSkipped(script, say(script.map((b) => b.text).join(" ")))).toEqual([]);
  });

  it("pulou o Trecho 2 → avisa só ele", () => {
    const spoken = say([script[0], script[1], script[3]].map((b) => b.text).join(" "));
    const skipped = findSkipped(script, spoken);
    expect(skipped.map((s) => s.label)).toEqual(["Trecho 2"]);
    expect(skipped[0].coverage).toBeLessThan(0.5);
  });

  it("ignora acento, pontuação e maiúsculas e tolera palavras trocadas", () => {
    const spoken = say("oi eu sou o raniel e hoje vou falar de gravacao de video primeiro ajuste a luz da janela pra ficar na frente do rosto segundo segure o celular na altura dos olhos sem tremer pronto agora e so gravar e me contar como foi");
    expect(findSkipped(script, spoken)).toEqual([]);
  });

  it("pulou dois trechos → lista os dois", () => {
    const spoken = say([script[0], script[3]].map((b) => b.text).join(" "));
    expect(findSkipped(script, spoken).map((s) => s.label)).toEqual(["Trecho 1", "Trecho 2"]);
  });

  it("falou de outro assunto (nenhum bloco bate) → sem aviso", () => {
    expect(findSkipped(script, say("bom dia pessoal hoje o assunto é completamente diferente do roteiro combinado antes"))).toEqual([]);
  });

  it("fala curta ou vazia → sem aviso", () => {
    expect(findSkipped(script, [])).toEqual([]);
    expect(findSkipped(script, say("oi tudo bem"))).toEqual([]);
  });

  it("cobertura por bloco fica entre 0 e 1", () => {
    const cov = blockCoverage(script.map((b) => b.text), say(script[0].text));
    expect(cov[0]).toBe(1);
    expect(cov[2]).toBeLessThan(0.5);
  });

  it("monta a mensagem em português", () => {
    expect(skippedMessage(["Trecho 2"])).toBe("Parece que você pulou o Trecho 2.");
    expect(skippedMessage(["Trecho 1", "Trecho 2"])).toBe("Parece que você pulou Trecho 1 e Trecho 2.");
  });
});

describe("áudio enviado para conferir", () => {
  it("escolhe a taxa para caber no limite", () => {
    expect(pickSampleRate(60)).toBe(16_000);
    expect(pickSampleRate(180) * 2 * 180 + 44).toBeLessThanOrEqual(4.2 * 1024 * 1024);
    expect(pickSampleRate(100_000)).toBe(8_000);
  });
  it("gera WAV mono de 16 bits com cabeçalho certo", () => {
    const wav = encodeWav(new Float32Array([0, 1, -1]), 8000);
    const v = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    expect(wav.length).toBe(44 + 6);
    expect(v.getUint32(24, true)).toBe(8000);
    expect(v.getInt16(46, true)).toBe(32767);
    expect(v.getInt16(48, true)).toBe(-32767);
  });
});
