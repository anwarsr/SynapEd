/**
 * Menguji bahwa nama yang diketik saat mendaftar benar-benar menjadi nama akun.
 *
 * Alur pendaftaran meniru apa yang dilakukan SDK di browser, langkah demi
 * langkah lewat REST:
 *
 *   1. accounts:signUp            -> akun dibuat, ID token terbit TANPA nama
 *   2. accounts:update            -> displayName disetel
 *   3. tukar token jadi cookie    -> di sinilah bug-nya dulu bersarang
 *
 * Token dari langkah 1 belum memuat nama. Kalau token ITU yang ditukar menjadi
 * session cookie, nama di cookie kosong dan server jatuh ke potongan email —
 * "digibinproject@gmail.com" menjadi "digibinproject". Karena itu token wajib
 * diambil ulang lebih dulu.
 *
 * Skrip ini membuktikan keduanya: token basi memang salah, token segar benar.
 *
 *   npx tsx scripts/verify-signup.ts [baseUrl]
 */
import { randomUUID } from "node:crypto";
import { BASE, auth, check, finish, probeText, readEnv } from "./testSupport";
import { targetLabel } from "./project";

const apiKey = readEnv("NEXT_PUBLIC_FIREBASE_API_KEY");

interface SignUp {
  idToken: string;
  refreshToken: string;
  localId: string;
}

async function identity<T>(method: string, body: unknown): Promise<T> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  const json = (await res.json()) as T & { error?: { message: string } };
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json;
}

/** Token diambil ulang — persis yang dilakukan getIdToken(true) di browser. */
async function refreshIdToken(refreshToken: string): Promise<string> {
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  });

  const json = (await res.json()) as { id_token?: string; error?: { message: string } };
  if (!json.id_token) throw new Error(json.error?.message ?? "gagal menyegarkan token");
  return json.id_token;
}

function cookieFor(idToken: string) {
  return auth.createSessionCookie(idToken, { expiresIn: 5 * 24 * 60 * 60 * 1000 });
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  // Email sengaja dibuat agar potongan depannya JELAS berbeda dari nama yang
  // diketik — kalau tertukar, langsung kelihatan.
  const local = `digibinproject-${randomUUID().slice(0, 6)}`;
  const email = `${local}@synaped.test`;
  const password = randomUUID();
  const nama = "Budi Santoso";

  console.log(`email : ${email}`);
  console.log(`nama  : ${nama}\n`);

  const signUp = await identity<SignUp>("signUp", { email, password, returnSecureToken: true });

  try {
    // Langkah 2: nama disetel SESUDAH akun dibuat.
    await identity("update", { idToken: signUp.idToken, displayName: nama });

    check(
      "nama tersimpan di Firebase",
      (await auth.getUser(signUp.localId)).displayName === nama,
      nama,
    );

    // ── Token basi: keadaan sebelum diperbaiki ──────────────────────
    {
      const page = await probeText("/profil", await cookieFor(signUp.idToken));
      check(
        "token dari sebelum nama disetel memang tidak membawa nama",
        page.status === 200 && page.html.includes(local) && !page.html.includes(nama),
        "inilah sebab bug-nya — bukan tebakan",
      );
    }

    // ── Token segar: yang sekarang dipakai aplikasi ─────────────────
    {
      const fresh = await refreshIdToken(signUp.refreshToken);
      const page = await probeText("/profil", await cookieFor(fresh));

      check(
        "token yang diambil ulang membawa nama yang benar",
        page.status === 200 && page.html.includes(nama),
        nama,
      );
      check(
        "potongan email tidak lagi dipakai sebagai nama",
        !page.html.includes(`Halo, ${local}`),
        "sapaan memakai nama asli",
      );
    }
  } finally {
    await auth.deleteUser(signUp.localId).catch(() => undefined);
    console.log("\nakun uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
