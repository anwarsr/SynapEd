/**
 * Memindahkan kategori dari konstanta di dalam kode ke koleksi Firestore.
 *
 * Sebelumnya daftar kategori hidup sebagai `CATEGORIES` di educatorCourses.ts,
 * jadi hanya bisa ditambah dengan mengubah kode. Sekarang admin mengelolanya
 * lewat panel, dan koleksinya perlu diisi lebih dulu dengan yang sudah dipakai
 * kursus-kursus yang ada — kalau tidak, kursus itu jadi berkategori yang tidak
 * terdaftar dan tidak bisa disunting lagi.
 *
 * Aman dijalankan berkali-kali: kategori yang sudah ada tidak ditimpa.
 *
 *   npx tsx scripts/seed-categories.ts
 */
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin, targetLabel } from "./project";

const BUILT_IN: Array<{ slug: string; label: string }> = [
  { slug: "neuroscience", label: "Neuroscience" },
  { slug: "eeg", label: "Teknologi EEG" },
  { slug: "analisis", label: "Analisis Data" },
];

async function main() {
  const db = getFirestore(initAdmin());
  console.log(`\nTarget: ${targetLabel()}\n`);

  // Kategori apa pun yang sudah dipakai kursus ikut didaftarkan, termasuk
  // yang tidak ada di daftar bawaan — supaya tidak ada kursus yang tertinggal
  // dengan kategori yang tidak terdaftar.
  const courses = await db.collection("courses").get();
  const used = new Set<string>();
  courses.forEach((d) => {
    const category = d.data().category as string | undefined;
    if (category) used.add(category);
  });

  const wanted = [...BUILT_IN];
  for (const slug of used) {
    if (!wanted.some((c) => c.slug === slug)) wanted.push({ slug, label: slug });
  }

  let added = 0;
  for (const [i, category] of wanted.entries()) {
    const ref = db.collection("categories").doc(category.slug);

    if ((await ref.get()).exists) {
      console.log(`  = ${category.slug} (sudah ada)`);
      continue;
    }

    await ref.set({ label: category.label, order: i, createdAt: new Date().toISOString() });
    console.log(`  + ${category.slug} — ${category.label}`);
    added++;
  }

  const total = await db.collection("categories").count().get();
  console.log(`\n${added} ditambahkan. Total ${total.data().count} kategori.`);

  // Setiap kategori yang dipakai kursus WAJIB terdaftar; kalau tidak, kursus
  // itu tidak lolos validasi saat educator menyuntingnya.
  const registered = new Set((await db.collection("categories").get()).docs.map((d) => d.id));
  const orphan = [...used].filter((c) => !registered.has(c));

  if (orphan.length) {
    console.error(`\nGAGAL: kategori dipakai kursus tapi tidak terdaftar: ${orphan.join(", ")}`);
    process.exit(1);
  }
  console.log("Semua kategori yang dipakai kursus sudah terdaftar.\n");
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
