import "server-only";
import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Admin SDK — hanya di server.
 *
 * Di Firebase App Hosting kredensialnya terbaca otomatis lewat Application
 * Default Credentials, jadi tidak ada service-account JSON yang perlu
 * disimpan. Variabel FIREBASE_SERVICE_ACCOUNT hanya dibutuhkan saat
 * menjalankan skrip dari laptop.
 *
 * Emulator dikenali lewat FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST
 * yang dibaca sendiri oleh SDK — tidak perlu kode khusus di sini.
 */
function adminApp(): App {
  if (getApps().length) return getApp();

  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    const parsed = JSON.parse(raw) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    return initializeApp({
      credential: cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        // Kunci privat sering tersimpan dengan \n yang ter-escape di .env
        privateKey: parsed.private_key.replace(/\\n/g, "\n"),
      }),
      projectId: parsed.project_id,
    });
  }

  return initializeApp({ projectId });
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}
