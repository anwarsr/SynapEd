/**
 * Membuktikan bahwa berkas Storage yang tidak lagi dipakai benar-benar terhapus
 * sendiri — bukan sekadar ada kodenya.
 *
 * Setiap kebocoran diuji dengan cara yang sama: taruh berkas sungguhan di
 * bucket, jalankan aksi yang seharusnya membuangnya lewat HTTP persis seperti
 * browser, lalu tanya bucket apakah berkasnya masih ada. Yang dipertahankan
 * ikut diperiksa — pembersih yang menghapus terlalu banyak jauh lebih buruk
 * daripada yang menghapus terlalu sedikit.
 *
 * Butuh dev server berjalan (npm run dev): ID Server Action dibaca dari
 * manifest .next/dev.
 *
 *   npx tsx scripts/verify-storage-cleanup.ts [baseUrl]
 */
import { randomUUID } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import {
  actionId,
  app,
  auth,
  callAction,
  check,
  createTestUser,
  finish,
  type TestUser,
} from "./testSupport";
import { resolveStorageBucket, targetLabel } from "./project";

const db = getFirestore(app);
const bucket = getStorage(app).bucket();

const NEW_ROUTE = "educator/courses/new";
const EDIT_ROUTE = "educator/courses/[slug]/edit";
const LIST_ROUTE = "educator/courses";
// deleteCourse pindah ke halaman sunting dan kini KHUSUS ADMIN sejak alur
// persetujuan berlaku — educator mengajukan, admin menerapkan.
const DELETE_ROUTE = "educator/courses/[slug]/edit";
// Aksi berkas foto profil pindah dari /dashboard ke /pengaturan saat halaman
// profil dipisah; /dashboard sekarang hanya mengalihkan ke /profil dan tidak
// punya server action apa pun lagi.
const AKUN_ROUTE = "pengaturan";

async function put(path: string, body = "berkas uji"): Promise<string> {
  await bucket.file(path).save(Buffer.from(body), { contentType: "application/pdf" });
  return path;
}

async function exists(path: string): Promise<boolean> {
  const [ok] = await bucket.file(path).exists();
  return ok;
}

/** Berkas yang WAJIB hilang, dan berkas yang WAJIB bertahan. */
async function expectFiles(
  label: string,
  gone: string[],
  kept: string[],
): Promise<void> {
  for (const path of gone) {
    check(`${label} — terhapus`, !(await exists(path)), short(path));
  }
  for (const path of kept) {
    check(`${label} — dipertahankan`, await exists(path), short(path));
  }
}

function short(path: string): string {
  return path.split("/").slice(-2).join("/");
}

function lesson(attachmentPath: string | null) {
  return {
    title: "Modul Uji",
    type: "reading" as const,
    duration: "5 menit",
    attachments: attachmentPath
      ? [{ name: "modul.pdf", path: attachmentPath, size: 11, mime: "application/pdf" }]
      : undefined,
  };
}

