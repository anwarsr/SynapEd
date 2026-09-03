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

const VIDEO = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

type Doc = ReturnType<typeof doc>;

/**
 * Kurikulum sengaja TIDAK berbentuk template lama (satu modul, satu video,
 * satu tugas dalam satu bagian). Bentuknya: dua bagian, empat pelajaran, dua
 * modul berurutan, dan tugas di bagian terpisah — persis yang dulu mustahil
 * dibuat lewat form.
 */
function curriculum(modul: Doc, tugas: Doc) {
  return [
    {
      title: "Pendahuluan",
      lessons: [
        { title: "Modul Pertama", type: "reading", duration: "10 menit", attachments: [modul] },
        { title: "Modul Kedua", type: "reading", duration: "10 menit", attachments: [modul] },
        { title: "Video Pengantar", type: "video", duration: "8 menit", videoUrl: VIDEO },
      ],
    },
    {
      title: "Penutup",
      lessons: [
        { title: "Penugasan Akhir", type: "quiz", duration: "Tugas", attachments: [tugas] },
      ],
    },
  ];
}

function input(modul: Doc, tugas: Doc, overrides: Record<string, unknown> = {}) {
  return {
    title: "Kursus Uji Otomatis",
    shortDesc: "Kursus contoh yang dibuat oleh skrip verifikasi.",
    longDesc: "",
    level: "Pemula",
    category: "eeg",
    duration: "1 jam",
    price: 0,
    thumbnail: null as string | null,
    whatYouLearn: ["  Menyusun kurikulum  ", "", "Menilai tugas peserta"],
    requirements: ["Laptop dengan peramban modern", "   "],
    sections: curriculum(modul, tugas),
    ...overrides,
  };
}

