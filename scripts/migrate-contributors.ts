/**
 * Mengisi pembagian hasil untuk kursus yang dibuat sebelum fitur kontributor.
 *
 *   npx tsx scripts/migrate-contributors.ts           # hanya melaporkan (aman)
 *   npx tsx scripts/migrate-contributors.ts --apply   # benar-benar menulis
 *
 * Kursus lama = pemiliknya sendiri, 100%. Aplikasi sebenarnya sudah MEMBACA
 * kursus tanpa field ini sebagai "pemilik 100%", jadi skrip ini bukan syarat
 * agar apa pun berjalan. Gunanya: `contributorUids` terisi, sehingga kueri
 * "kursus tempat saya berkontribusi" di dashboard menemukan kursus lama juga.
 *
 * Kursus tanpa `ownerUid` (hasil migrasi awal) dilaporkan lalu dilewati —
 * tidak ada akun yang bisa menerima bagiannya.
 *
 * Aturannya dari `parseStoredContributors` milik aplikasi, bukan salinan.
 * Aman diulang: kursus yang pembagiannya sudah sah tidak disentuh.
 */
import { getFirestore } from "firebase-admin/firestore";
import { parseStoredContributors } from "../frontend/src/lib/contributors";
import { initAdmin, targetLabel } from "./project";

const apply = process.argv.includes("--apply");
const db = getFirestore(initAdmin());

async function main() {
  console.log(`\nMigrasi kontributor terhadap ${targetLabel()} — ${apply ? "MENULIS" : "hanya laporan"}\n`);

  const snap = await db.collection("courses").get();
  let sah = 0;
  let diisi = 0;
  let tanpaPemilik = 0;
  let rusak = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const ownerUid = typeof d.ownerUid === "string" && d.ownerUid ? d.ownerUid : null;

    if (!ownerUid) {
      tanpaPemilik++;
      console.log(`  dilewati     ${doc.id} — tidak punya ownerUid`);
      continue;
    }

    const tersimpan = parseStoredContributors(d.contributors, ownerUid);
    const uids = Array.isArray(d.contributorUids) ? (d.contributorUids as unknown[]) : null;
    const uidsCocok =
      tersimpan !== null &&
      uids !== null &&
      uids.length === tersimpan.length &&
      tersimpan.every((c, i) => uids[i] === c.uid);

    if (tersimpan && uidsCocok) {
      sah++;
      continue;
    }

    // Field ada tapi tidak sah: jangan ditimpa diam-diam — bisa jadi itu
    // pembagian sungguhan yang rusak dan perlu diperiksa manusia.
    if (d.contributors !== undefined && tersimpan === null) {
      rusak++;
      console.log(`  PERIKSA      ${doc.id} — contributors ada tapi tidak sah: ${JSON.stringify(d.contributors)}`);
      continue;
    }

    const contributors = tersimpan ?? [{ uid: ownerUid, share: 100 }];
    console.log(`  ${apply ? "diisi " : "akan diisi"}   ${doc.id} — ${contributors.map((c) => `${c.uid.slice(0, 6)}…=${c.share}%`).join(", ")}`);

    if (apply) {
      await doc.ref.update({
        contributors,
        contributorUids: contributors.map((c) => c.uid),
      });
    }
    diisi++;
  }

  console.log(
    `\n${snap.size} kursus · ${sah} sudah sah · ${diisi} ${apply ? "diisi" : "akan diisi"} · ${tanpaPemilik} tanpa pemilik · ${rusak} perlu diperiksa`,
  );
  if (!apply && diisi > 0) console.log("Jalankan ulang dengan --apply untuk menulis.\n");
  process.exit(rusak === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
