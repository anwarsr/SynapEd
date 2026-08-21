/**
 * Menguji panel admin untuk pengajuan perubahan kursus: lencana di navigasi
 * dan penghapusan catatan.
 *
 * Dua hal yang dulu hanya dimiliki daftar pengajuan educator, dan sekarang
 * disamakan. Yang diuji di sini bukan tampilannya, melainkan dua hal yang bisa
 * diam-diam salah:
 *
 *   - lencananya menghitung koleksi yang BENAR. Dulu satu angka dipakai
 *     bersama dan diikat mati ke satu tautan, jadi mudah sekali menampilkan
 *     jumlah pengajuan educator di tautan pengajuan kursus tanpa ada yang
 *     menyadarinya — angkanya tetap muncul, hanya salah arti.
 *   - penghapusan menolak catatan yang MASIH MENUNGGU. Kalau longgar, satu
 *     klik bisa melenyapkan permintaan educator sebelum sempat dijawab.
 *
 * Butuh dev server berjalan (npm run dev).
 *
 *   npx tsx scripts/verify-course-requests.ts [baseUrl]
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
  type TestUser,
} from "./testSupport";
import { targetLabel } from "./project";

const db = getFirestore(app);
const EDIT_ROUTE = "educator/courses/[slug]/edit";
const LIST_ROUTE = "admin/course-requests";
const DETAIL_ROUTE = "admin/course-requests/[id]";

function courseDoc(slug: string, ownerUid: string) {
  const now = new Date().toISOString();
  return {
    slug,
    title: `Kursus Uji Pengajuan ${slug.slice(-6)}`,
    shortDesc: "Dibuat oleh verify-course-requests, akan dihapus.",
    longDesc: "x",
    level: "Pemula",
    levelColor: "green",
    category: "neuroscience",
    icon: "reading",
    tint: "bg-blue-50",
    duration: "1 Jam",
    rating: 0,
    reviews: 0,
    price: 0,
    thumbnail: null,
    enrolledStudents: 0,
    lastUpdated: now,
    instructorName: "Uji Pemilik",
    instructorBio: "",
    whatYouLearn: [],
    requirements: [],
    visibility: "private",
    sections: [
      {
        title: "Bagian Awal",
        position: 0,
        lessons: [
          { slug: "satu", title: "Satu", type: "reading", duration: "5 Menit", position: 0 },
        ],
      },
    ],
    order: 9999,
    ownerUid,
    ownerName: "Uji Pemilik",
    createdAt: now,
  };
}

/**
 * Angka lencana pada satu tautan navigasi.
 *
 * Dipotong dari <a> yang href-nya persis sama, bukan dicari di seluruh halaman:
 * kalau dicari global, lencana tautan sebelah akan ikut terhitung dan
 * pemeriksaannya jadi tidak membuktikan apa pun. `null` berarti tanpa lencana.
 */
function badgeOf(html: string, href: string): number | null {
  const mulai = html.indexOf(`href="${href}"`);
  if (mulai === -1) return null;

  const tutup = html.indexOf("</a>", mulai);
  const anchor = html.slice(mulai, tutup === -1 ? undefined : tutup);

  const m = anchor.match(/aria-label="(\d+) pengajuan menunggu"/);
  return m ? Number(m[1]) : null;
}

/** Membuat satu pengajuan "tayangkan" dari educator, mengembalikan id-nya. */
async function ajukan(slug: string, owner: TestUser, alasan: string): Promise<string> {
  const path = `/educator/courses/${slug}/edit`;
  const id = await actionId(EDIT_ROUTE, "requestVisibilityChange");
  await callAction(path, id, [slug, "public", alasan], owner.cookie);

  const snap = await db
    .collection("courseChangeRequests")
    .where("courseSlug", "==", slug)
    .where("status", "==", "pending")
    .get();

  const doc = snap.docs[0];
  if (!doc) throw new Error(`Pengajuan untuk ${slug} gagal dibuat`);
  return doc.id;
}

