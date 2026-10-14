"use client";

import { Check, Copy, Download } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { signedUrl } from "@/lib/delivery/actions";
import styles from "./entrega.module.css";

export type CardFile = { id: string; url: string };

/** Vídeo (e capa) com baixar e copiar descrição. O final usa o mesmo cartão, sem descrições. */
export function CutCard({
  projectId,
  title,
  meta,
  video,
  cover,
  descriptions,
}: {
  projectId: string;
  title: string;
  meta: string;
  video: CardFile;
  cover: CardFile | null;
  descriptions: { platform: string; text: string }[];
}) {
  const player = useRef<HTMLVideoElement>(null);
  const retried = useRef(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(id: string) {
    setError(null);
    const res = await signedUrl(projectId, id).catch(() => ({ error: "Não foi possível agora. Tente de novo." }));
    if ("error" in res) return setError(res.error);
    window.location.assign(res.url);
  }

  // O link de visualização vale 5 min: se o vídeo falhar depois disso, pede um novo (uma vez).
  async function refreshSource() {
    if (retried.current || !player.current) return;
    retried.current = true;
    const res = await signedUrl(projectId, video.id, { download: false }).catch(() => null);
    if (res && "url" in res && player.current) player.current.src = res.url;
  }

  async function copy(platform: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(platform);
      setTimeout(() => setCopied((c) => (c === platform ? null : c)), 2000);
    } catch {
      setError("Não consegui copiar. Selecione o texto e copie à mão.");
    }
  }

  return (
    <li className={styles.card}>
      <h2 className={styles.cardTitle}>{title}</h2>
      <p className={styles.meta}>{meta}</p>
      <video
        ref={player}
        className={styles.video}
        src={video.url}
        poster={cover?.url}
        controls
        playsInline
        preload="metadata"
        onError={refreshSource}
        aria-label={title}
      />
      <div className={styles.row}>
        <Button variant="soft" icon={Download} onClick={() => download(video.id)}>
          Baixar vídeo
        </Button>
        {cover ? (
          <Button variant="soft" icon={Download} onClick={() => download(cover.id)}>
            Baixar capa
          </Button>
        ) : null}
      </div>
      {descriptions.length > 0 ? (
        <div className={styles.descriptions}>
          {descriptions.map((d) => (
            <div key={d.platform} className={styles.description}>
              <b>{d.platform}</b>
              <p>{d.text}</p>
              <Button variant="soft" icon={copied === d.platform ? Check : Copy} onClick={() => copy(d.platform, d.text)}>
                {copied === d.platform ? "Copiado" : "Copiar descrição"}
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className={styles.meta}>
          {error}
        </p>
      ) : null}
    </li>
  );
}
