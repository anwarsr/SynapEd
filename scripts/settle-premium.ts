/**
 * Membagi hasil periode SynapEd Premium yang sudah berakhir ke educator.
 *
 *   npx tsx scripts/settle-premium.ts            # hanya melaporkan (aman)
 *   npx tsx scripts/settle-premium.ts --apply    # benar-benar menulis
 *
 * Sama persis dengan tombol "Bagikan pendapatan" di /admin/premium: memakai
 * `bagiHasilPeriode` dari premiumCore.ts milik aplikasi, bukan salinan. Aman
 * diulang dan boleh dijalankan berkala - periode yang sudah dibagi dilewati.
 */
import { getFirestore } from "firebase-admin/firestore";
import { PREMIUM_USAGE, bagiHasilPeriode, periodeSiapDibagi } from "../frontend/src/lib/premiumCore";
import { rencanakanPembagian, type PemakaianKursus } from "../frontend/src/lib/premiumRules";
import { initAdmin, targetLabel } from "./project";

const apply = process.argv.includes("--apply");
const db = getFirestore(initAdmin());
const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

async function main() {
  const now = new Date();
  console.log(`\nBagi hasil premium terhadap ${targetLabel()} - ${apply ? "MENULIS" : "hanya laporan"}\n`);

  const siap = await periodeSiapDibagi(db, now);
  if (siap.length === 0) {
    console.log("Tidak ada periode yang menunggu dibagi.\n");
    return;
  }

  let gagal = 0;
  for (const p of siap) {
    try {
      if (apply) {
        const { hasil, rencana } = await bagiHasilPeriode(db, p.periodId, now);
        console.log(`  ${hasil.padEnd(15)} ${p.periodId}  ${rupiah(p.gross)}  educator ${rupiah(rencana?.lines.reduce((n, l) => n + l.amount, 0) ?? 0)}`);
      } else {
        const usage = await db.collection(PREMIUM_USAGE).where("periodId", "==", p.periodId).get();
        const pakai = usage.docs.map((d) => d.data() as PemakaianKursus);
        const r = rencanakanPembagian(p.gross, p.gross > 0 ? p.terms : { feePercent: 0, referral: null }, pakai);
        console.log(
          `  akan dibagi     ${p.periodId}  ${rupiah(p.gross)}  educator ${rupiah(r.lines.reduce((n, l) => n + l.amount, 0))}` +
            `  platform ${rupiah(r.platformAmount)}  ${r.perKursus.length} kursus`,
        );
      }
    } catch (err) {
      gagal++;
      console.error(`  GAGAL           ${p.periodId}:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`\n${siap.length} periode${apply ? " diproses" : " siap dibagi - jalankan dengan --apply untuk menulis"}${gagal ? `, ${gagal} gagal` : ""}.\n`);
  if (gagal) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
