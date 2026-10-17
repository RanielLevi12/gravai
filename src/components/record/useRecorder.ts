"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { startRecording } from "@/lib/record/actions";
import { appendChunk, markMeta } from "@/lib/record/store";
import { autoProfile } from "@/lib/record/autoconfig";
import type { AutoProfile } from "@/lib/record/capture";
import { loadCapture } from "./CaptureSettings";
import { createRecorder, type RecorderEnv, type RecorderOpts } from "./recorder";

export type { RecResult, RecSnapshot, RecState } from "./recorder";

function browserEnv(): RecorderEnv {
  return {
    getUserMedia: (c) =>
      navigator.mediaDevices?.getUserMedia
        ? navigator.mediaDevices.getUserMedia(c)
        : Promise.reject(new Error("sem câmera")),
    MediaRecorder: typeof MediaRecorder === "undefined" ? undefined : (MediaRecorder as unknown as RecorderEnv["MediaRecorder"]),
    startRecording,
    appendChunk,
    markMeta,
  };
}

const SERVER_SNAPSHOT = { state: "idle", stream: null, elapsed: 0, count: 0, warn: false, error: null, result: null, info: null } as const;

export function useRecorder(opts: RecorderOpts) {
  const [rec] = useState(() => createRecorder(opts, browserEnv()));
  const [profile, setProfile] = useState<AutoProfile | null>(null);
  const snap = useSyncExternalStore(rec.subscribe, rec.getSnapshot, () => SERVER_SNAPSHOT);

  useEffect(() => {
    rec.revive();
    // Configuração salva no aparelho (só existe no navegador) antes de abrir a câmera.
    let alive = true;
    // O perfil do aparelho vem antes da câmera abrir; se falhar, abre no padrão.
    void autoProfile()
      .catch(() => null)
      .then(async (p) => {
        if (!alive) return;
        setProfile(p);
        await rec.configure(loadCapture(), p);
        await rec.open();
      });
    return () => {
      alive = false;
      rec.release();
    };
  }, [rec]);

  return { ...snap, profile, start: rec.start, stop: rec.stop, reset: rec.reset, configure: rec.configure, setFrame: rec.setFrame };
}
