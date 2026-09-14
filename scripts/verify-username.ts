/**
 * Menguji username: pembuatan otomatis saat masuk, penggantian, keunikan di
 * bawah balapan, dan tampilannya di profil.
 *
 * Yang paling keras diuji: DUA ORANG TIDAK PERNAH memegang username yang
 * sama. Sepuluh akun yang mengganti ke nama yang sama secara bersamaan harus
 * berakhir dengan tepat satu pemenang dan tepat satu reservasi.
 *
 * Butuh dev server berjalan (npm run dev).
 *
 *   npx tsx scripts/verify-username.ts [baseUrl]
 */
import { randomUUID } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import {
  BASE,
  actionId,
  app,
  auth,
  callAction,
  check,
  createTestUser,
  finish,
  probe,
  probeText,
  readEnv,
  signIn,
  type TestUser,
} from "./testSupport";
import { resolveProjectId, targetLabel } from "./project";

const db = getFirestore(app);
const SETTINGS = "/pengaturan";

const dibuat: string[] = [];

/** Akun dengan email pilihan sendiri — createTestUser memakai pola tetap. */
async function akunDenganEmail(email: string) {
  const password = randomUUID();
  const u = await auth.createUser({ email, password, displayName: "Uji Username" });
  dibuat.push(u.uid);
  return { uid: u.uid, email, password };
}

