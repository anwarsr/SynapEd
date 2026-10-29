import type { MetadataRoute } from "next";

/**
 * Pemberitahuan untuk perayap, termasuk perayap pelatih/pembaca AI. Ini permintaan sopan
 * (robots.txt), BUKAN penghalang teknis: perayap yang patuh berhenti, yang tidak patuh
 * tetap bisa membaca halaman publik. Mesin pencari biasa tetap diizinkan.
 */
const PERAYAP_AI = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-Web", "anthropic-ai", "Google-Extended",
  "PerplexityBot", "CCBot", "Bytespider", "Amazonbot", "Applebot-Extended", "FacebookBot", "meta-externalagent",
  "cohere-ai", "Diffbot", "ImagesiftBot", "Omgilibot", "YouBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: PERAYAP_AI, disallow: "/" },
      { userAgent: "*", disallow: ["/admin", "/educator", "/api/", "/dashboard", "/profil/edit"] },
    ],
  };
}
