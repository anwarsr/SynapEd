import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { PYTHON_WORKER_CSP, PYTHON_WORKER_URL } from "./src/lib/lab/python/pythonVersi";

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

  /** Kode sumber asli TIDAK boleh bisa dipulihkan dari peramban: tanpa source map & tanpa header X-Powered-By. */
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  outputFileTracingRoot: projectRoot,

  /**
   * CSP KHUSUS worker Python SynapLab — lapisan keamanan terkuat lab itu.
   *
   * Worker berkas sendiri memakai CSP dari respons berkasnya, jadi kode Python
   * siswa (yang bisa datang dari tautan siapa saja) tidak bisa menghubungi
   * API SynapEd atau server lain. Isi kebijakannya (PYTHON_WORKER_CSP) dan
   * versinya hidup di pythonVersi.ts — modul yang SAMA dengan yang dimuat
   * worker, jadi keduanya tidak bisa berbeda. Lihat juga
   * public/lab/python-worker.js.
   */
  async headers() {
    return [
      {
        /**
         * Header keamanan untuk semua halaman KECUALI worker Python (CSP-nya sendiri, di bawah).
         * `frame-ancestors 'self'` + X-Frame-Options: situs tak bisa dibingkai di situs lain
         * (mencegah clickjacking dan "menyalin" tampilan lewat iframe). COOP `same-origin-allow-popups`
         * mempertahankan popup masuk Google/Firebase dan Midtrans.
         */
        source: "/((?!lab/python-worker\\.js).*)",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
        ],
      },
      {
        source: PYTHON_WORKER_URL,
        headers: [
          { key: "Content-Security-Policy", value: PYTHON_WORKER_CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },

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
