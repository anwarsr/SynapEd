/**
 * Membuang field `free` dari setiap pelajaran.
 *
 * "Bisa dipratinjau gratis" dihapus atas permintaan pemilik proyek: pelajaran
 * yang ditandai `free` dulu bisa dibuka tanpa mendaftar. Kodenya sudah tidak
 * pernah membacanya lagi, tapi nilainya masih tertinggal di basis data.
 *
 *   npx tsx scripts/drop-lesson-free.ts           # hanya melaporkan (aman)
 *   npx tsx scripts/drop-lesson-free.ts --apply   # benar-benar menulis
 *
 * Dibiarkan pun aplikasi tetap berjalan benar — dan justru itu alasannya
 * dibuang. Field yang tidak pernah dibaca tapi masih terlihat di Firestore
 * Console adalah jebakan: orang berikutnya akan mengira ia masih berarti.
 *
 * Yang disentuh:
 *   courses/{slug}.sections[].lessons[].free
 *   courseChangeRequests/{id}.before|after.sections[].lessons[].free
 */
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { initAdmin, targetLabel } from "./project";

const apply = process.argv.includes("--apply");
const db: Firestore = getFirestore(initAdmin());

interface Lesson {
  free?: unknown;
}
interface Section {
  lessons?: Lesson[];
}

/**
 * Menyalin sections tanpa `free`. `null` kalau memang tidak ada yang dibuang,
 * supaya dokumen yang sudah bersih tidak ditulis ulang tanpa alasan.
 */
function tanpaFree(sections: unknown): { sections: Section[]; jumlah: number } | null {
  if (!Array.isArray(sections)) return null;

  let jumlah = 0;

  const hasil = (sections as Section[]).map((s) => ({
    ...s,
    lessons: (Array.isArray(s.lessons) ? s.lessons : []).map((l) => {
      if (!("free" in l)) return l;
      jumlah++;
      // Disalin tanpa kuncinya, bukan diisi FieldValue.delete(): pelajaran ada
      // di dalam array, dan penghapusan field tidak bisa menembus elemen array.
      const { free: _dibuang, ...sisa } = l;
      return sisa;
    }),
  }));

  return jumlah === 0 ? null : { sections: hasil, jumlah };
}

async function sapuKursus(): Promise<{ dokumen: number; nilai: number }> {
  const snap = await db.collection("courses").get();
  let dokumen = 0;
  let nilai = 0;

  for (const doc of snap.docs) {
    const hasil = tanpaFree(doc.data().sections);
    if (!hasil) continue;

    dokumen++;
    nilai += hasil.jumlah;
    console.log(`  courses/${doc.id} — ${hasil.jumlah} pelajaran`);
    if (apply) await doc.ref.update({ sections: hasil.sections });
  }

  return { dokumen, nilai };
}

async function sapuPengajuan(): Promise<{ dokumen: number; nilai: number }> {
  const snap = await db.collection("courseChangeRequests").get();
  let dokumen = 0;
  let nilai = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const patch: Record<string, unknown> = {};
    let jumlah = 0;

    for (const sisi of ["before", "after"] as const) {
      const snapshot = data[sisi];
      if (!snapshot || typeof snapshot !== "object") continue;

      const isi = snapshot as Record<string, unknown>;
      const hasil = tanpaFree(isi.sections);
      if (!hasil) continue;

      patch[sisi] = { ...isi, sections: hasil.sections };
      jumlah += hasil.jumlah;
    }

    if (jumlah === 0) continue;
    dokumen++;
    nilai += jumlah;
    console.log(`  courseChangeRequests/${doc.id} — ${jumlah} pelajaran`);
    if (apply) await doc.ref.update(patch);
  }

  return { dokumen, nilai };
}

async function main() {
  console.log(`Membuang field 'free' — ${targetLabel()}`);
  console.log(apply ? "MODE: menulis (--apply)\n" : "MODE: hanya melaporkan\n");

  const kursus = await sapuKursus();
  const pengajuan = await sapuPengajuan();
  const total = kursus.nilai + pengajuan.nilai;

  if (total === 0) {
    console.log("Tidak ada field 'free' yang tersisa.");
    return;
  }

  console.log(
    `\n${total} pelajaran pada ${kursus.dokumen} kursus dan ${pengajuan.dokumen} pengajuan.`,
  );
  if (!apply) console.log("Jalankan ulang dengan --apply untuk menulisnya.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
