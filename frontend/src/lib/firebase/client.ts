"use client";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let cachedAuth: Auth | null = null;

function app(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(config);
}

/**
 * SDK klien dipakai HANYA untuk alur masuk/daftar dan pengaturan akun.
 * Pembacaan katalog dilakukan di server lewat Admin SDK, sehingga data
 * kursus sudah ikut terkirim pada HTML pertama.
 */
export function firebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;

  cachedAuth = getAuth(app());

  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true") {
    connectAuthEmulator(cachedAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  }

  return cachedAuth;
}
