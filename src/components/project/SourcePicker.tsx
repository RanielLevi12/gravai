"use client";

import { ArrowLeft, Camera, ChevronRight, FileUp, Mic, Plus, Square, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import buttonStyles from "@/components/ui/Button.module.css";
import { Field } from "@/components/ui/Field";
import { formatWords, kindForFile, kindForFiles, MAX_PASTE_CHARS, safeFileName, type UploadKind } from "@/lib/project/source";
import { createBrowserClient } from "@/lib/supabase/client";
import { ORIGENS, type OrigemId } from "./origens";
import flow from "./flow.module.css";
import styles from "./SourcePicker.module.css";

const MAX_ARQUIVOS = 10;
const GENERICO = "Não consegui criar o projeto agora. Tente de novo.";
const softButton = `${buttonStyles.button} ${buttonStyles.soft} ${flow.full}`;

type Erro = { texto: string; conectar?: boolean };
type Envio = { kind: UploadKind | "text" | "gdocs"; text?: string; url?: string; files?: File[] };

/** Sobe os arquivos direto ao Storage (o corpo da requisição na Vercel é limitado) e cria o projeto. */
function useCriarProjeto(userId: string, folderId: string | null) {
  const router = useRouter();
  const [pendente, setPendente] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [erro, setErro] = useState<Erro | null>(null);
  const emAndamento = useRef(false);

  async function enviar({ kind, text, url, files = [] }: Envio) {
    if (emAndamento.current) return;
    emAndamento.current = true;
    setPendente(true);
    setErro(null);
    let navegou = false;
    try {
      const form = new FormData();
      form.set("kind", kind);
      if (folderId) form.set("folder_id", folderId);
      if (text !== undefined) form.set("text", text);
      if (url !== undefined) form.set("url", url);

      if (files.length > 0) {
        const supabase = createBrowserClient();
        for (const [i, file] of files.entries()) {
          setProgresso(files.length > 1 ? `Enviando ${i + 1} de ${files.length}…` : "Enviando arquivo…");
          const path = `${userId}/${crypto.randomUUID()}/${safeFileName(file.name)}`;
          const { error } = await supabase.storage
            .from("sources")
            .upload(path, file, { contentType: file.type || undefined, upsert: false });
          if (error) {
            setErro({ texto: "Não consegui enviar o arquivo. Confira a conexão e tente de novo." });
            return;
          }
          form.append("paths", path);
        }
      }

      setProgresso(kind === "text" ? "Criando projeto…" : "Lendo o conteúdo…");
      const res = await fetch("/api/projects", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string; code?: string };

      if (res.status === 201 && body.id) {
        navegou = true;
        setProgresso("Abrindo…");
        router.push(`/projetos/${body.id}/fonte`);
        return;
      }
      if (res.status === 401) {
        setErro({ texto: "Sua sessão expirou. Entre de novo." });
        return;
      }
      setErro({ texto: body.error ?? GENERICO, conectar: res.status === 412 && body.code === "not_connected" });
    } catch {
      setErro({ texto: GENERICO });
    } finally {
      if (!navegou) {
        emAndamento.current = false;
        setPendente(false);
        setProgresso(null);
      }
    }
  }

  return { enviar, pendente, progresso, erro, setErro };
}

function Aviso({ erro }: { erro: Erro | null }) {
  if (!erro) return null;
  return (
    <div role="alert" className={flow.alert}>
      <p style={{ margin: 0 }}>{erro.texto}</p>
      {erro.conectar ? (
        // Rota do servidor (OAuth): navegação completa, sem o roteador do cliente.
        <a href="/api/ai/connect" className={`${buttonStyles.button} ${buttonStyles.soft} ${styles.conectar}`}>
          Conectar sua IA
        </a>
      ) : null}
    </div>
  );
}

function Acoes({ progresso, children }: { progresso: string | null; children: ReactNode }) {
  return (
    <div className={flow.actions}>
      {progresso ? (
        <p className={flow.status} role="status">
          {progresso}
        </p>
      ) : null}
      {children}
    </div>
  );
}

function tamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/* ---------- Texto ---------- */

function TextoForm({ userId, folderId }: { userId: string; folderId: string | null }) {
  const { enviar, pendente, progresso, erro } = useCriarProjeto(userId, folderId);
  const [texto, setTexto] = useState("");
  const vazio = texto.trim() === "";

  return (
    <form
      className={flow.body}
      onSubmit={(e) => {
        e.preventDefault();
        if (!vazio) void enviar({ kind: "text", text: texto });
      }}
    >
      <Field
        label="Cole seu texto"
        multiline
        rows={12}
        value={texto}
        maxLength={MAX_PASTE_CHARS}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Copie de onde estiver (livro, anotação, site) e cole aqui."
        hint={formatWords(texto)}
        className={styles.textarea}
      />
      <Aviso erro={erro} />
      <Acoes progresso={progresso}>
        <Button type="submit" className={flow.full} disabled={vazio || pendente}>
          Continuar
        </Button>
      </Acoes>
    </form>
  );
}

/* ---------- Foto (câmera) ---------- */

type Pagina = { id: string; file: File; url: string };

function FotoForm({ userId, folderId }: { userId: string; folderId: string | null }) {
  const { enviar, pendente, progresso, erro, setErro } = useCriarProjeto(userId, folderId);
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const urls = useRef(new Set<string>());

  useEffect(() => {
    const vivas = urls.current;
    return () => vivas.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  function adicionar(files: FileList | null) {
    if (!files || files.length === 0) return;
    const novas = Array.from(files).filter((f) => kindForFile(f) === "images");
    const espaco = Math.max(0, MAX_ARQUIVOS - paginas.length);
    if (novas.length < files.length) setErro({ texto: "Use só fotos (JPG, PNG, WEBP ou HEIC)." });
    else if (novas.length > espaco) setErro({ texto: `Até ${MAX_ARQUIVOS} páginas por vídeo.` });
    else setErro(null);
    const entram = novas.slice(0, espaco).map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      return { id: crypto.randomUUID(), file, url };
    });
    setPaginas([...paginas, ...entram]);
  }

  function remover(id: string) {
    const sai = paginas.find((p) => p.id === id);
    if (sai) {
      URL.revokeObjectURL(sai.url);
      urls.current.delete(sai.url);
    }
    setPaginas(paginas.filter((p) => p.id !== id));
  }

  const n = paginas.length;
  const rotulo = n === 1 ? "1 página" : `${n} páginas`;

  return (
    <form
      className={flow.body}
      onSubmit={(e) => {
        e.preventDefault();
        if (n > 0) void enviar({ kind: "images", files: paginas.map((p) => p.file) });
      }}
    >
      <p className={flow.lead}>Enquadre a página inteira. Boa luz, sem sombra.</p>
      <input
        id="foto-camera"
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className={flow.srOnly}
        disabled={pendente || n >= MAX_ARQUIVOS}
        onChange={(e) => {
          adicionar(e.target.files);
          e.target.value = "";
        }}
      />
      {n > 0 ? (
        <>
          <p className={flow.hint} aria-live="polite">
            {rotulo}
          </p>
          <ol className={styles.thumbs}>
            {paginas.map((p, i) => (
              <li key={p.id} className={styles.thumb}>
                {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) */}
                <img src={p.url} alt={`Página ${i + 1}`} />
                <span className={`${styles.thumbNum} tnum`} aria-hidden>
                  {i + 1}
                </span>
                <button
                  type="button"
                  className={styles.thumbRemove}
                  aria-label={`Remover página ${i + 1}`}
                  disabled={pendente}
                  onClick={() => remover(p.id)}
                >
                  <X size={18} strokeWidth={2} aria-hidden />
                </button>
              </li>
            ))}
          </ol>
        </>
      ) : null}
      <label htmlFor="foto-camera" className={`${softButton} ${styles.fileLabel}`} aria-disabled={pendente || n >= MAX_ARQUIVOS}>
        {n === 0 ? <Camera size={20} strokeWidth={2} aria-hidden /> : <Plus size={20} strokeWidth={2} aria-hidden />}
        {n === 0 ? "Tirar foto" : "Adicionar página"}
      </label>
      <Aviso erro={erro} />
      <Acoes progresso={progresso}>
        <Button type="submit" className={flow.full} disabled={n === 0 || pendente}>
          {n === 0 ? "Pronto" : `Pronto (${rotulo})`}
        </Button>
      </Acoes>
    </form>
  );
}

