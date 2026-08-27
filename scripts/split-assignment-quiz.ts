/**
 * Mengubah pelajaran bertipe "quiz" yang sudah ada menjadi "penugasan".
 *
 *   npx tsx scripts/split-assignment-quiz.ts           # hanya melaporkan (aman)
 *   npx tsx scripts/split-assignment-quiz.ts --apply   # benar-benar menulis
 *
 * Dulu penugasan dan kuis satu tipe bernama "quiz", berlabel
 * "Penugasan / Kuis". Setelah keduanya dipisah, seluruh pelajaran lama harus
 * memilih salah satu — dan pemilik proyek memutuskan semuanya jadi penugasan.
 *
 * Keputusan itu cocok dengan datanya: saat skrip ini ditulis, kedua pelajaran
 * bertipe "quiz" di basis data sama-sama berlampiran PDF dan TIDAK punya satu
 * soal pun. Keduanya memang penugasan.
 *
 * Dokumen kuis yang tertinggal ikut dibuang, TETAPI hanya yang benar-benar
 * kosong. Yang punya soal dibiarkan dan dilaporkan: itu berarti ada kuis
 * sungguhan yang pelajarannya akan berubah jadi penugasan, dan keputusan
 * membuang soalnya bukan milik skrip ini.
 */
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { initAdmin, targetLabel } from "./project";

const apply = process.argv.includes("--apply");
const db: Firestore = getFirestore(initAdmin());

interface Lesson {
  slug?: unknown;
  title?: unknown;
  type?: unknown;
}
interface Section {
  lessons?: Lesson[];
}

async function main() {
  console.log(`Memisahkan penugasan & kuis — ${targetLabel()}`);
  console.log(apply ? "MODE: menulis (--apply)\n" : "MODE: hanya melaporkan\n");

  const snap = await db.collection("courses").get();

  let dokumen = 0;
  let pelajaran = 0;
  let quizKosong = 0;
  const bersoal: string[] = [];

  for (const doc of snap.docs) {
    const sections = doc.data().sections;
    if (!Array.isArray(sections)) continue;

    let berubah = false;

    const baru = (sections as Section[]).map((s) => ({
      ...s,
      lessons: (Array.isArray(s.lessons) ? s.lessons : []).map((l) => {
        if (l.type !== "quiz") return l;

        berubah = true;
        pelajaran++;
        console.log(`  ${doc.id} / ${String(l.slug)} "${String(l.title)}": quiz -> assignment`);
        return { ...l, type: "assignment" };
      }),
    }));

    if (!berubah) continue;
    dokumen++;
    if (apply) await doc.ref.update({ sections: baru });

    // Dokumen kuis yatim: pelajarannya bukan kuis lagi.
    const quizzes = await doc.ref.collection("quizzes").get();
    for (const q of quizzes.docs) {
      const soal = (q.data().questions ?? []) as unknown[];

      if (soal.length > 0) {
        bersoal.push(`${doc.id}/${q.id} (${soal.length} soal)`);
        continue;
      }

      quizKosong++;
      if (apply) await q.ref.delete();
    }
  }

  if (pelajaran === 0) {
    console.log("Tidak ada pelajaran bertipe quiz yang tersisa.");
    return;
  }

  console.log(`\n${pelajaran} pelajaran pada ${dokumen} kursus diubah menjadi penugasan.`);
  console.log(`${quizKosong} dokumen kuis kosong dibuang.`);

  if (bersoal.length > 0) {
    console.log("\nTIDAK disentuh — dokumen kuis yang masih punya soal:");
    for (const b of bersoal) console.log(`  ${b}`);
    console.log("Putuskan sendiri apakah soalnya masih diperlukan.");
  }

  if (!apply) console.log("\nJalankan ulang dengan --apply untuk menulisnya.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
