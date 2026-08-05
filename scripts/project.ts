/**
 * Satu sumber kebenaran untuk project ID dan inisialisasi Admin SDK.
 *
 * Sebelumnya tiap skrip punya nilai default sendiri, dan itu sempat membuat
 * migrasi menulis ke proyek "synaped-dev" sementara pemeriksa membaca
 * "demo-synaped" — dua proyek berbeda di dalam emulator yang sama, sehingga
 * data terlihat hilang. Sekarang semuanya membaca .firebaserc.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, initializeApp, type App } from "firebase-admin/app";

export function resolveProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;

  const rc = JSON.parse(readFileSync(resolve(__dirname, "../.firebaserc"), "utf8")) as {
    projects?: { default?: string };
  };
  const id = rc.projects?.default;

  if (!id) {
    throw new Error(
      'Project ID tidak ditemukan. Isi "projects.default" di .firebaserc ' +
        "atau setel FIREBASE_PROJECT_ID.",
    );
  }
  return id;
}

export function initAdmin(): App {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = resolveProjectId();

  if (raw) {
    const p = JSON.parse(raw) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };

    if (p.project_id !== projectId) {
      throw new Error(
        `Service account milik proyek "${p.project_id}", ` +
          `tetapi .firebaserc menunjuk "${projectId}". Keduanya harus sama.`,
      );
    }

    return initializeApp({
      credential: cert({
        projectId: p.project_id,
        clientEmail: p.client_email,
        privateKey: p.private_key.replace(/\\n/g, "\n"),
      }),
      projectId: p.project_id,
    });
  }

  // Tanpa service account, Admin SDK memakai Application Default Credentials.
  // ADC didapat dari `gcloud auth application-default login` — cara yang lebih
  // aman daripada service account, karena tidak ada berkas kunci berumur panjang
  // yang tersimpan di disk dan bisa bocor.
  //
  // Kalau emulator sedang dipakai, kredensial tidak diperiksa sama sekali.
  return initializeApp({ projectId });
}

/** Label untuk log, supaya jelas skrip sedang menulis ke mana. */
export function targetLabel(): string {
  const id = resolveProjectId();
  const emu = process.env.FIRESTORE_EMULATOR_HOST ?? process.env.FIREBASE_AUTH_EMULATOR_HOST;
  return emu ? `emulator ${emu} (proyek "${id}")` : `proyek Firebase ASLI "${id}"`;
}
