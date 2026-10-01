/**
 * Mencatat penjualan yang terjadi sebelum buku royalti ada.
 *
 *   npx tsx scripts/realise-sales.ts           # hanya melaporkan (aman)
 *   npx tsx scripts/realise-sales.ts --apply   # benar-benar menulis
 *   ... --order SYN-xxx                         # hanya satu pesanan
 *
 * Yang dipindai: pesanan berstatus `paid` ATAU yang punya `paidAt`. Syarat
 * kedua menangkap pesanan yang uangnya sudah masuk tetapi statusnya terlanjur
 * tertimpa notifikasi terlambat, sebelum bug itu diperbaiki.
 *
 * Pesanan lama tidak membawa syarat bagi hasil, jadi otomatis kena aturan
 * warisan: 100% pemilik kursus, tanpa potongan — tanpa tanggal batas yang
 * bisa salah ketik. Pesanan yang SUDAH membawa syarat memakai syaratnya.
 *
 * Pencatatannya memakai `realiseSale` milik aplikasi, bukan salinan. Aman
 * diulang — dan boleh dijalankan berkala sebagai rekonsiliasi: penjualan
 * yang sudah tercatat tidak disentuh.
 */
import { getFirestore } from "firebase-admin/firestore";
import { ROYALTY_SALES, planSale, realiseSale, type SaleInput } from "../frontend/src/lib/royaltyLedgerCore";
import { initAdmin, targetLabel } from "./project";

const apply = process.argv.includes("--apply");
const hanya = process.argv.includes("--order") ? process.argv[process.argv.indexOf("--order") + 1] : null;
const db = getFirestore(initAdmin());

const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

async function main() {
  console.log(`\nBackfill penjualan terhadap ${targetLabel()} — ${apply ? "MENULIS" : "hanya laporan"}\n`);

  const orders = await db.collection("orders").get();
  const lunas = orders.docs
    .filter((d) => !hanya || d.id === hanya)
    .filter((d) => d.get("status") === "paid" || Boolean(d.get("paidAt")));

  const pemilik = new Map<string, string | null>();
  async function ownerOf(slug: string): Promise<string | null> {
    if (!pemilik.has(slug)) {
      const c = await db.collection("courses").doc(slug).get();
      const uid = c.get("ownerUid");
      pemilik.set(slug, typeof uid === "string" && uid ? uid : null);
    }
    return pemilik.get(slug) ?? null;
  }

  let sudah = 0;
  let baru = 0;
  let gagal = 0;
  let kotor = 0;
  let potongan = 0;
  let belumTeralokasi = 0;

  for (const d of lunas) {
    const o = d.data();
    if ((await db.collection(ROYALTY_SALES).doc(d.id).get()).exists) {
      sudah++;
      continue;
    }

    const input: SaleInput = {
      orderId: d.id,
      courseSlug: String(o.courseSlug ?? ""),
      courseTitle: String(o.courseTitle ?? ""),
      gross: o.amount as number,
      royalty: o.royalty,
      courseOwnerUid: await ownerOf(String(o.courseSlug ?? "")),
      paidAt: String(o.paidAt || o.updatedAt || o.createdAt || new Date().toISOString()),
      source: "backfill",
    };

    try {
      const { sale } = planSale(input, new Date().toISOString());
      const status = o.status === "paid" ? "" : ` (status sekarang: ${o.status})`;
      console.log(
        `  ${apply ? "dicatat   " : "akan dicatat"}  ${input.courseSlug}  ${rupiah(sale.gross)}  ` +
          `${sale.termsOrigin}, potongan ${rupiah(sale.feeAmount)}, belum teralokasi ${rupiah(sale.unallocatedAmount)}${status}`,
      );

      if (apply) await realiseSale(db, input);

      baru++;
      kotor += sale.gross;
      potongan += sale.feeAmount;
      belumTeralokasi += sale.unallocatedAmount;
    } catch (err) {
      gagal++;
      console.log(`  GAGAL  ${d.id}  ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(
    `\n${lunas.length} pesanan lunas · ${sudah} sudah tercatat · ${baru} ${apply ? "dicatat" : "akan dicatat"} · ${gagal} gagal`,
  );
  console.log(
    `Total ${apply ? "dicatat" : "akan dicatat"}: kotor ${rupiah(kotor)}, potongan ${rupiah(potongan)}, belum teralokasi ${rupiah(belumTeralokasi)}`,
  );
  if (!apply && baru > 0) console.log("Tinjau totalnya, lalu jalankan ulang dengan --apply.\n");
  process.exit(gagal === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error("\nGAGAL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
