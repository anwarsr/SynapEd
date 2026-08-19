/**
 * Membakukan durasi yang sudah terlanjur ditulis sebagai teks bebas.
 *
 * Kolom durasi dulu bebas diisi apa saja, dan hasilnya persis seperti yang bisa
 * diduga: "1 Tahun", "12" tanpa satuan, sampai "Tugas" dan "Bacaan" yang bukan
 * durasi sama sekali. Sekarang formnya angka + dropdown, jadi nilai lama itu
 * perlu disetarakan ke bentuk yang sama.
 *
 *   npx tsx scripts/convert-durations.ts           # hanya melaporkan (aman)
 *   npx tsx scripts/convert-durations.ts --apply   # benar-benar menulis
 *
 * Aturannya dipinjam dari aplikasinya sendiri lewat canonicalDuration(), BUKAN
 * ditulis ulang di sini. Kalau disalin, skrip dan form akan perlahan berbeda
 * pendapat tentang apa arti "1 Tahun" — dan yang kalah adalah data.
 *
 * Yang disentuh:
 *   courses/{slug}.duration                      -> Jam / Hari / Minggu / Bulan
 *   courses/{slug}.sections[].lessons[].duration -> Detik / Menit / Jam
 *   courseChangeRequests/{id}.before|after       -> keduanya, kalau ada
 *
 * Pengajuan yang masih menunggu ikut dikonversi karena isinya disalin apa
 * adanya ke kursus saat admin menyetujui — kalau dilewati, satu persetujuan
 * cukup untuk mengembalikan "1 Tahun" ke katalog setelah konversi selesai.
 */
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { canonicalDuration } from "../frontend/src/lib/duration";
import { initAdmin, targetLabel } from "./project";

const apply = process.argv.includes("--apply");
const db: Firestore = getFirestore(initAdmin());

/** Bentuk "tidak diisi" yang dipakai normalizeSections dan createCourse. */
const KOSONG = "—";

interface Lesson {
  title?: unknown;
  duration?: unknown;
}
interface Section {
  title?: unknown;
  lessons?: Lesson[];
}

/** Satu perubahan yang akan (atau sudah) ditulis — dikumpulkan untuk laporan. */
interface Ubahan {
  dokumen: string;
  bidang: string;
  dari: string;
  jadi: string;
}

function baku(raw: unknown, scope: "course" | "lesson"): string {
  return canonicalDuration(typeof raw === "string" ? raw : "", scope) || KOSONG;
}

/**
 * Menyalin sections dengan durasi pelajaran yang sudah dibakukan.
 *
 * Mengembalikan `null` kalau tidak ada yang berubah, supaya pemanggilnya bisa
 * membedakan "tidak perlu ditulis" dari "ditulis dengan isi yang sama".
 */
function bakukanSections(
  sections: unknown,
  dokumen: string,
  jejak: Ubahan[],
): Section[] | null {
  if (!Array.isArray(sections)) return null;

  let berubah = false;

  const hasil = (sections as Section[]).map((s, si) => {
    const lessons = Array.isArray(s.lessons) ? s.lessons : [];

    return {
      ...s,
      lessons: lessons.map((l, li) => {
        const lama = typeof l.duration === "string" ? l.duration : "";
        const baru = baku(lama, "lesson");
        if (lama === baru) return l;

        berubah = true;
        jejak.push({
          dokumen,
          bidang: `sections[${si}].lessons[${li}] "${String(l.title ?? "")}"`,
          dari: lama,
          jadi: baru,
        });
        return { ...l, duration: baru };
      }),
    };
  });

  return berubah ? hasil : null;
}

async function konversiKursus(jejak: Ubahan[]): Promise<number> {
  const snap = await db.collection("courses").get();
  let ditulis = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const patch: Record<string, unknown> = {};

    const lama = typeof data.duration === "string" ? data.duration : "";
    const baru = baku(lama, "course");
    if (lama !== baru) {
      patch.duration = baru;
      jejak.push({ dokumen: `courses/${doc.id}`, bidang: "duration", dari: lama, jadi: baru });
    }

    const sections = bakukanSections(data.sections, `courses/${doc.id}`, jejak);
    if (sections) patch.sections = sections;

    if (Object.keys(patch).length === 0) continue;
    ditulis++;
    if (apply) await doc.ref.update(patch);
  }

  return ditulis;
}

async function konversiPengajuan(jejak: Ubahan[]): Promise<number> {
  const snap = await db.collection("courseChangeRequests").get();
  let ditulis = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const patch: Record<string, unknown> = {};

    // `before` ikut dibakukan supaya perbandingan sebelum-sesudah di panel admin
    // tidak memunculkan selisih palsu: kalau hanya `after` yang dikonversi,
    // setiap pengajuan akan tampak "mengubah durasi" padahal educator tidak
    // menyentuhnya.
    for (const sisi of ["before", "after"] as const) {
      const snapshot = data[sisi];
      if (!snapshot || typeof snapshot !== "object") continue;

      const isi = snapshot as Record<string, unknown>;
      const label = `courseChangeRequests/${doc.id}.${sisi}`;
      const salinan: Record<string, unknown> = { ...isi };
      let berubah = false;

      const lama = typeof isi.duration === "string" ? isi.duration : "";
      const baru = baku(lama, "course");
      if (lama !== baru) {
        salinan.duration = baru;
        berubah = true;
        jejak.push({ dokumen: label, bidang: "duration", dari: lama, jadi: baru });
      }

      const sections = bakukanSections(isi.sections, label, jejak);
      if (sections) {
        salinan.sections = sections;
        berubah = true;
      }

      if (berubah) patch[sisi] = salinan;
    }

    if (Object.keys(patch).length === 0) continue;
    ditulis++;
    if (apply) await doc.ref.update(patch);
  }

  return ditulis;
}

async function main() {
  console.log(`Konversi durasi — ${targetLabel()}`);
  console.log(apply ? "MODE: menulis (--apply)\n" : "MODE: hanya melaporkan\n");

  const jejak: Ubahan[] = [];
  const kursus = await konversiKursus(jejak);
  const pengajuan = await konversiPengajuan(jejak);

  if (jejak.length === 0) {
    console.log("Semua durasi sudah baku. Tidak ada yang diubah.");
    return;
  }

  let dokumenTerakhir = "";
  for (const u of jejak) {
    if (u.dokumen !== dokumenTerakhir) {
      console.log(`\n${u.dokumen}`);
      dokumenTerakhir = u.dokumen;
    }
    const dari = u.dari === "" ? "(kosong)" : u.dari;
    console.log(`  ${u.bidang}: "${dari}" -> "${u.jadi}"`);
  }

  console.log(
    `\n${jejak.length} nilai pada ${kursus} kursus dan ${pengajuan} pengajuan.`,
  );
  if (!apply) console.log("Jalankan ulang dengan --apply untuk menulisnya.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
