/**
 * Menguji pembuatan kursus oleh educator dari ujung ke ujung.
 *
 * Server Action dipanggil lewat POST + header Next-Action, persis seperti yang
 * dilakukan browser saat tombol Terbitkan ditekan — jadi yang teruji kode
 * produksinya. Berkas diunggah lewat REST Storage memakai ID token educator,
 * sehingga storage.rules yang sedang ter-deploy ikut teruji.
 *
 * Butuh dev server berjalan (npm run dev).
 *
 *   npx tsx scripts/verify-course.ts [baseUrl]
 */
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
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
import { targetLabel } from "./project";

const db = getFirestore(app);
const bucket = readEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");

const PDF = Buffer.from("%PDF-1.4\n% berkas uji\n");

/** Unggah lewat REST dengan ID token pengguna — rules ikut ditegakkan. */
async function upload(path: string, idToken: string, mime: string, body: Buffer) {
  const res = await fetch(
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(path)}`,
    {
      method: "POST",
      headers: { "Content-Type": mime, Authorization: `Bearer ${idToken}` },
      body: new Uint8Array(body),
    },
  );
  return res.status;
}

function doc(path: string, name: string) {
  return { name, path, size: PDF.length, mime: "application/pdf" };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    title: "Kursus Uji Otomatis",
    shortDesc: "Kursus contoh yang dibuat oleh skrip verifikasi.",
    longDesc: "",
    level: "Pemula",
    category: "eeg",
    icon: "wave",
    duration: "1 jam",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ...overrides,
  };
}

const created: string[] = [];

async function run(educator: TestUser, biasa: TestUser) {
  // Manifest action baru ditulis setelah rutenya dikompilasi, dan di mode dev
  // Next mengompilasi rute saat pertama diminta.
  await probe("/educator/courses/new", educator.cookie);
  await probe("/educator/courses", educator.cookie);

  const createId = await actionId("educator/courses/new", "createCourse");
  const deleteId = await actionId("educator/courses", "deleteCourse");

  const NEW = "/educator/courses/new";
  const LIST = "/educator/courses";

  // ── Penjagaan halaman ─────────────────────────────────────────────
  {
    const anon = await probe(LIST);
    check(
      "kursus saya, anonim -> /login",
      anon.status >= 300 && anon.status < 400 && (anon.location ?? "").includes("/login"),
      `${anon.status} ${anon.location ?? ""}`,
    );

    const asUser = await probe(LIST, biasa.cookie);
    check(
      "kursus saya, pengguna biasa -> /educator",
      asUser.status >= 300 && asUser.status < 400 && (asUser.location ?? "").endsWith("/educator"),
      `${asUser.status} ${asUser.location ?? ""}`,
    );

    const form = await probeText(NEW, educator.cookie);
    check(
      "educator bisa membuka form",
      form.status === 200 && form.html.includes("Terbitkan Kursus"),
      String(form.status),
    );
  }

  // ── Unggahan berkas ───────────────────────────────────────────────
  const educatorToken = await signIn(educator.email, educator.password);
  const biasaToken = await signIn(biasa.email, biasa.password);

  const modulPath = `course-assets/${educator.uid}/uji/modul-materi.pdf`;
  const tugasPath = `course-assets/${educator.uid}/uji/tugas-akhir.pdf`;

  {
    check(
      "educator boleh mengunggah PDF",
      (await upload(modulPath, educatorToken, "application/pdf", PDF)) === 200,
      "modul",
    );
    check(
      "educator boleh mengunggah tugas",
      (await upload(tugasPath, educatorToken, "application/pdf", PDF)) === 200,
      "tugas",
    );

    const asUser = await upload(
      `course-assets/${biasa.uid}/uji/modul.pdf`,
      biasaToken,
      "application/pdf",
      PDF,
    );
    check("pengguna biasa DITOLAK mengunggah", asUser === 403, `HTTP ${asUser}`);

    const foreign = await upload(
      `course-assets/${biasa.uid}/uji/curi.pdf`,
      educatorToken,
      "application/pdf",
      PDF,
    );
    check("unggah ke folder orang lain DITOLAK", foreign === 403, `HTTP ${foreign}`);

    const exe = await upload(
      `course-assets/${educator.uid}/uji/jahat.exe`,
      educatorToken,
      "application/x-msdownload",
      PDF,
    );
    check("berkas selain PDF/Word DITOLAK", exe === 403, `HTTP ${exe}`);
  }

  const modul = doc(modulPath, "modul-materi.pdf");
  const tugas = doc(tugasPath, "tugas-akhir.pdf");

  // ── Penjagaan server action ───────────────────────────────────────
  {
    const byUser = await callAction(NEW, createId, [{ ...input(), modul, tugas }], biasa.cookie);
    check("pengguna biasa tidak bisa membuat kursus", byUser.includes("Hanya educator"), "role");

    const anon = await callAction(NEW, createId, [{ ...input(), modul, tugas }]);
    check("anonim tidak bisa membuat kursus", anon.includes("Hanya educator"), "tanpa cookie");

    const badVideo = await callAction(
      NEW,
      createId,
      [{ ...input({ videoUrl: "https://contoh.com/video" }), modul, tugas }],
      educator.cookie,
    );
    check("tautan bukan YouTube ditolak", badVideo.includes("tidak dikenali"), "validasi video");

    const shortTitle = await callAction(
      NEW,
      createId,
      [{ ...input({ title: "ab" }), modul, tugas }],
      educator.cookie,
    );
    check("judul terlalu pendek ditolak", shortTitle.includes("minimal 4 karakter"), "validasi judul");

    // Yang paling penting: path berkas datang dari klien, jadi tidak boleh
    // dipercaya begitu saja.
    const stolen = await callAction(
      NEW,
      createId,
      [
        {
          ...input(),
          modul: doc(`course-assets/${biasa.uid}/uji/modul.pdf`, "modul.pdf"),
          tugas,
        },
      ],
      educator.cookie,
    );
    check(
      "berkas milik akun lain ditolak",
      stolen.includes("tidak sah"),
      "path diperiksa ulang di server",
    );
  }

  // ── Membuat kursus ────────────────────────────────────────────────
  let slug = "";
  {
    const out = await callAction(NEW, createId, [{ ...input(), modul, tugas }], educator.cookie);
    check("kursus berhasil dibuat", out.includes("berhasil dibuat"), "pesan hasil");

    const snap = await db.collection("courses").where("ownerUid", "==", educator.uid).get();
    check("dokumen kursus tersimpan", snap.size === 1, `${snap.size} dokumen`);

    const data = snap.docs[0]?.data();
    slug = snap.docs[0]?.id ?? "";
    created.push(slug);

    check("slug dibuat dari judul", slug === "kursus-uji-otomatis", slug);
    check(
      "punya nomor urut",
      typeof data?.order === "number" && data.order > 0,
      `order = ${data?.order}`,
    );

    const lessons = (data?.sections?.[0]?.lessons ?? []) as Array<Record<string, unknown>>;
    check("berisi tiga bagian", lessons.length === 3, `${lessons.length} bagian`);
    check(
      "modul, video, dan tugas lengkap",
      Boolean((lessons[0]?.attachments as unknown[])?.length) &&
        Boolean(lessons[1]?.videoUrl) &&
        Boolean((lessons[2]?.attachments as unknown[])?.length),
      "isi tiap bagian",
    );
    check("instruktur adalah pembuatnya", data?.instructorName === "Uji educator", String(data?.instructorName));
  }

  // ── Terlihat di katalog dan halaman belajar ───────────────────────
  {
    const katalog = await probeText("/courses");
    check(
      "muncul di katalog publik",
      katalog.html.includes("Kursus Uji Otomatis"),
      "orderBy('order') tidak menyembunyikannya",
    );

    const detail = await probeText(`/courses/${slug}`);
    check("halaman detail terbuka", detail.status === 200, String(detail.status));

    const belajar = await probeText(`/courses/${slug}/learn`, educator.cookie);
    check(
      "halaman belajar menampilkan tiga bagian",
      belajar.status === 200 &&
        belajar.html.includes("Modul Materi") &&
        belajar.html.includes("Video Pembelajaran") &&
        belajar.html.includes("Penugasan Akhir"),
      String(belajar.status),
    );
    // Halaman belajar membuka pelajaran PERTAMA (modul), jadi embed video
    // baru muncul saat pelajaran videonya yang dibuka.
    const video = await probeText(`/courses/${slug}/learn/video`, educator.cookie);
    check(
      "video ter-embed",
      video.status === 200 && video.html.includes("youtube.com/embed/"),
      "tautan diubah ke bentuk embed",
    );

    const daftar = await probeText(LIST, educator.cookie);
    check("muncul di Kursus Saya", daftar.html.includes("Kursus Uji Otomatis"), LIST);
  }

  // ── Slug kedua tidak menimpa yang pertama ─────────────────────────
  {
    await callAction(NEW, createId, [{ ...input(), modul, tugas }], educator.cookie);
    const snap = await db.collection("courses").where("ownerUid", "==", educator.uid).get();

    const slugs = snap.docs.map((d) => d.id).sort();
    slugs.forEach((s) => created.includes(s) || created.push(s));

    check(
      "judul sama menghasilkan slug berbeda",
      snap.size === 2 && slugs.includes("kursus-uji-otomatis-2"),
      slugs.join(", "),
    );
  }

  // ── Menghapus ─────────────────────────────────────────────────────
  {
    const byUser = await callAction(LIST, deleteId, [slug], biasa.cookie);
    check("pengguna biasa tidak bisa menghapus", byUser.includes("Hanya educator"), "role");

    const foreign = await callAction(LIST, deleteId, ["dasar-neuroscience"], educator.cookie);
    check(
      "educator tidak bisa menghapus kursus orang lain",
      foreign.includes("bukan kursus Anda"),
      "kursus bawaan tetap aman",
    );
    check(
      "kursus bawaan masih ada",
      (await db.collection("courses").doc("dasar-neuroscience").get()).exists,
      "tidak terhapus",
    );

    const out = await callAction(LIST, deleteId, [slug], educator.cookie);
    check("educator menghapus kursusnya sendiri", out.includes("dihapus"), "pesan hasil");
    check(
      "dokumen benar-benar hilang",
      !(await db.collection("courses").doc(slug).get()).exists,
      slug,
    );
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const educator = await createTestUser("educator");
  const biasa = await createTestUser("user", "biasa");

  console.log(`educator : ${educator.email}`);
  console.log(`biasa    : ${biasa.email}\n`);

  try {
    await run(educator, biasa);
  } finally {
    await auth.deleteUsers([educator.uid, biasa.uid]);
    await Promise.all(
      created.map((slug) => db.collection("courses").doc(slug).delete().catch(() => undefined)),
    );
    await getStorage(app)
      .bucket(bucket)
      .deleteFiles({ prefix: `course-assets/${educator.uid}/` })
      .catch(() => undefined);

    console.log("\nakun, kursus, & berkas uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
