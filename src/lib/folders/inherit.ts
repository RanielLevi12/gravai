/** Vídeo dentro de um projeto: o que veio do projeto e o que foi mudado só neste vídeo. Puro. */
import type { AnswerStep, Interview, StepValues } from "@/lib/interview/steps";
import type { FolderSettings } from "./schema";

/** Perguntas da entrevista que o projeto preenche. O título nunca é do projeto. */
export const INHERITED_STEPS = ["plataformas", "formato", "duracao", "cortes", "cenario", "capa", "cta"] as const satisfies readonly AnswerStep[];
export type InheritedStep = (typeof INHERITED_STEPS)[number];

export function isInheritedStep(s: unknown): s is InheritedStep {
  return typeof s === "string" && (INHERITED_STEPS as readonly string[]).includes(s);
}

/** Valor que o projeto dá a cada pergunta, no formato que `saveAnswer` espera. */
export function projectValue<S extends InheritedStep>(step: S, s: FolderSettings): StepValues[S];
export function projectValue(step: InheritedStep, s: FolderSettings): StepValues[InheritedStep] {
  switch (step) {
    case "plataformas":
      return s.platforms;
    case "formato":
      return s.format;
    case "duracao":
      return s.mainSeconds;
    case "cortes":
      return s.cutSeconds;
    case "cenario":
      return s.scenery;
    case "capa":
      return s.cover;
    case "cta":
      return s.ctaId;
  }
}

function videoValue(step: InheritedStep, i: Interview): unknown {
  switch (step) {
    case "plataformas":
      return i.platforms;
    case "formato":
      return i.format;
    case "duracao":
      return i.mainSeconds;
    case "cortes":
      return i.cutSeconds;
    case "cenario":
      return i.scenery;
    case "capa":
      return i.cover;
    case "cta":
      return i.ctaId;
  }
}

/** Perguntas em que o vídeo difere do projeto ("personalizado"). Pergunta ainda sem resposta não conta. */
export function customSteps(i: Interview, s: FolderSettings): InheritedStep[] {
  return INHERITED_STEPS.filter((step) => {
    const v = videoValue(step, i);
    return v !== undefined && JSON.stringify(v) !== JSON.stringify(projectValue(step, s));
  });
}
