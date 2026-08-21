import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/**
 * Akar proyek dipatok ke folder ini.
 *
 * Repo ini punya DUA package-lock.json: satu di akar (untuk skrip di
 * scripts/) dan satu di sini. Next.js menentukan akar proyek dengan menyusuri
 * pohon direktori mencari lockfile, jadi ia memilih akar repo — bukan folder
 * aplikasi.
 *
 * Di komputer sendiri itu cuma memunculkan peringatan yang mudah diabaikan.
 * Saat Firebase App Hosting membangun dengan `output: "standalone"`,
 * akibatnya fatal: hasilnya bersarang di `.next/standalone/frontend/…`
 * alih-alih `.next/standalone/…`, dan adapter gagal menemukan
 * routes-manifest.json — build sukses, deploy gagal.
 *
 * `turbopack.root` untuk pemaketan, `outputFileTracingRoot` untuk penelusuran
 * berkas yang menentukan tata letak standalone. Keduanya perlu disetel.
 */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /**
   * Sengaja disetel di sini, meski adapter App Hosting juga menyetelnya.
   *
   * Tanpa ini, `npm run build` di komputer tidak menghasilkan folder
   * standalone sama sekali — sehingga kegagalan tata letak di atas MUSTAHIL
   * terlihat sebelum deploy. Nilainya sama persis dengan yang dipakai
   * adapter, jadi tidak ada yang bertabrakan; yang didapat hanyalah build
   * lokal yang setia pada build produksi.
   */
  output: "standalone",

  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "ui-avatars.com" },
      { protocol: "https", hostname: "rsa.ugm.ac.id" },
      { protocol: "https", hostname: "imotions.com" },
      { protocol: "https", hostname: "glomeda.co.id" },
      { protocol: "https", hostname: "portal.riau24.com" },
    ],
  },
};

export default nextConfig;
