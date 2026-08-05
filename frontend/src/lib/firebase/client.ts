"use client";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";

let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedStorage: FirebaseStorage | null = null;

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
  if (useEmulator) {
    connectAuthEmulator(cachedAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  }
  return cachedAuth;
}

/** Firestore dari klien — hanya untuk profil milik sendiri (users/{uid}). */
export function firebaseDb(): Firestore {
  if (cachedDb) return cachedDb;

  cachedDb = getFirestore(app());
  if (useEmulator) connectFirestoreEmulator(cachedDb, "127.0.0.1", 8080);
  return cachedDb;
}

/** Storage dari klien — hanya untuk mengunggah foto profil. */
export function firebaseStorage(): FirebaseStorage {
  if (cachedStorage) return cachedStorage;

  cachedStorage = getStorage(app());
  if (useEmulator) connectStorageEmulator(cachedStorage, "127.0.0.1", 9199);
  return cachedStorage;
}
