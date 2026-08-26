/**
 * Menguji kategori yang dikelola admin, dari ujung ke ujung.
 *
 * Server Action dipanggil lewat POST + header Next-Action, persis seperti yang
 * dilakukan browser. Yang dibuktikan: hanya admin yang boleh mengelola,
 * kategori baru langsung bisa dipakai educator, dan kategori yang masih
 * dipakai kursus tidak bisa dihapus.
 *
 * Butuh dev server berjalan (npm run dev).
 *
 *   npx tsx scripts/verify-category.ts [baseUrl]
 */
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
const PAGE = "/admin/categories";

const created: string[] = [];

async function run(admin: TestUser, educator: TestUser, biasa: TestUser) {
  await probe(PAGE, admin.cookie);

  const createId = await actionId("admin/categories", "createCategory");
  const deleteId = await actionId("admin/categories", "deleteCategory");
  const renameId = await actionId("admin/categories", "renameCategory");

  // ── Penjagaan halaman & action ────────────────────────────────────
  {
    const anon = await probe(PAGE);
    check(
      "halaman kategori, anonim -> /login",
      anon.status >= 300 && anon.status < 400 && (anon.location ?? "").includes("/login"),
      `${anon.status} ${anon.location ?? ""}`,
    );

    const asEducator = await probe(PAGE, educator.cookie);
    check(
      "halaman kategori, educator -> /profil",
      asEducator.status >= 300 && asEducator.status < 400,
      `${asEducator.status} ${asEducator.location ?? ""}`,
    );

    const byUser = await callAction(PAGE, createId, ["Kategori Curian"], biasa.cookie);
    check("pengguna biasa tidak bisa menambah kategori", byUser.includes("Hanya admin"), "role");

    const byEducator = await callAction(PAGE, createId, ["Kategori Curian"], educator.cookie);
    check("educator tidak bisa menambah kategori", byEducator.includes("Hanya admin"), "role");

    const anonAction = await callAction(PAGE, createId, ["Kategori Curian"]);
    check("anonim tidak bisa menambah kategori", anonAction.includes("Hanya admin"), "tanpa cookie");

    check(
      "tidak ada kategori curian yang lolos",
      !(await db.collection("categories").doc("kategori-curian").get()).exists,
      "Firestore",
    );
  }

  // ── Menambah ──────────────────────────────────────────────────────
  const label = "Kecerdasan Buatan Uji";
  const slug = "kecerdasan-buatan-uji";

  {
    const short = await callAction(PAGE, createId, ["ab"], admin.cookie);
    check("nama terlalu pendek ditolak", short.includes("minimal 3 karakter"), "validasi");

    const out = await callAction(PAGE, createId, [label], admin.cookie);
    check("admin menambah kategori", out.includes("ditambahkan"), "pesan hasil");
    created.push(slug);

    const doc = await db.collection("categories").doc(slug).get();
    check("slug diturunkan dari nama", doc.exists, slug);
    check("label tersimpan apa adanya", doc.data()?.label === label, String(doc.data()?.label));

    const again = await callAction(PAGE, createId, [label], admin.cookie);
    check("kategori kembar ditolak", again.includes("sudah ada"), "tanpa menimpa yang lama");
  }

  // ── Langsung bisa dipakai educator ────────────────────────────────
  {
    const form = await probeText("/educator/courses/new", educator.cookie);
    check(
      "kategori baru muncul di form educator",
      form.status === 200 && form.html.includes(label),
      "pilihan diambil dari Firestore, bukan konstanta",
    );

    const katalog = await probeText("/");
    check(
      "kategori baru muncul sebagai filter katalog",
      katalog.html.includes(label),
      "muncul walau belum ada kursusnya",
    );
  }

  // ── Ganti nama, slug tidak ikut berubah ───────────────────────────
  {
    const out = await callAction(PAGE, renameId, [slug, "Kecerdasan Buatan Baru"], admin.cookie);
    check("admin mengganti nama kategori", out.includes("diperbarui"), "pesan hasil");

    const doc = await db.collection("categories").doc(slug).get();
    check(
      "slug tetap, hanya labelnya berubah",
      doc.exists && doc.data()?.label === "Kecerdasan Buatan Baru",
      "kursus lama tetap tertaut",
    );
  }

  // ── Tidak bisa dihapus selagi dipakai ─────────────────────────────
  {
    await db.collection("courses").doc("kursus-uji-kategori").set({
      slug: "kursus-uji-kategori",
      title: "Kursus Uji Kategori",
      shortDesc: "Sekadar penghuni kategori uji.",
      category: slug,
      order: 9999,
      sections: [],
    });

    const blocked = await callAction(PAGE, deleteId, [slug], admin.cookie);
    check(
      "kategori yang masih dipakai TIDAK bisa dihapus",
      blocked.includes("Masih dipakai"),
      "kursusnya akan jadi tanpa kategori",
    );
    check(
      "kategori masih ada setelah percobaan itu",
      (await db.collection("categories").doc(slug).get()).exists,
      "tidak terhapus",
    );

    await db.collection("courses").doc("kursus-uji-kategori").delete();
  }

  // ── Menghapus setelah kosong ──────────────────────────────────────
  {
    const out = await callAction(PAGE, deleteId, [slug], admin.cookie);
    check("kategori kosong bisa dihapus", out.includes("dihapus"), "pesan hasil");
    check(
      "dokumen benar-benar hilang",
      !(await db.collection("categories").doc(slug).get()).exists,
      slug,
    );
  }

  // ── Kategori bawaan tidak tersentuh ───────────────────────────────
  {
    const bawaan = await Promise.all(
      ["neuroscience", "eeg", "analisis"].map((s) => db.collection("categories").doc(s).get()),
    );
    check("tiga kategori bawaan tetap utuh", bawaan.every((d) => d.exists), "neuroscience, eeg, analisis");
  }
}

async function main() {
  console.log(`\nMenguji ${BASE} terhadap ${targetLabel()}\n`);

  const admin = await createTestUser("admin");
  const educator = await createTestUser("educator");
  const biasa = await createTestUser("user", "biasa");

  console.log(`admin    : ${admin.email}`);
  console.log(`educator : ${educator.email}`);
  console.log(`biasa    : ${biasa.email}\n`);

  try {
    await run(admin, educator, biasa);
  } finally {
    await auth.deleteUsers([admin.uid, educator.uid, biasa.uid]);
    await db.collection("courses").doc("kursus-uji-kategori").delete().catch(() => undefined);
    await Promise.all(
      created.map((s) => db.collection("categories").doc(s).delete().catch(() => undefined)),
    );
    console.log("\nakun & kategori uji dihapus.");
  }

  finish();
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
