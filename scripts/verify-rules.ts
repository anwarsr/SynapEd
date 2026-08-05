/**
 * Menguji security rules yang SEDANG TER-DEPLOY, bukan yang ada di berkas.
 *
 * REST API Firestore dan Storage menegakkan rules kalau permintaannya memakai
 * ID token pengguna (bukan Admin SDK, yang justru melewati rules sepenuhnya).
 * Jadi skrip ini masuk sebagai pengguna biasa dan mencoba hal-hal yang boleh
 * maupun yang harus ditolak.
 *
 * Yang paling penting di sini: memastikan pengguna TIDAK bisa menulis field
 * `role` ke dokumennya sendiri. Kalau itu lolos, siapa pun bisa mengangkat
 * dirinya jadi admin.
 *
 *   npx tsx scripts/verify-rules.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { initAdmin, resolveProjectId, targetLabel } from "./project";

function readEnv(key: string): string {
  if (process.env[key]) return process.env[key] as string;

  const env = readFileSync(resolve(__dirname, "../frontend/.env.local"), "utf8");
  const match = env.match(new RegExp(`^${key}=(.+)$`, "m"));
  if (!match) throw new Error(`${key} tidak ada di frontend/.env.local`);
  return match[1].trim();
}

const apiKey = readEnv("NEXT_PUBLIC_FIREBASE_API_KEY");
const bucket = readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
const projectId = resolveProjectId();

// initializeApp hanya boleh sekali; app-nya dipegang untuk dipakai ulang.
const app = initAdmin();
const auth: Auth = getAuth(app);

async function signIn(email: string, password: string): Promise<string> {
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

const docUrl = (uid: string, collection = "users") =>
  `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${uid}`;

/** PATCH dengan updateMask supaya perilakunya sama dengan setDoc({merge:true}). */
async function writeDoc(
  uid: string,
  token: string,
  fields: Record<string, { stringValue: string }>,
  collection = "users",
): Promise<number> {
  const mask = Object.keys(fields)
    .map((f) => `updateMask.fieldPaths=${f}`)
    .join("&");

  const res = await fetch(`${docUrl(uid, collection)}?${mask}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields }),
  });
  return res.status;
}

async function readDoc(uid: string, token: string, collection: string): Promise<number> {
  const res = await fetch(docUrl(uid, collection), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status;
}

async function uploadFile(path: string, token: string, body: Buffer, mime: string): Promise<number> {
  const res = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(path)}`,
    {
      method: "POST",
      headers: { "Content-Type": mime, Authorization: `Bearer ${token}` },
      body: new Uint8Array(body),
    },
  );
  return res.status;
}

let failures = 0;

function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? "  OK  " : " GAGAL"}  ${name} — ${detail}`);
  if (!ok) failures++;
}

/** PNG 1x1 sah — cukup untuk menguji rules contentType & ukuran. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function main() {
  console.log(`\nMenguji rules ter-deploy di ${targetLabel()}\n`);

  const email = `verify-rules-${randomUUID().slice(0, 8)}@synaped.test`;
  const password = randomUUID();
  const me = await auth.createUser({ email, password });

  const other = await auth.createUser({
    email: `verify-other-${randomUUID().slice(0, 8)}@synaped.test`,
    password: randomUUID(),
  });

  console.log(`akun uji: ${email}\n`);

  try {
    const token = await signIn(email, password);

    // ── Firestore users/{uid} ──────────────────────────────────
    check(
      "tulis phone ke dokumen sendiri -> boleh",
      (await writeDoc(me.uid, token, {
        phone: { stringValue: "081234567890" },
        updatedAt: { stringValue: new Date().toISOString() },
      })) === 200,
      "PATCH users/{uid} {phone, updatedAt}",
    );

    const selfPromote = await writeDoc(me.uid, token, { role: { stringValue: "admin" } });
    check(
      "tulis role ke dokumen sendiri -> DITOLAK",
      selfPromote === 403,
      `HTTP ${selfPromote} (naik pangkat sendiri harus mustahil)`,
    );

    const otherDoc = await writeDoc(other.uid, token, { phone: { stringValue: "0800" } });
    check(
      "tulis dokumen milik orang lain -> DITOLAK",
      otherDoc === 403,
      `HTTP ${otherDoc}`,
    );

    // ── Lamaran educator: tertutup rapat dari klien ────────────
    // Seluruh alurnya lewat Server Action + Admin SDK, jadi klien tidak boleh
    // menyentuhnya sama sekali. Yang paling berbahaya kalau bocor: menulis
    // status "accepted" ke lamaran sendiri.
    {
      const read = await readDoc(me.uid, token, "educatorApplications");
      check("baca lamaran sendiri -> DITOLAK", read === 403, `HTTP ${read}`);

      const selfAccept = await writeDoc(
        me.uid,
        token,
        { status: { stringValue: "accepted" } },
        "educatorApplications",
      );
      check(
        "tulis status accepted ke lamaran sendiri -> DITOLAK",
        selfAccept === 403,
        `HTTP ${selfAccept} (menerima diri sendiri harus mustahil)`,
      );
    }

    // ── Storage avatars/{uid} ──────────────────────────────────
    check(
      "unggah avatar sendiri -> boleh",
      (await uploadFile(`avatars/${me.uid}/avatar.png`, token, TINY_PNG, "image/png")) === 200,
      "PNG 1x1",
    );

    const foreignAvatar = await uploadFile(
      `avatars/${other.uid}/avatar.png`,
      token,
      TINY_PNG,
      "image/png",
    );
    check("unggah avatar orang lain -> DITOLAK", foreignAvatar === 403, `HTTP ${foreignAvatar}`);

    const notImage = await uploadFile(
      `avatars/${me.uid}/avatar.png`,
      token,
      Buffer.from("bukan gambar"),
      "text/plain",
    );
    check("unggah non-gambar sebagai avatar -> DITOLAK", notImage === 403, `HTTP ${notImage}`);

    const tooBig = await uploadFile(
      `avatars/${me.uid}/avatar.png`,
      token,
      Buffer.alloc(2 * 1024 * 1024 + 1024, 7),
      "image/png",
    );
    check("unggah gambar > 2 MB -> DITOLAK", tooBig === 403, `HTTP ${tooBig}`);
  } finally {
    // Admin SDK melewati rules, jadi sisa akun, dokumen, dan berkas uji
    // semuanya bisa dibersihkan dari sini.
    await auth.deleteUsers([me.uid, other.uid]);
    await getFirestore(app).doc(`users/${me.uid}`).delete().catch(() => undefined);
    await getStorage(app)
      .bucket(bucket)
      .deleteFiles({ prefix: `avatars/${me.uid}/` })
      .catch(() => undefined);

    console.log("\nakun & berkas uji dihapus.");
  }

  console.log(failures === 0 ? "\nSemua pemeriksaan lulus.\n" : `\n${failures} pemeriksaan gagal.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
