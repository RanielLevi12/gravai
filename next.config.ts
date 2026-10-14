import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Segundo servidor (testes e2e com IA de mentirinha) sem brigar com o `next dev` de uso diário.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
