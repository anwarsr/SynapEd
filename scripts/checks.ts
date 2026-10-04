/**
 * Penghitung pemeriksaan untuk skrip verifikasi.
 *
 * Dipisah dari `testSupport.ts` karena berkas itu menjalankan `initAdmin()` dan
 * membaca `frontend/.env.local` DI LEVEL MODUL. Suite yang hanya menguji logika
 * murni — logika yang jalannya di browser dan tidak pernah menyentuh Firestore —
 * akan ikut menuntut kredensial Firebase hanya untuk meminjam `check`/`finish`.
 *
 * `testSupport.ts` me-re-export keduanya, jadi seluruh suite lama tidak berubah
 * sebarispun dan tetap ada satu implementasi.
 */

let failures = 0;

export function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? "  OK  " : " GAGAL"}  ${name} — ${detail}`);
  if (!ok) failures++;
}

export function finish() {
  console.log(failures === 0 ? "\nSemua pemeriksaan lulus.\n" : `\n${failures} pemeriksaan gagal.\n`);
  process.exit(failures === 0 ? 0 : 1);
}
