import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Team Italfit",
    short_name: "Italfit",
    description:
      "Lo spazio di lavoro di Team Italfit. Persone, percorsi e allenamento, insieme.",
    lang: "it",
    // /login sends a signed-in person straight to their own area
    // (staff to /admin, students to /area-studente).
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
