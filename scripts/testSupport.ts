/**
 * Perkakas bersama untuk skrip verifikasi.
 *
 * Semuanya berputar di sekitar satu gagasan: menguji aplikasi lewat jalur yang
 * sama dengan browser sungguhan — masuk dengan email+sandi, menukar ID token
 * jadi session cookie, lalu mengetuk halaman dan memanggil Server Action.
 * Akun uji selalu sementara dan dihapus lagi; akun asli tidak disentuh.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAuth, type Auth } from "firebase-admin/auth";
import { initAdmin } from "./project";

export const COOKIE = "synaped_session";
export const BASE = process.argv[2] ?? "http://localhost:3000";

/** Skrip ini tidak lewat Next.js, jadi .env.local harus dibaca sendiri. */
export function readEnv(key: string): string {
  if (process.env[key]) return process.env[key] as string;

  const env = readFileSync(resolve(__dirname, "../frontend/.env.local"), "utf8");
  const match = env.match(new RegExp(`^${key}=(.+)$`, "m"));
  if (!match) throw new Error(`${key} tidak ada di frontend/.env.local`);
  return match[1].trim();
}

// initializeApp hanya boleh sekali per proses.
export const app = initAdmin();
export const auth: Auth = getAuth(app);

const apiKey = readEnv("NEXT_PUBLIC_FIREBASE_API_KEY");

/** Masuk dengan email+sandi lewat REST — jalur yang sama dengan SDK klien. */
export async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = (await res.json()) as { idToken?: string; error?: { message: string } };
  if (!body.idToken) throw new Error(body.error?.message ?? "gagal masuk");
  return body.idToken;
}

export interface TestUser {
  uid: string;
  email: string;
  password: string;
  cookie: string;
}

/** Akun uji baru beserta session cookie yang siap dipakai. */
export async function createTestUser(
  role: "admin" | "educator" | "user",
  tag = role,
): Promise<TestUser> {
  const email = `verify-${tag}-${randomUUID().slice(0, 8)}@synaped.test`;
  const password = randomUUID();

  const user = await auth.createUser({ email, password, displayName: `Uji ${tag}` });
  if (role !== "user") await auth.setCustomUserClaims(user.uid, { role });

  return { uid: user.uid, email, password, cookie: await freshCookie(email, password) };
}

/**
 * Session cookie baru untuk akun uji.
 *
 * Claim disematkan saat token diterbitkan, jadi setelah role berubah cookie
 * HARUS dibuat ulang — persis seperti pengguna sungguhan yang wajib masuk lagi.
 */
export async function freshCookie(email: string, password: string): Promise<string> {
  const idToken = await signIn(email, password);
  return auth.createSessionCookie(idToken, { expiresIn: 5 * 24 * 60 * 60 * 1000 });
}

/** Jangan ikuti redirect — justru redirect itulah yang sering diuji. */
export async function probe(path: string, cookie?: string) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: cookie ? { cookie: `${COOKIE}=${cookie}` } : {},
  });
  return { status: res.status, location: res.headers.get("location"), res };
}

export async function probeText(path: string, cookie?: string) {
  const r = await probe(path, cookie);
  return { ...r, html: await r.res.text() };
}

/**
 * ID sebuah Server Action, dibaca dari manifest yang ditulis Next saat halaman
 * dikompilasi. Manifest menyimpan `exportedName`, jadi pencariannya berdasarkan
 * nama fungsi — bukan menebak hash.
 */
export async function actionId(route: string, exportedName: string): Promise<string> {
  const file = resolve(
    __dirname,
    `../frontend/.next/dev/server/app/${route}/page/server-reference-manifest.json`,
  );

  const manifest = JSON.parse(readFileSync(file, "utf8")) as {
    node: Record<string, { exportedName?: string }>;
  };

  const found = Object.entries(manifest.node).find(([, v]) => v.exportedName === exportedName);
  if (!found) throw new Error(`Action "${exportedName}" tidak ada di manifest ${route}`);
  return found[0];
}

/**
 * Memanggil Server Action lewat HTTP, sama seperti yang dilakukan browser:
 * POST ke URL halaman dengan header Next-Action dan argumen sebagai JSON.
 *
 * Jawabannya berupa aliran RSC; isi teksnya diperiksa apa adanya karena yang
 * dicari hanya pesan hasil yang dikembalikan action.
 */
export async function callAction(
  path: string,
  id: string,
  args: unknown[],
  cookie?: string,
): Promise<string> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Next-Action": id,
      "Content-Type": "text/plain;charset=UTF-8",
      ...(cookie ? { cookie: `${COOKIE}=${cookie}` } : {}),
    },
    body: JSON.stringify(args),
  });
  return res.text();
}

let failures = 0;

export function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? "  OK  " : " GAGAL"}  ${name} — ${detail}`);
  if (!ok) failures++;
}

export function finish() {
  console.log(failures === 0 ? "\nSemua pemeriksaan lulus.\n" : `\n${failures} pemeriksaan gagal.\n`);
  process.exit(failures === 0 ? 0 : 1);
}
