/**
 * Verifikasi penjagaan halaman admin dari sisi server, tanpa membuka browser.
 *
 * Caranya: buat dua akun uji SEMENTARA (satu admin, satu biasa), masuk lewat
 * REST persis seperti yang dilakukan SDK di browser, tukar ID token-nya menjadi
 * session cookie, lalu ketuk halaman yang dijaga dan periksa ke mana server
 * mengalihkan. Yang diuji adalah penjaga sungguhan, bukan tiruannya.
 *
 * Akun uji selalu dihapus lagi di akhir, termasuk kalau ada pemeriksaan yang
 * gagal di tengah jalan. Akun asli tidak disentuh sama sekali — mengubah sandi
 * atau role akun sungguhan hanya untuk pengujian jelas bukan pilihan.
 *
 *   npx tsx scripts/verify-admin.ts [baseUrl]
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAuth, type Auth } from "firebase-admin/auth";
import { initAdmin, targetLabel } from "./project";

const BASE = process.argv[2] ?? "http://localhost:3000";
const COOKIE = "synaped_session";

/** Skrip ini tidak lewat Next.js, jadi .env.local harus dibaca sendiri. */
function readApiKey(): string {
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  const env = readFileSync(resolve(__dirname, "../frontend/.env.local"), "utf8");
  const match = env.match(/^NEXT_PUBLIC_FIREBASE_API_KEY=(.+)$/m);
  if (!match) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY tidak ada di frontend/.env.local");
  return match[1].trim();
}

const apiKey = readApiKey();
const auth: Auth = getAuth(initAdmin());

/** Masuk dengan email+sandi lewat REST — jalur yang sama dengan SDK klien. */
async function idTokenFor(email: string, password: string): Promise<string> {
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

interface TestUser {
  uid: string;
  email: string;
  cookie: string;
}

async function createTestUser(role: "admin" | "user"): Promise<TestUser> {
  const email = `verify-${role}-${randomUUID().slice(0, 8)}@synaped.test`;
  const password = randomUUID();

  const user = await auth.createUser({ email, password, displayName: `Uji ${role}` });
  if (role === "admin") await auth.setCustomUserClaims(user.uid, { role: "admin" });

  // Claim disematkan saat token diterbitkan, jadi masuknya HARUS setelah
  // setCustomUserClaims — kalau dibalik, token-nya tidak membawa role.
  const idToken = await idTokenFor(email, password);
  const cookie = await auth.createSessionCookie(idToken, { expiresIn: 5 * 24 * 60 * 60 * 1000 });

  return { uid: user.uid, email, cookie };
}

/** Jangan ikuti redirect — justru redirect itulah yang sedang diuji. */
async function probe(path: string, cookie?: string) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: cookie ? { cookie: `${COOKIE}=${cookie}` } : {},
  });
  return { status: res.status, location: res.headers.get("location"), res };
}

let failures = 0;

function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? "  OK  " : " GAGAL"}  ${name} — ${detail}`);
  if (!ok) failures++;
}

async function run(admin: TestUser, plain: TestUser) {
  // 1. Anonim tidak boleh melihat /admin sama sekali.
  {
    const { status, location } = await probe("/admin");
    check(
      "/admin anonim -> /login",
      status >= 300 && status < 400 && (location ?? "").includes("/login"),
      `${status} ${location ?? "(tanpa Location)"}`,
    );
  }

  // 2. Sudah masuk tapi bukan admin: dialihkan ke /dashboard, bukan /login —
  //    beda perlakuan yang memang disengaja di requireAdmin.
  {
    const list = await probe("/admin", plain.cookie);
    check(
      "/admin sebagai user biasa -> /dashboard",
      list.status >= 300 && list.status < 400 && (list.location ?? "").includes("/dashboard"),
      `${list.status} ${list.location ?? "(tanpa Location)"}`,
    );

    const detail = await probe(`/admin/users/${admin.uid}`, plain.cookie);
    check(
      "/admin/users/[uid] sebagai user biasa -> /dashboard",
      detail.status >= 300 && detail.status < 400 && (detail.location ?? "").includes("/dashboard"),
      `${detail.status} ${detail.location ?? "(tanpa Location)"}`,
    );

    // Halaman biasa tetap boleh dibuka — penjaga admin tidak boleh
    // ikut mengunci sisa aplikasi.
    const dash = await probe("/dashboard", plain.cookie);
    const dashHtml = await dash.res.text();
    check("/dashboard sebagai user biasa -> 200", dash.status === 200, String(dash.status));
    check(
      "form profil lengkap terpasang",
      ["Foto Profil", "Nomor HP", "Nama", "Email", "Kata Sandi"].every((h) =>
        dashHtml.includes(h),
      ),
      "foto, nomor HP, nama, email, kata sandi",
    );
  }

  // 3. Admin: halaman terbuka dan benar-benar memuat daftar akun.
  {
    const list = await probe("/admin", admin.cookie);
    const html = await list.res.text();
    check("/admin sebagai admin -> 200", list.status === 200, String(list.status));

    const everyone = await auth.listUsers(1000);
    check(
      "daftar memuat seluruh akun",
      everyone.users.every((u) => html.includes(u.uid)),
      `${everyone.users.length} akun dicari di dalam HTML`,
    );
    check("baris admin ditandai", html.includes("Admin"), "label role");

    // Panel admin harus bersih dari isi situs publik. Ini diuji di dua halaman
    // karena keduanya dulu memakai Navbar + Footer yang sama.
    const marketing = ["Kurikulum", "Daftar Gratis", "Kebijakan Privasi", "Neuroscience", "FAQ"];
    check(
      "/admin tanpa navigasi kursus & footer situs",
      marketing.every((t) => !html.includes(t)),
      marketing.filter((t) => html.includes(t)).join(", ") || "tidak ada satu pun",
    );

    const detail = await probe(`/admin/users/${plain.uid}`, admin.cookie);
    const detailHtml = await detail.res.text();
    check("/admin/users/[uid] sebagai admin -> 200", detail.status === 200, String(detail.status));
    check("detail menampilkan email akun itu", detailHtml.includes(plain.email), plain.email);
    check(
      "/admin/users/[uid] tanpa navigasi kursus & footer situs",
      marketing.every((t) => !detailHtml.includes(t)),
      marketing.filter((t) => detailHtml.includes(t)).join(", ") || "tidak ada satu pun",
    );

    const missing = await probe("/admin/users/tidak-ada-uid-ini", admin.cookie);
    check("uid ngawur -> 404", missing.status === 404, String(missing.status));
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const admin = await createTestUser("admin");
  const plain = await createTestUser("user");
  console.log(`akun uji dibuat: ${admin.email} (admin), ${plain.email} (user)\n`);

  try {
    await run(admin, plain);
  } finally {
    await auth.deleteUsers([admin.uid, plain.uid]);
    console.log("\nakun uji dihapus.");
  }

  console.log(failures === 0 ? "\nSemua pemeriksaan lulus.\n" : `\n${failures} pemeriksaan gagal.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