/* ---------- Arquivo ---------- */

const ACEITA_ARQUIVO =
  ".pdf,.docx,.pptx,.txt,image/*,application/pdf,text/plain," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function ArquivoForm({ userId, folderId }: { userId: string; folderId: string | null }) {
  const { enviar, pendente, progresso, erro, setErro } = useCriarProjeto(userId, folderId);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const kind = kindForFiles(arquivos);
  const valido = kind !== null && kind !== "misto" && kind !== "audio" && arquivos.length <= MAX_ARQUIVOS;

  function escolher(files: FileList | null) {
    const lista = files ? Array.from(files) : [];
    setArquivos(lista);
    const k = kindForFiles(lista);
    if (lista.length === 0) setErro(null);
    else if (k === null || k === "audio") setErro({ texto: "Formato não suportado. Use PDF, Word (.docx), PowerPoint (.pptx), TXT ou imagem." });
    else if (k === "misto") setErro({ texto: "Envie um arquivo por vez (ou várias imagens de uma vez)." });
    else if (lista.length > MAX_ARQUIVOS) setErro({ texto: `Envie no máximo ${MAX_ARQUIVOS} arquivos.` });
    else setErro(null);
  }

  return (
    <form
      className={flow.body}
      onSubmit={(e) => {
        e.preventDefault();
        if (valido) void enviar({ kind: kind as UploadKind, files: arquivos });
      }}
    >
      <p className={flow.lead}>PDF, Word, PowerPoint, TXT ou fotos de páginas. Até 25 MB.</p>
      <input
        id="arquivo"
        type="file"
        accept={ACEITA_ARQUIVO}
        multiple
        className={flow.srOnly}
        disabled={pendente}
        onChange={(e) => escolher(e.target.files)}
      />
      <label htmlFor="arquivo" className={`${softButton} ${styles.fileLabel}`} aria-disabled={pendente}>
        <FileUp size={20} strokeWidth={2} aria-hidden />
        Escolher arquivo
      </label>
      {arquivos.length > 0 ? (
        <ul className={styles.files}>
          {arquivos.map((f, i) => (
            <li key={`${f.name}-${i}`} className={styles.file}>
              <span className={styles.fileName}>{f.name}</span>
              <span className={`${styles.fileSize} tnum`}>{tamanho(f.size)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <Aviso erro={erro} />
      <Acoes progresso={progresso}>
        <Button type="submit" className={flow.full} disabled={!valido || pendente}>
          Continuar
        </Button>
      </Acoes>
    </form>
  );
}

/* ---------- Link do Google Docs ---------- */

function LinkForm({ userId, folderId }: { userId: string; folderId: string | null }) {
  const { enviar, pendente, progresso, erro } = useCriarProjeto(userId, folderId);
  const [url, setUrl] = useState("");
  const vazio = url.trim() === "";

  return (
    <form
      className={flow.body}
      onSubmit={(e) => {
        e.preventDefault();
        if (!vazio) void enviar({ kind: "gdocs", url: url.trim() });
      }}
    >
      <Field
        label="Link do documento"
        type="url"
        inputMode="url"
        autoComplete="off"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://docs.google.com/document/d/…"
        hint="O documento precisa estar compartilhado para quem tiver o link."
      />
      <Aviso erro={erro} />
      <Acoes progresso={progresso}>
        <Button type="submit" className={flow.full} disabled={vazio || pendente}>
          Continuar
        </Button>
      </Acoes>
    </form>
  );
}

/* ---------- Áudio ---------- */

/** Formatos que a transcrição aceita; webm fica de fora (sem gravação no app). */
const GRAVACAO = [
  { mime: "audio/mp4", tipo: "audio/mp4", nome: "ideia.m4a" },
  { mime: "audio/ogg;codecs=opus", tipo: "audio/ogg", nome: "ideia.ogg" },
] as const;

type Gravacao = (typeof GRAVACAO)[number];

function formatoDeGravacao(): Gravacao | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  return GRAVACAO.find((g) => MediaRecorder.isTypeSupported(g.mime)) ?? null;
}

function relogio(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function AudioForm({ userId, folderId }: { userId: string; folderId: string | null }) {
  const { enviar, pendente, progresso, erro, setErro } = useCriarProjeto(userId, folderId);
  const [formato, setFormato] = useState<Gravacao | null>(null);
  const [estado, setEstado] = useState<"parado" | "gravando">("parado");
  const [segundos, setSegundos] = useState(0);
  const [audio, setAudio] = useState<{ file: File; url: string | null } | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);

  // Só depois de montar: no servidor não existe MediaRecorder.
  useEffect(() => setFormato(formatoDeGravacao()), []);

  useEffect(() => {
    if (estado !== "gravando") return;
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [estado]);

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);
  useEffect(() => () => void (audio?.url && URL.revokeObjectURL(audio.url)), [audio]);

  async function gravar() {
    if (!formato) return;
    setErro(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const rec = new MediaRecorder(s, { mimeType: formato.mime });
      const partes: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) partes.push(e.data);
      };
      rec.onstop = () => {
        s.getTracks().forEach((t) => t.stop());
        const file = new File(partes, formato.nome, { type: formato.tipo });
        setAudio({ file, url: URL.createObjectURL(file) });
      };
      gravador.current = rec;
      setAudio(null);
      setSegundos(0);
      rec.start();
      setEstado("gravando");
    } catch {
      setErro({ texto: "Não consegui usar o microfone. Permita o acesso ou envie um arquivo de áudio." });
    }
  }

  function parar() {
    gravador.current?.stop();
    setEstado("parado");
  }

  function escolher(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (kindForFile(f) !== "audio") {
      setErro({ texto: "Formato de áudio não suportado. Use MP3, M4A, WAV ou OGG." });
      return;
    }
    setErro(null);
    setAudio({ file: f, url: null });
  }

  return (
    <form
      className={flow.body}
      onSubmit={(e) => {
        e.preventDefault();
        if (audio && estado === "parado") void enviar({ kind: "audio", files: [audio.file] });
      }}
    >
      <p className={flow.lead}>Fale sua ideia como se explicasse para alguém. A gente transcreve.</p>

      {formato ? (
        estado === "gravando" ? (
          <div className={styles.rec}>
            <span className={styles.recDot} aria-hidden />
            <span className={`${styles.recTime} tnum`} role="timer" aria-label={`Gravando: ${relogio(segundos)}`}>
              {relogio(segundos)}
            </span>
            <Button variant="soft" icon={Square} onClick={parar} className={styles.recStop}>
              Parar
            </Button>
          </div>
        ) : (
          <Button variant="soft" icon={Mic} onClick={gravar} disabled={pendente} className={flow.full}>
            {audio?.url ? "Gravar de novo" : "Gravar"}
          </Button>
        )
      ) : null}

      <input
        id="audio-arquivo"
        type="file"
        accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,.mp3,.m4a,.wav,.ogg"
        className={flow.srOnly}
        disabled={pendente || estado === "gravando"}
        onChange={(e) => {
          escolher(e.target.files);
          e.target.value = "";
        }}
      />
      <label htmlFor="audio-arquivo" className={`${softButton} ${styles.fileLabel}`} aria-disabled={pendente || estado === "gravando"}>
        <FileUp size={20} strokeWidth={2} aria-hidden />
        Enviar arquivo de áudio
      </label>

      {audio ? (
        <div className={styles.files}>
          <div className={styles.file}>
            <span className={styles.fileName}>{audio.url ? `Gravação de ${relogio(segundos)}` : audio.file.name}</span>
            <span className={`${styles.fileSize} tnum`}>{tamanho(audio.file.size)}</span>
          </div>
          {audio.url ? <audio controls src={audio.url} className={styles.player} /> : null}
        </div>
      ) : null}

      <Aviso erro={erro} />
      <Acoes progresso={progresso}>
        <Button type="submit" className={flow.full} disabled={!audio || estado === "gravando" || pendente}>
          Continuar
        </Button>
      </Acoes>
    </form>
  );
}

/* ---------- Tela ---------- */

const FORMS: Record<OrigemId, (p: { userId: string; folderId: string | null }) => ReactNode> = {
  foto: FotoForm,
  texto: TextoForm,
  arquivo: ArquivoForm,
  link: LinkForm,
  audio: AudioForm,
};

const TITULOS: Record<OrigemId, string> = {
  foto: "Fotografar",
  texto: "Colar texto",
  arquivo: "Enviar arquivo",
  link: "Google Docs",
  audio: "Áudio",
};

/** Novo vídeo: escolhe a origem do conteúdo e mostra o formulário dela (?origem=...). */
export function SourcePicker({ origem, userId, folder }: { origem: OrigemId | null; userId: string; folder: { id: string; name: string } | null }) {
  const folderId = folder?.id ?? null;
  const query = folderId ? `&projeto=${folderId}` : "";
  if (!origem) {
    return (
      <main className={flow.page}>
        <nav className={flow.nav}>
          <Link href={folder ? `/pastas/${folder.id}` : "/projetos"} className={flow.back}>
            <ArrowLeft size={20} strokeWidth={2} aria-hidden />
            Voltar
          </Link>
        </nav>
        <div className={flow.body}>
          <h1 className="display">Novo vídeo</h1>
          {folder ? <p className={flow.lead}>No projeto {folder.name}. As escolhas do projeto já vêm prontas.</p> : null}
          <p className={flow.lead}>De onde vem o conteúdo?</p>
          <ul className={styles.options}>
            {ORIGENS.map(({ id, titulo, dica, icon: Icon }) => (
              <li key={id}>
                <Link href={`/novo?origem=${id}${query}`} className={styles.option}>
                  <span className={styles.optionIc}>
                    <Icon size={22} strokeWidth={2} aria-hidden />
                  </span>
                  <span className={styles.optionText}>
                    <span className={styles.optionTitle}>{titulo}</span>
                    <span className={styles.optionHint}>{dica}</span>
                  </span>
                  <ChevronRight size={20} strokeWidth={2} aria-hidden className={styles.optionChevron} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    );
  }

  const Form = FORMS[origem];
  return (
    <main className={flow.page}>
      <nav className={flow.nav}>
        <Link href={folderId ? `/novo?projeto=${folderId}` : "/novo"} className={flow.back}>
          <ArrowLeft size={20} strokeWidth={2} aria-hidden />
          Voltar
        </Link>
        <h1 className={flow.navTitle}>{TITULOS[origem]}</h1>
        <span />
      </nav>
      <Form key={origem} userId={userId} folderId={folderId} />
    </main>
  );
}
