/**
 * Memindahkan akun dari SQLite (backend NestJS) ke Firebase Authentication.
 *
 * Memakai Admin SDK, bukan `firebase auth:import`, karena CLI mengabaikan
 * FIREBASE_AUTH_EMULATOR_HOST dan tetap menembak Google asli (PROJECT_NOT_FOUND).
 * Admin SDK menghormati variabel itu, jadi skrip yang sama bisa dipakai untuk
 * emulator maupun proyek asli.
 *
 * Hash bcrypt dipertahankan supaya pengguna tidak perlu mengatur ulang kata
 * sandinya. Prefiks `$2y$` warisan Laravel dinormalkan ke `$2b$` — algoritmanya
 * identik, hanya penanda versinya berbeda.
 *
 * ⚠ BATAS PEMBUKTIAN — WAJIB DIUJI DI PROYEK ASLI
 * Impor ke Auth EMULATOR berhasil (4/4 akun terbuat), tetapi login memakai
 * kata sandi yang benar GAGAL di emulator. Uji kontrol membuktikan pendaftaran
 * & login normal berjalan baik, jadi kegagalan itu khusus pada verifikasi hash
 * bcrypt hasil impor — emulator tampaknya tidak mengimplementasikannya.
 *
 * Firebase Auth ASLI mendukung BCRYPT pada auth import, jadi besar kemungkinan
 * ini hanya keterbatasan emulator — TAPI itu belum terbukti. Setelah menjalankan
 * skrip ini ke proyek asli, SEGERA uji login satu akun. Kalau tetap gagal,
 * cadangannya: kirim tautan reset kata sandi (hanya 4 akun).
 *
 * Emulator:
 *   set FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
 *   npx tsx scripts/import-users-to-firebase.ts
 *
 * Proyek asli:
 *   set FIREBASE_SERVICE_ACCOUNT=<isi JSON service account>
 *   npx tsx scripts/import-users-to-firebase.ts
 */
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { initAdmin, targetLabel } from "./project";
import { getAuth, type UserImportRecord } from "firebase-admin/auth";

const SQLITE = resolve(__dirname, "./data/synaped.db");

interface Row {
  id: number;
  name: string;
  email: string;
  password: string;
  email_verified_at: string | null;
  created_at: string | null;
}

async function main() {
  if (!existsSync(SQLITE)) {
    console.error(`Database tidak ditemukan di ${SQLITE}`);
    process.exit(1);
  }

  const db = new DatabaseSync(SQLITE, { readOnly: true });
  const rows = db
    .prepare("SELECT id, name, email, password, email_verified_at, created_at FROM users")
    .all() as unknown as Row[];
  db.close();

  let normalised = 0;

  const users: UserImportRecord[] = rows.map((u) => {
    const isLegacy = u.password.startsWith("$2y$");
    if (isLegacy) normalised++;
    const hash = isLegacy ? `$2b$${u.password.slice(4)}` : u.password;

    return {
      uid: `sqlite-${u.id}`,
      email: u.email,
      emailVerified: Boolean(u.email_verified_at),
      displayName: u.name,
      // Untuk BCRYPT, Admin SDK menerima string hash sebagai Buffer mentah.
      passwordHash: Buffer.from(hash, "utf8"),
    };
  });

  const target = targetLabel();
  console.log(`Mengimpor ${users.length} akun ke ${target}…\n`);

  const auth = getAuth(initAdmin());
  const result = await auth.importUsers(users, { hash: { algorithm: "BCRYPT" } });

  // Akun yang sudah ada BUKAN kegagalan — skrip ini aman dijalankan berulang.
  // Firebase menolak menimpa uid yang sudah terpakai, dan itu memang benar:
  // menimpanya akan menghapus perubahan yang dibuat pengguna sejak impor.
  const existing = new Set<number>();
  const real: typeof result.errors = [];

  for (const e of result.errors) {
    if (/existing account|already exists/i.test(e.error.message)) existing.add(e.index);
    else real.push(e);
  }

  users.forEach((u, i) => {
    const mark = existing.has(i) ? "sudah ada" : real.some((r) => r.index === i) ? "GAGAL" : "diimpor";
    console.log(`  ${mark.padEnd(10)} ${u.email}`);
  });

  console.log(`\nDiimpor   : ${result.successCount}`);
  console.log(`Sudah ada : ${existing.size}`);
  console.log(`Gagal     : ${real.length}`);

  if (normalised) console.log(`\n${normalised} hash $2y$ dinormalkan ke $2b$.`);

  if (real.length) {
    console.log("\nRincian kegagalan:");
    for (const e of real) {
      console.log(`  ${users[e.index].email}: ${e.error.message}`);
    }
    process.exit(1);
  }

  if (existing.size === users.length) {
    console.log("\nSemua akun sudah ada — tidak ada yang diubah.");
  }
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
