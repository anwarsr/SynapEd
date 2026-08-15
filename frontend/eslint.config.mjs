import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Berkas pihak ketiga yang disalin apa adanya dari node_modules saat
    // dev/build (lihat scripts/copy-pdf-worker.mjs). Bukan kode kita, dan
    // ribuan peringatan dari berkas terminifikasi hanya menenggelamkan
    // peringatan yang sungguhan.
    "public/pdf.worker.min.mjs",
  ]),
]);

export default eslintConfig;