/** PNG 1x1 sah — cukup untuk menguji rules contentType & ukuran. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const created: string[] = [];

async function run(educator: TestUser, biasa: TestUser, adminUser: TestUser) {
  // Manifest action baru ditulis setelah rutenya dikompilasi, dan di mode dev
  // Next mengompilasi rute saat pertama diminta.
  await probe("/educator/courses/new", educator.cookie);
  await probe("/educator/courses", educator.cookie);
  await probe("/educator/courses/pemanasan/edit", educator.cookie);

  const createId = await actionId("educator/courses/new", "createCourse");
  const deleteId = await actionId("educator/courses/[slug]/edit", "deleteCourse");

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

    // Diperiksa lewat atribut id, bukan teks labelnya.
    //
    // Kedua kolom ini dulu hanya ada di panel pengajuan perubahan, jadi
    // kursus baru selalu lahir dengan keduanya kosong. Memeriksa action-nya
    // saja tidak cukup: kalau kolomnya hilang dari form, educator tetap tidak
    // punya cara mengisinya meski server sudah menerima.
    check(
      "form punya kolom yang akan dipelajari",
      form.html.includes('id="whatYouLearn"'),
      "textarea ada di halaman buat kursus",
    );
    check(
      "form punya kolom persyaratan",
      form.html.includes('id="requirements"'),
      "textarea ada di halaman buat kursus",
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
    check("berkas selain PDF DITOLAK", exe === 403, `HTTP ${exe}`);

    // Word sempat diizinkan; sekarang tidak lagi, dan penolakannya harus
    // datang dari storage.rules — bukan cuma dari validasi di form.
    const word = await upload(
      `course-assets/${educator.uid}/uji/modul.docx`,
      educatorToken,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      PDF,
    );
    check("berkas Word DITOLAK", word === 403, `HTTP ${word}`);
  }

  const modul = doc(modulPath, "modul-materi.pdf");
  const tugas = doc(tugasPath, "tugas-akhir.pdf");

  // ── Gambar latar kursus ───────────────────────────────────────────
  // Folder terpisah dari materi, dan sengaja TERBUKA untuk dibaca — gambar
  // ini tampil di katalog publik.
  const thumbPath = `course-thumbnails/${educator.uid}/uji.png`;

  {
    check(
      "educator boleh mengunggah gambar latar",
      (await upload(thumbPath, educatorToken, "image/png", PNG)) === 200,
      "PNG",
    );

    const asUser = await upload(
      `course-thumbnails/${biasa.uid}/uji.png`,
      biasaToken,
      "image/png",
      PNG,
    );
    check("pengguna biasa DITOLAK mengunggah gambar", asUser === 403, `HTTP ${asUser}`);

    const foreign = await upload(
      `course-thumbnails/${biasa.uid}/curi.png`,
      educatorToken,
      "image/png",
      PNG,
    );
    check("unggah gambar ke folder orang lain DITOLAK", foreign === 403, `HTTP ${foreign}`);

    const notImage = await upload(
      `course-thumbnails/${educator.uid}/bukan.pdf`,
      educatorToken,
      "application/pdf",
      PDF,
    );
    check("berkas bukan gambar DITOLAK", notImage === 403, `HTTP ${notImage}`);

    // Berbeda dari materi: gambar latar memang harus bisa dibaca tanpa masuk.
    const publik = await fetch(
      `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(thumbPath)}?alt=media`,
    );
    check("gambar latar bisa dibaca publik", publik.status === 200, `HTTP ${publik.status}`);
  }

  // ── Penjagaan server action ───────────────────────────────────────
  {
    const byUser = await callAction(NEW, createId, [input(modul, tugas)], biasa.cookie);
    check("pengguna biasa tidak bisa membuat kursus", byUser.includes("Hanya educator"), "role");

    const anon = await callAction(NEW, createId, [input(modul, tugas)]);
    check("anonim tidak bisa membuat kursus", anon.includes("Hanya educator"), "tanpa cookie");

    const badVideo = await callAction(
      NEW,
      createId,
      [
        input(modul, tugas, {
          sections: [
            {
              title: "Bagian",
              lessons: [
                { title: "Video Rusak", type: "video", duration: "-", videoUrl: "https://contoh.com/v" },
              ],
            },
          ],
        }),
      ],
      educator.cookie,
    );
    check("tautan bukan YouTube ditolak", badVideo.includes("tidak dikenali"), "validasi video");

    const shortTitle = await callAction(
      NEW,
      createId,
      [input(modul, tugas, { title: "ab" })],
      educator.cookie,
    );
    check("judul terlalu pendek ditolak", shortTitle.includes("minimal 4 karakter"), "validasi judul");

    const empty = await callAction(NEW, createId, [input(modul, tugas, { sections: [] })], educator.cookie);
    check("kurikulum kosong ditolak", empty.includes("minimal punya satu bagian"), "validasi kurikulum");

    const badCategory = await callAction(
      NEW,
      createId,
      [input(modul, tugas, { category: "kategori-yang-tidak-ada" })],
      educator.cookie,
    );
    check("kategori tak terdaftar ditolak", badCategory.includes("Kategori tidak valid"), "validasi kategori");

    const stolenImage = await callAction(
      NEW,
      createId,
      [input(modul, tugas, { thumbnail: `course-thumbnails/${biasa.uid}/curi.png` })],
      educator.cookie,
    );
    check(
      "gambar milik akun lain ditolak",
      stolenImage.includes("Gambar latar tidak sah"),
      "path diperiksa ulang di server",
    );

    // Yang paling penting: path berkas datang dari klien, jadi tidak boleh
    // dipercaya begitu saja.
    const stolen = await callAction(
      NEW,
      createId,
      [input(doc(`course-assets/${biasa.uid}/uji/modul.pdf`, "modul.pdf"), tugas)],
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
    const out = await callAction(
      NEW,
      createId,
      [input(modul, tugas, { thumbnail: thumbPath })],
      educator.cookie,
    );
    check("kursus berhasil dibuat", out.includes("berhasil dibuat"), "pesan hasil");

    const snap = await db.collection("courses").where("ownerUid", "==", educator.uid).get();
    check("dokumen kursus tersimpan", snap.size === 1, `${snap.size} dokumen`);

    const data = snap.docs[0]?.data();
    slug = snap.docs[0]?.id ?? "";
    created.push(slug);

    check("slug dibuat dari judul", slug === "kursus-uji-otomatis", slug);

    // Dulu kedua daftar ini dipaksa kosong saat kursus dibuat, apa pun yang
    // dikirim educator — kolomnya cuma ada di panel pengajuan perubahan.
    const pelajari = (data?.whatYouLearn ?? []) as string[];
    const syarat = (data?.requirements ?? []) as string[];

    check(
      "poin yang akan dipelajari ikut tersimpan saat kursus dibuat",
      pelajari.length === 2,
      `${pelajari.length} poin: ${JSON.stringify(pelajari)}`,
    );
    check(
      "spasi dipangkas dan baris kosong dibuang",
      pelajari[0] === "Menyusun kurikulum" && pelajari[1] === "Menilai tugas peserta",
      JSON.stringify(pelajari),
    );
    check(
      "persyaratan ikut tersimpan saat kursus dibuat",
      syarat.length === 1 && syarat[0] === "Laptop dengan peramban modern",
      JSON.stringify(syarat),
    );
    check(
      "punya nomor urut",
      typeof data?.order === "number" && data.order > 0,
      `order = ${data?.order}`,
    );

    // Inti perubahan ini: jumlah dan urutan mengikuti apa yang dikirim, bukan
    // template tetap.
    const secs = (data?.sections ?? []) as Array<Record<string, unknown>>;
    check("dua bagian tersimpan", secs.length === 2, `${secs.length} bagian`);
    check(
      "judul bagian sesuai kiriman",
      secs[0]?.title === "Pendahuluan" && secs[1]?.title === "Penutup",
      `${secs[0]?.title} / ${secs[1]?.title}`,
    );

    const lessons = (secs[0]?.lessons ?? []) as Array<Record<string, unknown>>;
    const closing = (secs[1]?.lessons ?? []) as Array<Record<string, unknown>>;

    check("bagian pertama berisi tiga pelajaran", lessons.length === 3, `${lessons.length}`);
    check("bagian kedua berisi satu pelajaran", closing.length === 1, `${closing.length}`);

    check(
      "dua modul berurutan diterima",
      lessons[0]?.type === "reading" && lessons[1]?.type === "reading",
      "bukan lagi satu modul saja",
    );
    check(
      "urutan dipertahankan apa adanya",
      lessons.map((l) => l.title).join(" > ") === "Modul Pertama > Modul Kedua > Video Pengantar",
      lessons.map((l) => l.title).join(" > "),
    );
    check(
      "posisi ditulis ulang 0-based",
      lessons.every((l, i) => l.position === i) && closing[0]?.position === 0,
      "position mengikuti indeks",
    );
    check(
      "isi tiap pelajaran terbawa",
      Boolean((lessons[0]?.attachments as unknown[])?.length) &&
        Boolean(lessons[2]?.videoUrl) &&
        Boolean((closing[0]?.attachments as unknown[])?.length),
      "lampiran & tautan",
    );
    check("instruktur adalah pembuatnya", data?.instructorName === "Uji educator", String(data?.instructorName));
    check("gambar latar tersimpan", data?.thumbnail === thumbPath, String(data?.thumbnail));
  }

  // ── Terlihat di katalog dan halaman belajar ───────────────────────
  {
    // Kursus baru kini dibuat TERSEMBUNYI dan baru tayang setelah pengajuan
    // "publish" disetujui admin. Jadi tepat setelah dibuat, ia justru TIDAK
    // boleh terlihat di katalog publik.
    const sebelumTayang = await probeText("/courses");
    check(
      "kursus baru TIDAK langsung tayang",
      !sebelumTayang.html.includes("Kursus Uji Otomatis"),
      "dibuat private, menunggu persetujuan",
    );

    // Ditayangkan langsung lewat jalur admin supaya sisa pemeriksaan katalog
    // di bawah ini menguji tampilan, bukan alur persetujuannya (yang diuji
    // terpisah di suite pengajuan kursus).
    await db.collection("courses").doc(slug).update({ visibility: "public" });

    const katalog = await probeText("/courses");
    check(
      "setelah ditayangkan, muncul di katalog publik",
      katalog.html.includes("Kursus Uji Otomatis"),
      "visibility public",
    );

    const detail = await probeText(`/courses/${slug}`);
    check("halaman detail terbuka", detail.status === 200, String(detail.status));

    check(
      "poin yang dipelajari tampil di halaman detail",
      detail.html.includes("Yang Akan Anda Pelajari") &&
        detail.html.includes("Menilai tugas peserta"),
      "judul bagian beserta isinya",
    );
    check(
      "persyaratan tampil di halaman detail",
      detail.html.includes("Laptop dengan peramban modern"),
      "isi persyaratan",
    );

    // Kursus lama bisa saja kedua daftarnya kosong. Dulu judul bagiannya
    // tetap dirender, jadi pengunjung melihat kotak kosong tanpa satu pun
    // isi — terbaca seperti halaman rusak, bukan bagian yang belum diisi.
    await db.collection("courses").doc(slug).update({ whatYouLearn: [], requirements: [] });

    const kosong = await probeText(`/courses/${slug}`);
    check(
      "bagian yang dipelajari DISEMBUNYIKAN saat daftarnya kosong",
      !kosong.html.includes("Yang Akan Anda Pelajari"),
      "judul tanpa isi tidak dirender",
    );
    check(
      "bagian persyaratan DISEMBUNYIKAN saat daftarnya kosong",
      !kosong.html.includes("Persyaratan"),
      "judul tanpa isi tidak dirender",
    );

    // Dikembalikan supaya pemeriksaan setelah ini melihat kursus yang utuh.
    await db.collection("courses").doc(slug).update({
      whatYouLearn: ["Menyusun kurikulum", "Menilai tugas peserta"],
      requirements: ["Laptop dengan peramban modern"],
    });

    const belajar = await probeText(`/courses/${slug}/learn`, educator.cookie);
    check(
      "halaman belajar menampilkan seluruh kurikulum",
      belajar.status === 200 &&
        ["Pendahuluan", "Penutup", "Modul Pertama", "Modul Kedua", "Video Pengantar", "Penugasan Akhir"].every(
          (t) => belajar.html.includes(t),
        ),
      String(belajar.status),
    );
    // Slug pelajaran video diturunkan dari judulnya lewat normalizeSections
    // (sama seperti editor kurikulum) — dibaca ulang dari Firestore, tidak
    // diasumsikan.
    const courseDoc = await db.collection("courses").doc(slug).get();
    const videoLessonSlug = String(courseDoc.data()?.sections?.[0]?.lessons?.[2]?.slug ?? "video");

    // Halaman belajar membuka pelajaran PERTAMA (modul), jadi embed video
    // baru muncul saat pelajaran videonya yang dibuka.
    const video = await probeText(`/courses/${slug}/learn/${videoLessonSlug}`, educator.cookie);
    check(
      "video ter-embed",
      video.status === 200 && video.html.includes("youtube.com/embed/"),
      "tautan diubah ke bentuk embed",
    );
    check(
      "ada jalan keluar kalau embed gagal",
      video.html.includes("Tonton di YouTube") && video.html.includes(VIDEO),
      "tautan ke YouTube tetap tersedia",
    );

    check(
      "kartu katalog memakai gambar unggahan",
      katalog.html.includes(encodeURIComponent(thumbPath)),
      "bukan lagi latar ikon",
    );

    const daftar = await probeText(LIST, educator.cookie);
    check("muncul di Kursus Saya", daftar.html.includes("Kursus Uji Otomatis"), LIST);
  }

  // ── Slug kedua tidak menimpa yang pertama ─────────────────────────
  {
    await callAction(NEW, createId, [input(modul, tugas)], educator.cookie);
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
    const editPath = `/educator/courses/${slug}/edit`;

    // Aturan berubah sejak alur persetujuan berlaku: penghapusan langsung
    // kini KHUSUS ADMIN. Educator mengajukan lewat requestCourseDeletion dan
    // admin yang menerapkannya — diuji terpisah di suite pengajuan kursus.
    const byUser = await callAction(editPath, deleteId, [slug], biasa.cookie);
    check("pengguna biasa tidak bisa menghapus", byUser.includes("persetujuan admin"), "role");

    const byEducator = await callAction(editPath, deleteId, [slug], educator.cookie);
    check(
      "educator tidak bisa menghapus langsung",
      byEducator.includes("persetujuan admin"),
      "harus lewat pengajuan",
    );
    check(
      "  kursusnya masih ada",
      (await db.collection("courses").doc(slug).get()).exists,
      slug,
    );

    const out = await callAction(editPath, deleteId, [slug], adminUser.cookie);
    check("admin menghapus langsung", out.includes("dihapus"), "pesan hasil");
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
  const adminUser = await createTestUser("admin", "course-adm");

  console.log(`educator : ${educator.email}`);
  console.log(`biasa    : ${biasa.email}\n`);

  try {
    await run(educator, biasa, adminUser);
  } finally {
    await auth.deleteUsers([educator.uid, biasa.uid, adminUser.uid]);
    await Promise.all(
      created.map((slug) => db.collection("courses").doc(slug).delete().catch(() => undefined)),
    );
    await getStorage(app)
      .bucket(bucket)
      .deleteFiles({ prefix: `course-assets/${educator.uid}/` })
      .catch(() => undefined);
    await getStorage(app)
      .bucket(bucket)
      .deleteFiles({ prefix: `course-thumbnails/${educator.uid}/` })
      .catch(() => undefined);

    console.log("\nakun, kursus, & berkas uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