async function run(owner: TestUser, admin: TestUser, orang: TestUser) {
  const slugA = `verify-req-a-${randomUUID().slice(0, 8)}`;
  const slugB = `verify-req-b-${randomUUID().slice(0, 8)}`;

  await db.collection("courses").doc(slugA).set(courseDoc(slugA, owner.uid));
  await db.collection("courses").doc(slugB).set(courseDoc(slugB, owner.uid));

  try {
    // Kompilasi rute dulu supaya manifest action-nya ada.
    await probe(`/educator/courses/${slugA}/edit`, owner.cookie);
    await probe("/admin/course-requests", admin.cookie);

    const reqA = await ajukan(slugA, owner, "Kursus sudah siap ditayangkan untuk umum.");

    // ── Navigasi: label & lencana ──────────────────────────────────
    {
      const page = await probeText("/admin/course-requests", admin.cookie);

      check(
        'label navigasi kini "Pengajuan Edukator"',
        page.html.includes("Pengajuan Edukator"),
        "teks navigasi",
      );
      check(
        'kata "Notifikasi" sudah tidak dipakai sebagai label',
        !page.html.includes(">Notifikasi<"),
        page.html.includes(">Notifikasi<") ? "masih ada" : "sudah diganti",
      );

      const kursus = badgeOf(page.html, "/admin/course-requests");
      check(
        "Pengajuan Kursus memakai lencana saat ada yang menunggu",
        kursus === 1,
        `lencana: ${kursus === null ? "tidak ada" : kursus}`,
      );

      // Inilah pemeriksaan yang membedakan "ada lencana" dari "lencananya
      // benar": tidak ada satu pun pengajuan educator yang menunggu, jadi
      // tautan sebelah HARUS polos. Kalau kedua tautan memakai angka yang
      // sama, di sinilah ketahuannya.
      const educator = badgeOf(page.html, "/admin/notifications");
      check(
        "Pengajuan Edukator tetap polos — lencananya menghitung koleksinya sendiri",
        educator === null,
        `lencana: ${educator === null ? "tidak ada" : educator}`,
      );
    }

    const deleteId = await actionId(LIST_ROUTE, "deleteCourseRequest");
    const clearId = await actionId(LIST_ROUTE, "clearDecidedCourseRequests");

    // ── Yang masih menunggu tidak boleh dihapus ────────────────────
    {
      const out = await callAction("/admin/course-requests", deleteId, [reqA], admin.cookie);
      check(
        "pengajuan yang masih menunggu ditolak dari penghapusan",
        out.includes("belum diputuskan"),
        "harus diputuskan dulu",
      );

      const masihAda = (await db.collection("courseChangeRequests").doc(reqA).get()).exists;
      check("catatannya memang masih ada", masihAda, "Firestore");
    }

    // ── Bukan admin tidak boleh menghapus ──────────────────────────
    {
      // Diputuskan dulu supaya yang diuji benar-benar penjaga perannya,
      // bukan aturan "belum diputuskan" yang kebetulan menolak lebih dulu.
      await probe(`/admin/course-requests/${reqA}`, admin.cookie);
      const decideId = await actionId(DETAIL_ROUTE, "decideCourseRequest");
      const putusan = await callAction(
        `/admin/course-requests/${reqA}`,
        decideId,
        [reqA, "reject", "Ditolak oleh verify-course-requests."],
        admin.cookie,
      );
      check("admin menolak pengajuan", putusan.includes("ditolak"), "pesan hasil");

      for (const [siapa, user] of [["educator pemilik", owner], ["pengguna biasa", orang]] as const) {
        const out = await callAction("/admin/course-requests", deleteId, [reqA], user.cookie);
        check(`${siapa} tidak bisa menghapus catatan`, out.includes("Hanya admin"), "penjaga peran");
      }

      const masihAda = (await db.collection("courseChangeRequests").doc(reqA).get()).exists;
      check("catatannya belum terhapus oleh siapa pun", masihAda, "Firestore");
    }

    // ── Admin menghapus yang sudah diputuskan ──────────────────────
    {
      const out = await callAction("/admin/course-requests", deleteId, [reqA], admin.cookie);
      check("admin menghapus catatan yang sudah diputuskan", out.includes("dihapus"), "pesan hasil");

      const hilang = !(await db.collection("courseChangeRequests").doc(reqA).get()).exists;
      check("catatannya benar-benar hilang dari Firestore", hilang, "bukan sekadar disembunyikan");
    }

    // ── Bersihkan hanya menyentuh yang sudah diputuskan ────────────
    {
      // Satu ditolak, satu dibiarkan menunggu.
      const reqTolak = await ajukan(slugA, owner, "Pengajuan kedua untuk diuji pembersihannya.");
      await probe(`/admin/course-requests/${reqTolak}`, admin.cookie);
      const decideId = await actionId(DETAIL_ROUTE, "decideCourseRequest");
      await callAction(
        `/admin/course-requests/${reqTolak}`,
        decideId,
        [reqTolak, "reject", "Ditolak untuk menguji pembersihan."],
        admin.cookie,
      );

      const reqTunggu = await ajukan(slugB, owner, "Pengajuan ini harus selamat dari pembersihan.");

      const out = await callAction("/admin/course-requests", clearId, [], admin.cookie);
      check("pembersihan berjalan", out.includes("dibersihkan"), "pesan hasil");

      const tolakHilang = !(await db.collection("courseChangeRequests").doc(reqTolak).get()).exists;
      const tungguSelamat = (await db.collection("courseChangeRequests").doc(reqTunggu).get()).exists;

      check("yang sudah ditolak ikut terhapus", tolakHilang, "Firestore");
      check(
        "yang masih menunggu TIDAK ikut terhapus",
        tungguSelamat,
        tungguSelamat ? "selamat" : "ikut terbuang — permintaan educator lenyap tanpa dijawab",
      );

      // Lencananya harus mengikuti keadaan sesudah pembersihan.
      const page = await probeText("/admin/course-requests", admin.cookie);
      const kursus = badgeOf(page.html, "/admin/course-requests");
      check(
        "lencana menyesuaikan setelah pembersihan",
        kursus === 1,
        `lencana: ${kursus === null ? "tidak ada" : kursus}`,
      );
    }
  } finally {
    for (const slug of [slugA, slugB]) {
      await db.collection("courses").doc(slug).delete().catch(() => undefined);
      const sisa = await db.collection("courseChangeRequests").where("courseSlug", "==", slug).get();
      for (const d of sisa.docs) await d.ref.delete().catch(() => undefined);
    }
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const owner = await createTestUser("educator", "req-pemilik");
  const admin = await createTestUser("admin", "req-admin");
  const orang = await createTestUser("user", "req-orang");

  console.log(`pemilik : ${owner.email}`);
  console.log(`admin   : ${admin.email}`);
  console.log(`orang   : ${orang.email}\n`);

  try {
    await run(owner, admin, orang);
  } finally {
    await auth.deleteUsers([owner.uid, admin.uid, orang.uid]);
    console.log("\nakun & kursus uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
