/**
 * Memeriksa apakah konfigurasi Firebase sudah benar — dijalankan setelah
 * mengisi frontend/.env.local, SEBELUM menjalankan migrasi.
 *
 *   npm run check
 *
 * Skrip ini hanya MEMBACA. Tidak ada yang ditulis atau diubah.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initAdmin } from "./project";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const ENV_PATH = resolve(__dirname, "../frontend/.env.local");

const ok = (m: string) => console.log(`  ✓ ${m}`);
const bad = (m: string) => console.log(`  ✗ ${m}`);
const info = (m: string) => console.log(`    ${m}`);

let failures = 0;
function fail(m: string, hint?: string) {
  bad(m);
  if (hint) info(hint);
  failures++;
}

/** Membaca .env.local secara sederhana (KEY=value, tanda kutip dilepas). */
function readEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

async function main() {
  console.log("\nMemeriksa konfigurasi Firebase\n" + "=".repeat(46) + "\n");

  // ── 1. Berkas .env.local ──────────────────────────────────────────
  console.log("1. frontend/.env.local");
  if (!existsSync(ENV_PATH)) {
    fail("tidak ditemukan", "Jalankan: cd frontend && copy .env.example .env.local");
    console.log("\nBerhenti — perbaiki dulu yang di atas.\n");
    process.exit(1);
  }
  ok("ditemukan");

  const env = readEnvFile(ENV_PATH);
  const useEmulator = env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";
  const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "";

  // ── 2. Variabel wajib ─────────────────────────────────────────────
  console.log("\n2. Variabel wajib");
  const required = [
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ];
  for (const key of required) {
    const v = env[key];
    if (!v) fail(`${key} kosong`);
    else if (v.startsWith("demo-") && !useEmulator)
      fail(`${key} masih bernilai contoh ("${v}")`, "Ganti dengan nilai dari Firebase Console.");
    else ok(`${key} = ${v.length > 34 ? v.slice(0, 31) + "..." : v}`);
  }

  // ── 3. Mode ───────────────────────────────────────────────────────
  console.log("\n3. Mode");
  const emuHosts = [env.FIRESTORE_EMULATOR_HOST, env.FIREBASE_AUTH_EMULATOR_HOST].filter(Boolean);

  if (useEmulator) {
    ok("MODE EMULATOR (lokal, gratis, offline)");
    if (emuHosts.length !== 2)
      fail(
        "FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST tidak lengkap",
        "Mode emulator butuh keduanya.",
      );
    else ok("kedua *_EMULATOR_HOST terisi");
    if (!projectId.startsWith("demo-"))
      info(
        `Catatan: project ID "${projectId}" tidak diawali "demo-". ` +
          `Emulator tetap jalan, tetapi awalan "demo-" menjamin tidak ada koneksi ke Firebase asli.`,
      );
  } else {
    ok("MODE PRODUKSI (proyek Firebase asli)");
    if (emuHosts.length > 0)
      fail(
        "masih ada baris *_EMULATOR_HOST",
        "HAPUS FIRESTORE_EMULATOR_HOST dan FIREBASE_AUTH_EMULATOR_HOST — kalau tidak, aplikasi tetap menunjuk ke emulator.",
      );
    else ok("tidak ada sisa *_EMULATOR_HOST");

    if (projectId.startsWith("demo-"))
      fail(
        `project ID masih "${projectId}"`,
        'Project ID berawalan "demo-" tidak pernah bisa terhubung ke Firebase asli.',
      );
  }

  // ── 4. .firebaserc ────────────────────────────────────────────────
  console.log("\n4. .firebaserc");
  const rcPath = resolve(__dirname, "../.firebaserc");
  if (!existsSync(rcPath)) {
    fail(".firebaserc tidak ditemukan");
  } else {
    const rc = JSON.parse(readFileSync(rcPath, "utf8")) as { projects?: { default?: string } };
    const rcProject = rc.projects?.default ?? "";
    if (rcProject === projectId) ok(`cocok dengan .env.local ("${rcProject}")`);
    else
      fail(
        `tidak cocok: .firebaserc "${rcProject}" vs .env.local "${projectId}"`,
        "Keduanya harus sama persis.",
      );
  }

  // ── 5. Koneksi sungguhan ──────────────────────────────────────────
  console.log("\n5. Koneksi");
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;

  {
    if (!useEmulator && !svc) {
      info("FIREBASE_SERVICE_ACCOUNT tidak disetel — mencoba Application Default Credentials");
    }
    try {
      if (useEmulator) {
        process.env.FIRESTORE_EMULATOR_HOST ??= env.FIRESTORE_EMULATOR_HOST;
        process.env.FIREBASE_AUTH_EMULATOR_HOST ??= env.FIREBASE_AUTH_EMULATOR_HOST;
      }

      const app = initAdmin();

      const snap = await getFirestore(app).collection("courses").get();
      ok(`Firestore terhubung — ${snap.size} kursus`);
      if (snap.size === 0) info("Kosong. Jalankan: npm run migrate:firestore");
      else {
        // Pemeriksaan ini hanya menjaga EMPAT kursus hasil migrasi. Dulu ia
        // menghitung seluruh koleksi dan mengharuskan tepat 4/19/52 — begitu
        // educator mulai membuat kursus sendiri, angka itu pasti berbeda dan
        // pemeriksaannya berteriak gagal padahal tidak ada yang rusak.
        const MIGRATED = ["dasar-neuroscience", "pengenalan-eeg", "implementasi-eeg-muse", "analisis-data-eeg"];

        let sections = 0;
        let lessons = 0;
        let found = 0;

        snap.docs.forEach((d) => {
          if (!MIGRATED.includes(d.id)) return;
          found++;
          const data = d.data() as { sections?: { lessons?: unknown[] }[] };
          for (const s of data.sections ?? []) {
            sections++;
            lessons += s.lessons?.length ?? 0;
          }
        });

        const good = found === 4 && sections === 19 && lessons === 52;
        (good ? ok : bad)(
          `kursus bawaan: ${found} kursus / ${sections} section / ${lessons} lesson` +
            (good ? "" : " — SEHARUSNYA 4/19/52"),
        );
        info(`total di katalog: ${snap.size} kursus (termasuk buatan educator)`);
        if (!good) failures++;
      }

      const users = await getAuth(app).listUsers(1000);
      ok(`Authentication terhubung — ${users.users.length} akun`);
      if (users.users.length === 0) info("Kosong. Jalankan: npm run import:users");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      fail(`gagal terhubung: ${msg.split("\n")[0]}`);
      if (/ECONNREFUSED/.test(msg)) info("Emulator belum jalan? Jalankan: npm run emulators");
      if (/PERMISSION_DENIED|UNAUTHENTICATED|could not load the default credentials|Could not refresh access token/i.test(msg))
        info("Belum ada kredensial. Jalankan: gcloud auth application-default login");
      if (/NOT_FOUND|does not exist/.test(msg)) info("Firestore belum dibuat di Console (langkah 4).");
    }
  }

  // ── Ringkasan ─────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(46));
  if (failures === 0) {
    console.log("Semua pemeriksaan LULUS.\n");
  } else {
    console.log(`${failures} masalah ditemukan — perbaiki dulu sebelum lanjut.\n`);
    process.exit(1);
  }
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