async function main() {
  console.log(`\nTarget  : ${targetLabel()}`);
  console.log(`Bucket  : ${resolveStorageBucket()}\n`);

  const educator = await createTestUser("educator", "storage");
  const other = await createTestUser("educator", "storage-lain");
  const adminUser = await createTestUser("admin", "storage-adm");
  const draft = randomUUID().slice(0, 8);

  const created: string[] = [];
  let slug: string | null = null;

  try {
    // ── 1. discardUpload: membatalkan unggahan sebelum apa pun tersimpan ──
    const dibuang = await put(`course-thumbnails/${educator.uid}/${draft}-1-buang.jpg`);
    const milikOrangLain = await put(`course-thumbnails/${other.uid}/${draft}-1-aman.jpg`);
    created.push(dibuang, milikOrangLain);

    const discardId = await actionId(NEW_ROUTE, "discardUpload");
    await callAction(`/${NEW_ROUTE}`, discardId, [dibuang], educator.cookie);
    await callAction(`/${NEW_ROUTE}`, discardId, [milikOrangLain], educator.cookie);

    await expectFiles("Unggahan dibatalkan", [dibuang], [milikOrangLain]);
    check(
      "Berkas akun lain tidak bisa dihapus",
      await exists(milikOrangLain),
      "path milik educator lain ditolak",
    );

    // ── 2. createCourse menyapu sisa folder draft ────────────────────────
    const modul1 = await put(`course-assets/${educator.uid}/${draft}/lesson-a-modul.pdf`);
    const ditinggal = await put(`course-assets/${educator.uid}/${draft}/lesson-b-batal.pdf`);
    const gambar1 = await put(`course-thumbnails/${educator.uid}/${draft}-2-satu.jpg`);

    // Sengaja TANPA folder draft di tengah — langsung di bawah folder uid.
    //
    // Bentuk ini tidak dihasilkan form mana pun, tapi lolos validasi dan bisa
    // muncul di data lama. Gunanya di sini: penyapuan folder mustahil
    // menjangkaunya, jadi kalau berkas ini hilang, yang menghapusnya PASTI
    // pembandingan kurikulum lama dengan yang baru. Tanpa satu kasus seperti
    // ini, kedua mekanisme saling menutupi dan tesnya lulus walau salah
    // satunya dimatikan.
    const modulDatar = await put(`course-assets/${educator.uid}/lama-tanpa-folder.pdf`);

    created.push(modul1, ditinggal, gambar1, modulDatar);

    const createId = await actionId(NEW_ROUTE, "createCourse");
    await callAction(
      `/${NEW_ROUTE}`,
      createId,
      [
        {
          title: `Uji Bersih Storage ${draft}`,
          shortDesc: "Dibuat verify-storage-cleanup, akan dihapus.",
          longDesc: "x",
          level: "Pemula",
          category: "neuroscience",
          duration: "1 jam",
          price: 0,
          thumbnail: gambar1,
          sections: [{ title: "Bagian Uji", lessons: [lesson(modul1), lesson(modulDatar)] }],
        },
      ],
      educator.cookie,
    );

    const snap = await db.collection("courses").where("ownerUid", "==", educator.uid).get();
    slug = snap.docs[0]?.id ?? null;
    check("Kursus uji terbuat", slug !== null, slug ?? "tidak ada");
    if (!slug) return;

    await expectFiles("Sisa folder draft", [ditinggal], [modul1, modulDatar, gambar1]);

    // ── 3. saveCurriculum membuang materi yang tergantikan ───────────────
    const modul2 = await put(`course-assets/${educator.uid}/${slug}/lesson-a-modul-baru.pdf`);
    created.push(modul2);

    const saveId = await actionId(EDIT_ROUTE, "saveCurriculum");
    await callAction(
      `/educator/courses/${slug}/edit`,
      saveId,
      [slug, [{ title: "Bagian Uji", lessons: [lesson(modul2)] }]],
      adminUser.cookie,
    );

    // modul1 dijangkau penyapuan folder; modulDatar hanya bisa dijangkau
    // pembandingan lama-vs-baru. Keduanya harus hilang.
    await expectFiles("Materi diganti (dalam folder)", [modul1], [modul2, gambar1]);
    await expectFiles("Materi diganti (tanpa folder)", [modulDatar], []);

    // ── 4. updateCourseMeta membuang gambar latar yang tergantikan ───────
    const gambar2 = await put(`course-thumbnails/${educator.uid}/${slug}-3-dua.jpg`);
    created.push(gambar2);

    const metaId = await actionId(EDIT_ROUTE, "updateCourseMeta");
    await callAction(
      `/educator/courses/${slug}/edit`,
      metaId,
      [
        slug,
        {
          title: `Uji Bersih Storage ${draft}`,
          shortDesc: "Dibuat verify-storage-cleanup, akan dihapus.",
          longDesc: "x",
          level: "Pemula",
          category: "neuroscience",
          duration: "1 jam",
          price: 0,
          thumbnail: gambar2,
          whatYouLearn: [],
          requirements: [],
        },
      ],
      adminUser.cookie,
    );

    await expectFiles("Gambar latar diganti", [gambar1], [gambar2, modul2]);

    // ── 5. deleteCourse membuang seluruh berkas kursus ───────────────────
    const deleteId = await actionId(DELETE_ROUTE, "deleteCourse");
    await callAction(`/educator/courses/${slug}/edit`, deleteId, [slug], adminUser.cookie);

    const gone = await db.collection("courses").doc(slug).get();
    check("Dokumen kursus terhapus", !gone.exists, slug);
    await expectFiles("Kursus dihapus", [modul2, gambar2], []);
    slug = null;

    // ── 6. Foto profil lama tersapu saat menggantinya ────────────────────
    const fotoLama = await put(`avatars/${educator.uid}/avatar.jpeg`, "lama");
    const fotoBaru = await put(`avatars/${educator.uid}/avatar.png`, "baru");
    created.push(fotoLama, fotoBaru);

    const avatarId = await actionId(AKUN_ROUTE, "syncAvatarFiles");
    await callAction(`/${AKUN_ROUTE}`, avatarId, [fotoBaru], educator.cookie);

    await expectFiles("Foto profil diganti", [fotoLama], [fotoBaru]);

    // ── 7. Menghapus akun mengosongkan folder fotonya ────────────────────
    const purgeId = await actionId(AKUN_ROUTE, "purgeAvatarFiles");
    await callAction(`/${AKUN_ROUTE}`, purgeId, [], educator.cookie);

    await expectFiles("Akun dihapus", [fotoBaru], []);
  } finally {
    if (slug) await db.recursiveDelete(db.collection("courses").doc(slug));

    // Sisa apa pun dibuang, termasuk berkas yang seharusnya bertahan: bucket
    // sungguhan tidak boleh ketinggalan sampah dari skrip uji.
    await Promise.allSettled(created.map((p) => bucket.file(p).delete({ ignoreNotFound: true })));
    await Promise.allSettled([
      bucket.deleteFiles({ prefix: `course-assets/${educator.uid}/` }),
      bucket.deleteFiles({ prefix: `course-thumbnails/${educator.uid}/` }),
      bucket.deleteFiles({ prefix: `course-thumbnails/${other.uid}/` }),
      bucket.deleteFiles({ prefix: `avatars/${educator.uid}/` }),
    ]);

    await Promise.allSettled(
      [educator, other, adminUser].map((u: TestUser) => auth.deleteUser(u.uid)),
    );
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
