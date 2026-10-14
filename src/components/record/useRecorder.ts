"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { startRecording } from "@/lib/record/actions";
import { appendChunk, markMeta } from "@/lib/record/store";
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

const SERVER_SNAPSHOT = { state: "idle", stream: null, elapsed: 0, count: 0, warn: false, error: null, result: null } as const;

export function useRecorder(opts: RecorderOpts) {
  const [rec] = useState(() => createRecorder(opts, browserEnv()));
  const snap = useSyncExternalStore(rec.subscribe, rec.getSnapshot, () => SERVER_SNAPSHOT);

  useEffect(() => {
    rec.revive();
    void rec.open();
    return rec.release;
  }, [rec]);

  return { ...snap, start: rec.start, stop: rec.stop, reset: rec.reset };
}
