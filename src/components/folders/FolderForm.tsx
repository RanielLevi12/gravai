"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTrashToast } from "@/components/trash/TrashToast";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { OptionCard } from "@/components/ui/OptionCard";
import { Sheet } from "@/components/ui/Sheet";
import { createFolder, updateFolder } from "@/lib/folders/actions";
import {
  COLOR_LABEL,
  COLOR_VAR,
  CUT_DURATIONS,
  DEFAULT_SETTINGS,
  FOLDER_COLORS,
  MAIN_DURATIONS,
  MAX_ABOUT,
  MAX_NAME,
  PLATFORMS,
  type FolderColor,
  type FolderSettings,
  MAX_STYLE_EXAMPLES,
  MAX_STYLE_SHORT,
} from "@/lib/folders/schema";
import { moverParaLixeira } from "@/lib/trash/actions";
import { PLATFORM_LABELS, formatSeconds, type Platform } from "@/lib/interview/steps";
import { allowedCutDurations } from "@/lib/rules/cuts";
import styles from "./folder-form.module.css";

export type FolderFormValues = { name: string; color: FolderColor; about: string; settings: FolderSettings };
export type CtaOption = { id: string; label: string };

export const EMPTY_FOLDER: FolderFormValues = { name: "", color: "rosa", about: "", settings: DEFAULT_SETTINGS };

