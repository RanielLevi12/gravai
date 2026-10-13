import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gravaí",
    short_name: "Gravaí",
    description: "Do material ao post, num lugar só.",
    start_url: "/",
    display: "standalone",
    theme_color: "#E11D55",
    background_color: "#FFFFFF",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