/** Jalur yang sama dengan browser: ID token -> /api/auth/session. */
async function masuk(email: string, password: string): Promise<number> {
  const idToken = await signIn(email, password);
  const res = await fetch(`${BASE}/api/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  return res.status;
}

async function usernameDari(uid: string): Promise<string | undefined> {
  return (await db.collection("users").doc(uid).get()).get("username");
}

async function reservasiMilik(uid: string): Promise<string[]> {
  const q = await db.collection("usernames").where("uid", "==", uid).get();
  return q.docs.map((d) => d.id);
}

async function run() {
  const acak = randomUUID().slice(0, 6);

  // ── 1. Dibuat otomatis dari email saat masuk ──────────────────────────
  const dasar = `budi.santoso${acak}`;
  const budi = await akunDenganEmail(`${dasar}+kursus@synaped.test`);
  const kembar = await akunDenganEmail(`${dasar}@lain.synaped.test`);

  const sesi = await masuk(budi.email, budi.password);
  check("sesi tetap dibuat", sesi === 200, `HTTP ${sesi}`);
  check(
    "username dibentuk dari bagian lokal email, tanpa +alias",
    (await usernameDari(budi.uid)) === dasar,
    `@${await usernameDari(budi.uid)}`,
  );

  await masuk(kembar.email, kembar.password);
  const namaKembar = await usernameDari(kembar.uid);
  check(
    "akun kedua dengan bagian lokal yang sama mendapat nama berbeda",
    typeof namaKembar === "string" && namaKembar !== dasar && namaKembar.startsWith(dasar),
    `@${namaKembar}`,
  );

  // ── 2. Masuk berulang tidak membuat reservasi baru ────────────────────
  await Promise.all([masuk(budi.email, budi.password), masuk(budi.email, budi.password)]);
  await masuk(budi.email, budi.password);
  const milikBudi = await reservasiMilik(budi.uid);
  check(
    "masuk berkali-kali (termasuk bersamaan) = satu username, satu reservasi",
    (await usernameDari(budi.uid)) === dasar && milikBudi.length === 1,
    `${milikBudi.length} reservasi: ${milikBudi.join(", ")}`,
  );

  // ── 3. Penggantian ────────────────────────────────────────────────────
  const pemilik: TestUser = await createTestUser("user", "username");
  dibuat.push(pemilik.uid);
  await masuk(pemilik.email, pemilik.password);
  const namaAwal = await usernameDari(pemilik.uid);

  await probe(SETTINGS, pemilik.cookie);
  const gantiId = await actionId("pengaturan", "changeUsername");

  {
    const anon = await callAction(SETTINGS, gantiId, [`anon${acak}`]);
    check("anonim tidak bisa mengganti username", anon.includes("masuk terlebih dahulu"), "penjaga sesi");
  }

  for (const salah of ["ab", ".abc", "abc.", "a..b", "12345", "admin", "a".repeat(31), "nama spasi"]) {
    const out = await callAction(SETTINGS, gantiId, [salah], pemilik.cookie);
    check(
      `username tidak sah ditolak server: "${salah.slice(0, 12)}"`,
      !out.includes("Username diganti") && (await usernameDari(pemilik.uid)) === namaAwal,
      "tetap nama lama",
    );
  }

  {
    const out = await callAction(SETTINGS, gantiId, [dasar], pemilik.cookie);
    check(
      "mengganti ke username milik orang lain ditolak",
      out.includes("sudah dipakai") && (await usernameDari(budi.uid)) === dasar,
      "pemiliknya tetap",
    );
  }

  const namaBaru = `ganti.${acak}`;
  {
    // Argumen kedua: uid orang lain. Harus diabaikan.
    const out = await callAction(SETTINGS, gantiId, [`@Ganti.${acak}`, budi.uid], pemilik.cookie);
    const milik = await reservasiMilik(pemilik.uid);
    check(
      "username diganti (masukan dinormalkan)",
      out.includes("Username diganti") && (await usernameDari(pemilik.uid)) === namaBaru,
      `@${await usernameDari(pemilik.uid)}`,
    );
    check(
      "reservasi lama dilepas, hanya yang baru tersisa",
      milik.length === 1 && milik[0] === namaBaru,
      milik.join(", "),
    );
    check("uid titipan diabaikan", (await usernameDari(budi.uid)) === dasar, "akun lain utuh");
  }

  {
    const out = await callAction(SETTINGS, gantiId, [`lagi.${acak}`], pemilik.cookie);
    check(
      "jeda 14 hari berlaku setelah mengganti",
      out.includes("sekali setiap 14 hari") && (await usernameDari(pemilik.uid)) === namaBaru,
      "penggantian kedua ditolak",
    );
  }

  // Nama lama yang dilepas benar-benar bebas: orang lain boleh mengambilnya.
  if (namaAwal) {
    const pengambil = await createTestUser("user", "pengambil");
    dibuat.push(pengambil.uid);
    const out = await callAction(SETTINGS, gantiId, [namaAwal], pengambil.cookie);
    check(
      "username yang dilepas bisa diambil akun lain",
      out.includes("Username diganti") && (await usernameDari(pengambil.uid)) === namaAwal,
      `@${namaAwal}`,
    );
  }

  // ── 4. Balapan: sepuluh akun, satu nama ───────────────────────────────
  {
    const pelomba = await Promise.all(
      Array.from({ length: 10 }, (_, i) => createTestUser("user", `lomba${i}`)),
    );
    pelomba.forEach((p) => dibuat.push(p.uid));

    const rebutan = `rebutan.${acak}`;
    const hasil = await Promise.all(
      pelomba.map((p) => callAction(SETTINGS, gantiId, [rebutan], p.cookie)),
    );
    const menang = hasil.filter((h) => h.includes("Username diganti")).length;

    const res = await db.collection("usernames").doc(rebutan).get();
    const pemegang = (
      await Promise.all(pelomba.map(async (p) => ((await usernameDari(p.uid)) === rebutan ? 1 : 0)))
    ).reduce<number>((a, b) => a + b, 0);

    check("10 penggantian bersamaan ke nama yang sama: tepat satu berhasil", menang === 1, `${menang} berhasil`);
    check(
      "tepat satu akun memegang nama itu, dan reservasinya miliknya",
      pemegang === 1 && pelomba.some((p) => p.uid === res.get("uid")),
      `${pemegang} pemegang`,
    );
  }

  // ── 5. Tampil di profil ───────────────────────────────────────────────
  {
    const publik = await probeText(`/profil/${pemilik.uid}`);
    check("@username tampil di profil publik", publik.html.includes(`@${namaBaru}`), "ProfileHeader");
    check("email tidak tampil di profil publik", !publik.html.includes(pemilik.email), "privasi");

    const sendiri = await probeText(SETTINGS, pemilik.cookie);
    check("formulir username di pengaturan berisi nama sekarang", sendiri.html.includes(`value="${namaBaru}"`), "UsernameForm");
  }

  // ── 6. Nomor HP untuk akun yang punya bio DAN username ────────────────
  {
    await db.collection("users").doc(pemilik.uid).set({ bio: "Punya bio." }, { merge: true });
    const telId = await actionId("pengaturan", "updateMyPhone");
    const out = await callAction(SETTINGS, telId, ["0812-1111-2222"], pemilik.cookie);
    const d = (await db.collection("users").doc(pemilik.uid).get()).data() ?? {};
    check(
      "nomor HP tersimpan untuk akun ber-bio dan ber-username",
      out.includes("Nomor HP disimpan") && d.phone === "0812-1111-2222" && d.username === namaBaru,
      `phone=${d.phone}, username=${d.username}`,
    );
  }

  // ── 7. Pencarian untuk editor kontributor ─────────────────────────────
  {
    const dicari = await akunDenganEmail(`cari.${acak}@synaped.test`);
    const dicari2 = await akunDenganEmail(`cari.${acak}.dua@synaped.test`);
    await masuk(dicari.email, dicari.password);
    await masuk(dicari2.email, dicari2.password);

    const educator = await createTestUser("educator", "cari-educator");
    dibuat.push(educator.uid);

    const form = await probeText("/educator/courses/new", educator.cookie);
    check("editor kontributor tampil di form kursus baru", form.html.includes("Kontributor &amp; bagi hasil"), "ContributorEditor");

    const cariId = await actionId("educator/courses/new", "searchUsernames");
    const NEW = "/educator/courses/new";

    const olehUser = await callAction(NEW, cariId, [`cari.${acak}`], pemilik.cookie);
    check("pengguna biasa tidak bisa mencari username", olehUser.includes("Hanya educator"), "penjaga peran");

    const hasil = await callAction(NEW, cariId, [`@Cari.${acak}`], educator.cookie);
    const iPersis = hasil.indexOf(`"username":"cari.${acak}"`);
    const iDua = hasil.indexOf(`"username":"cari.${acak}.dua"`);
    check(
      "hasil: kecocokan persis paling atas, lalu awalan",
      iPersis !== -1 && iDua !== -1 && iPersis < iDua,
      `persis@${iPersis}, awalan@${iDua}`,
    );
    check(
      "hasil pencarian tidak memuat email",
      !hasil.includes(dicari.email) && !hasil.includes("synaped.test"),
      "tanpa alamat kontak",
    );

    const kosong = await callAction(NEW, cariId, ["zz-tidak valid!"], educator.cookie);
    check("masukan tidak sah menghasilkan daftar kosong", kosong.includes('"hits":[]'), "bukan galat");

    // Batas laju: 30 per menit. Dua panggilan educator di atas sudah
    // terhitung (panggilan pengguna biasa ditolak sebelum dihitung), jadi
    // dari 30 berikutnya tepat 2 yang harus ditolak.
    const beruntun = await Promise.all(
      Array.from({ length: 30 }, () => callAction(NEW, cariId, [`cari.${acak}`], educator.cookie)),
    );
    const ditolak = beruntun.filter((r) => r.includes("Terlalu banyak pencarian")).length;
    check("batas laju pencarian berlaku", ditolak === 2, `${ditolak} dari 30 ditolak`);
  }

  // ── 8. Rules: koleksi usernames tertutup dari klien ───────────────────
  {
    const token = await signIn(pemilik.email, pemilik.password);
    const url = `https://firestore.googleapis.com/v1/projects/${resolveProjectId()}/databases/(default)/documents/usernames/${namaBaru}`;
    void readEnv;

    const baca = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    check("klien tidak bisa membaca usernames", baca.status === 403, `HTTP ${baca.status}`);

    const tulis = await fetch(`${url}x?updateMask.fieldPaths=uid`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields: { uid: { stringValue: pemilik.uid } } }),
    });
    check("klien tidak bisa mengklaim username sendiri", tulis.status === 403, `HTTP ${tulis.status}`);
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);
  try {
    await run();
  } finally {
    for (const uid of dibuat) {
      const milik = await reservasiMilik(uid).catch(() => []);
      await Promise.allSettled([
        ...milik.map((n) => db.collection("usernames").doc(n).delete()),
        db.collection("users").doc(uid).delete(),
      ]);
    }
    await auth.deleteUsers(dibuat).catch(() => undefined);
    console.log("\nakun & username uji dihapus.");
  }
  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