/** Criar ou editar um projeto (pasta): tudo numa tela, com os valores sugeridos já marcados. */
export function FolderForm({
  folderId,
  initial = EMPTY_FOLDER,
  ctas,
}: {
  folderId?: string;
  initial?: FolderFormValues;
  ctas: CtaOption[];
}) {
  const router = useRouter();
  const showToast = useTrashToast();
  const [v, setV] = useState<FolderFormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editing = Boolean(folderId);
  const s = v.settings;
  const set = (patch: Partial<FolderSettings>) => setV((cur) => ({ ...cur, settings: { ...cur.settings, ...patch } }));
  const setStyle = (patch: NonNullable<FolderSettings["style"]>) => setV((cur) => ({ ...cur, settings: { ...cur.settings, style: { ...cur.settings.style, ...patch } } }));

  function pickDuration(seconds: number) {
    // Corte que não cabe mais no vídeo novo vira "sem cortes" até escolher de novo.
    const keep = s.cutSeconds !== null && allowedCutDurations(seconds).includes(s.cutSeconds);
    set({ mainSeconds: seconds, cutSeconds: keep ? s.cutSeconds : (allowedCutDurations(seconds).at(-1) ?? null) });
  }

  function togglePlatform(p: Platform, on: boolean) {
    const next = on ? [...s.platforms, p] : s.platforms.filter((x) => x !== p);
    set({ platforms: PLATFORMS.filter((x) => next.includes(x)) });
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const payload = { name: v.name, color: v.color, about: v.about.trim() || null, settings: s };
    try {
      const r = folderId ? await updateFolder(folderId, payload) : await createFolder(payload);
      if (!r.ok) {
        setError(r.error);
        setBusy(false);
        return;
      }
      router.push(`/pastas/${folderId ?? ("id" in r ? r.id : "")}`);
      router.refresh();
    } catch {
      setError("Não foi possível salvar agora. Tente de novo.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!folderId || busy) return;
    setBusy(true);
    try {
      const r = await moverParaLixeira("projeto", folderId);
      if (!r.ok) {
        setError(r.error);
        setBusy(false);
        setConfirmDelete(false);
        return;
      }
      showToast("projeto", folderId, v.name);
      router.push("/projetos");
      router.refresh();
    } catch {
      setError("Não foi possível mover agora. Tente de novo.");
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  const cuts = allowedCutDurations(s.mainSeconds);

  return (
    <form className={styles.form} onSubmit={save} noValidate>
      <section className={styles.block}>
        <Field label="Nome do projeto" name="name" value={v.name} maxLength={MAX_NAME} placeholder="Ex.: Devocional" required onChange={(e) => setV({ ...v, name: e.target.value })} />
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Cor</legend>
          <div className={styles.swatches}>
            {FOLDER_COLORS.map((c) => (
              <label key={c} className={styles.swatch}>
                <input type="radio" name="color" value={c} checked={v.color === c} onChange={() => setV({ ...v, color: c })} aria-label={COLOR_LABEL[c]} />
                <span style={{ background: COLOR_VAR[c] }} />
              </label>
            ))}
          </div>
        </fieldset>
        <Field
          label="Sobre este projeto"
          hint="Opcional. A IA lê este texto ao escrever os vídeos do projeto. Ex.: devocional cristão, tom acolhedor, público de igreja."
          multiline
          name="about"
          value={v.about}
          maxLength={MAX_ABOUT}
          onChange={(e) => setV({ ...v, about: e.target.value })}
        />
        <Field
          label="Tom de voz do projeto"
          hint="Opcional. Vale mais que o tom do seu perfil. Ex.: acolhedor, direto, bem-humorado."
          name="style-tone"
          value={s.style?.tone ?? ""}
          maxLength={MAX_STYLE_SHORT}
          onChange={(e) => setStyle({ tone: e.target.value })}
        />
        <Field
          label="Público do projeto"
          hint="Opcional. Ex.: mães de primeira viagem, donos de pequenas lojas, jovens da igreja."
          name="style-audience"
          value={s.style?.audience ?? ""}
          maxLength={MAX_STYLE_SHORT}
          onChange={(e) => setStyle({ audience: e.target.value })}
        />
        <Field
          label="Exemplos de como você fala"
          hint="Opcional. Cole 1 ou 2 trechos de vídeos seus que ficaram bons. A IA imita o ritmo, sem copiar as frases."
          multiline
          name="style-examples"
          value={s.style?.examples ?? ""}
          maxLength={MAX_STYLE_EXAMPLES}
          onChange={(e) => setStyle({ examples: e.target.value })}
        />
      </section>

      <section className={styles.block} aria-labelledby="cfg-titulo">
        <h2 id="cfg-titulo" className={styles.h2}>
          Configurações dos vídeos
        </h2>
        <p className={styles.lead}>Todo vídeo novo deste projeto começa com estas escolhas. Dá para mudar em cada vídeo.</p>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Onde publicar</legend>
          <div className={styles.cards}>
            {PLATFORMS.map((p) => (
              <OptionCard key={p} type="checkbox" size="text" name="platforms" value={p} label={PLATFORM_LABELS[p]} checked={s.platforms.includes(p)} onChange={(on) => togglePlatform(p, on)} />
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Formato</legend>
          <div className={styles.cards}>
            <OptionCard size="text" name="format" value="single" label="Vídeo único" sub="Um vídeo principal" checked={s.format === "single"} onChange={() => set({ format: "single" })} />
            <OptionCard size="text" name="format" value="series" label="Série" sub="Vários episódios" checked={s.format === "series"} onChange={() => set({ format: "series" })} />
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Duração do vídeo</legend>
          <div className={styles.cards}>
            {MAIN_DURATIONS.map((d) => (
              <OptionCard key={d} size="text" name="duration" value={String(d)} label={formatSeconds(d)} checked={s.mainSeconds === d} onChange={() => pickDuration(d)} />
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Tamanho de cada corte</legend>
          <div className={styles.cards}>
            <OptionCard size="text" name="cuts" value="none" label="Sem cortes" checked={s.cutSeconds === null} onChange={() => set({ cutSeconds: null })} />
            {CUT_DURATIONS.map((d) => (
              <OptionCard key={d} size="text" name="cuts" value={String(d)} label={`${d} s`} disabled={!cuts.includes(d)} reason="Maior que a metade do vídeo" checked={s.cutSeconds === d} onChange={() => set({ cutSeconds: d })} />
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Onde você vai gravar</legend>
          <div className={styles.cards}>
            <OptionCard size="text" name="scenery" value="natural" label="Cenário natural" sub="Num canto da casa" checked={s.scenery.mode === "natural"} onChange={() => set({ scenery: { ...s.scenery, mode: "natural" } })} />
            <OptionCard size="text" name="scenery" value="ai" label="Fundo criado com IA" sub="Imagem gerada como fundo" checked={s.scenery.mode === "ai"} onChange={() => set({ scenery: { ...s.scenery, mode: "ai" } })} />
          </div>
          {s.scenery.mode === "natural" ? (
            <Field label="Descreva o cenário (opcional)" name="natural" value={s.scenery.natural} maxLength={500} onChange={(e) => set({ scenery: { ...s.scenery, natural: e.target.value } })} />
          ) : (
            <Field label="Como deve ser o fundo (opcional)" name="aiPrompt" value={s.scenery.aiPrompt} maxLength={2000} onChange={(e) => set({ scenery: { ...s.scenery, aiPrompt: e.target.value } })} />
          )}
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Capa</legend>
          <div className={styles.cards}>
            <OptionCard size="text" name="cover" value="frame" label="Quadro do vídeo" sub="Um momento seu falando" checked={s.cover === "frame"} onChange={() => set({ cover: "frame" })} />
            <OptionCard size="text" name="cover" value="ai" label="Capa criada com IA" sub="Você recebe o prompt pronto" checked={s.cover === "ai"} onChange={() => set({ cover: "ai" })} />
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Chamada no final</legend>
          <div className={styles.cards}>
            <OptionCard size="text" name="cta" value="none" label="Sem chamada" checked={s.ctaId === null} onChange={() => set({ ctaId: null })} />
            {ctas.map((c) => (
              <OptionCard key={c.id} size="text" name="cta" value={c.id} label={c.label} checked={s.ctaId === c.id} onChange={() => set({ ctaId: c.id })} />
            ))}
          </div>
          {ctas.length === 0 ? <p className={styles.hint}>Cadastre chamadas no Perfil para escolher uma aqui.</p> : null}
        </fieldset>
      </section>

      {error ? (
        <p role="alert" className={styles.alert}>
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <Button type="submit" disabled={busy || v.name.trim() === "" || s.platforms.length === 0}>
          {busy ? "Salvando…" : editing ? "Salvar projeto" : "Criar projeto"}
        </Button>
        {editing ? (
          <Button variant="soft" onClick={() => setConfirmDelete(true)} disabled={busy}>
            Mover para a lixeira
          </Button>
        ) : null}
      </div>
      {editing ? <p className={styles.hint}>Mudanças valem só para vídeos novos. Os que já existem não mudam.</p> : null}

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Mover este projeto para a lixeira?" busy={busy}>
        <p className={styles.lead}>Os vídeos dele vão junto. Ficam 7 dias na lixeira e dá para restaurar.</p>
        <div className={styles.actions}>
          <Button onClick={remove} disabled={busy}>
            {busy ? "Movendo…" : "Mover para a lixeira"}
          </Button>
          <Button variant="soft" onClick={() => setConfirmDelete(false)} disabled={busy}>
            Cancelar
          </Button>
        </div>
      </Sheet>
    </form>
  );
}
