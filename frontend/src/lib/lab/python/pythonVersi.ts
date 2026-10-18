/**
 * Versi Pyodide (CPython di WebAssembly) untuk Lab 04 · Python — SATU sumber.
 *
 * Dipakai dua tempat yang WAJIB sama: alamat yang dimuat worker, dan
 * Content-Security-Policy worker di `next.config.ts`. CSP itu hanya
 * mengizinkan direktori PERSIS ini; versi yang berbeda di salah satunya
 * membuat Pyodide gagal dimuat (diblokir CSP), bukan diam-diam melonggarkan.
 *
 * Mengganti versi: ubah di sini, lalu uji browser Lab Python (muat, jalan,
 * langkah, sandbox). Modul netral — diimpor juga oleh next.config.ts.
 */
export const PYODIDE_VERSI = "314.0.7";
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSI}/full/`;
/** Alamat worker di `public/`. Header CSP-nya dipasang di next.config.ts. */
export const PYTHON_WORKER_URL = "/lab/python-worker.js";

/**
 * CSP worker Python — lapisan keamanan terkuat lab itu (lihat CLAUDE.md,
 * invarian keamanan 6). Script & koneksi HANYA ke direktori Pyodide berversi,
 * `wasm-unsafe-eval` untuk WebAssembly tetapi TANPA `unsafe-eval`, tanpa worker
 * bersarang. Dipasang `next.config.ts`; isinya dijaga `verify-kode`.
 */
export const PYTHON_WORKER_CSP = [
  "default-src 'none'",
  `script-src ${PYODIDE_INDEX_URL} 'wasm-unsafe-eval'`,
  `connect-src ${PYODIDE_INDEX_URL}`,
  "worker-src 'none'",
].join("; ");
