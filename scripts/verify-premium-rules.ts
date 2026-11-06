/**
 * Menguji aturan SynapEd Premium - murni, tanpa dev server & kredensial.
 *
 *   npx tsx scripts/verify-premium-rules.ts
 *
 * Yang dijaga:
 *   1. masa aktif: membeli saat aktif MENUMPUK, saat habis mulai sekarang;
 *   2. harga: hanya bilangan bulat dalam rentang;
 *   3. syarat yang dibekukan: bentuk rusak ditolak, referral ≤ potongan;
 *   4. pembagian proporsional: Σ tepat, sisa terbesar, seri ke urutan awal;
 *   5. rencana pembagian periode: invarian uang (platform + referral + Σ
 *      pendapatan + belum teralokasi = gross) untuk ribuan kasus acak, bobot
 *      pelajaran dihormati, tanpa pemakaian → platform, syarat rusak → belum
 *      teralokasi, kontributor dibagi persis seperti `splitSale`.
 */
import { check, finish } from "./checks";
import { mulberry32 } from "../frontend/src/lib/lab/labRandom";
import { splitSale } from "../frontend/src/lib/royaltySplit";
import {
  DEFAULT_PREMIUM_PRICE,
  PREMIUM_HARI,
  bagiProporsional,
  makePremiumTerms,
  parseHargaPremium,
  parsePremiumTerms,
  perpanjang,
  premiumAktif,
  rencanakanPembagian,
  sisaHari,
  validasiHargaPremium,
  type PemakaianKursus,
} from "../frontend/src/lib/premiumRules";

const HARI = 86_400_000;
const t0 = new Date("2026-11-06T03:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

console.log("\n1. Masa aktif");
{
  const baru = perpanjang(null, t0);
  check("belum pernah premium → mulai sekarang, 30 hari", baru.start === t0.toISOString() && Date.parse(baru.end) - t0.getTime() === PREMIUM_HARI * HARI, `${baru.start} → ${baru.end}`);
  const aktifSampai = iso(t0.getTime() + 10 * HARI);
  const tumpuk = perpanjang(aktifSampai, t0);
  check("masih aktif 10 hari → ditumpuk (mulai di tanggal berakhir, total 40 hari)", tumpuk.start === aktifSampai && Date.parse(tumpuk.end) - t0.getTime() === 40 * HARI, tumpuk.end);
  const habis = perpanjang(iso(t0.getTime() - 3 * HARI), t0);
  check("sudah habis → mulai sekarang (hari yang lewat tidak dihitung)", habis.start === t0.toISOString(), habis.start);
  check("tanggal rusak → mulai sekarang", perpanjang("bukan-tanggal", t0).start === t0.toISOString(), "ok");
  check("premiumAktif: masa depan aktif, lampau/null/tepat sekarang tidak", premiumAktif(aktifSampai, t0) && !premiumAktif(iso(t0.getTime() - 1), t0) && !premiumAktif(null, t0) && !premiumAktif(t0.toISOString(), t0), "ok");
  check("sisaHari dibulatkan ke atas, 0 bila tidak aktif", sisaHari(iso(t0.getTime() + 2 * 3600_000), t0) === 1 && sisaHari(aktifSampai, t0) === 10 && sisaHari(null, t0) === 0, "ok");
  check("pemberian admin: jumlah hari bebas", Date.parse(perpanjang(null, t0, 7).end) - t0.getTime() === 7 * HARI, "ok");
}

console.log("\n2. Harga");
{
  check("harga bawaan 50.000 sah", validasiHargaPremium(DEFAULT_PREMIUM_PRICE) === null && DEFAULT_PREMIUM_PRICE === 50_000, String(DEFAULT_PREMIUM_PRICE));
  for (const salah of [0, 9_999, 5_000_001, 49_999.5, "50000", null, Number.NaN]) {
    check(`harga ${JSON.stringify(salah)} ditolak`, validasiHargaPremium(salah) !== null && parseHargaPremium(salah) === null, String(validasiHargaPremium(salah)));
  }
  check("harga 75.000 diterima", parseHargaPremium(75_000) === 75_000, "ok");
}

console.log("\n3. Syarat yang dibekukan");
{
  const ok = makePremiumTerms(30, { uid: "u-ref", code: "TEMAN10", percent: 10 }, "x");
  check("syarat sah terbaca", JSON.stringify(parsePremiumTerms(ok)) === JSON.stringify(ok), JSON.stringify(parsePremiumTerms(ok)));
  check("tanpa referral sah", parsePremiumTerms({ feePercent: 30, referral: null, capturedAt: "x" })?.referral === null, "ok");
  for (const [nama, rusak] of [
    ["potongan 101", { feePercent: 101, referral: null }],
    ["potongan pecahan", { feePercent: 2.5, referral: null }],
    ["referral > potongan", { feePercent: 5, referral: { uid: "a", code: "TEMAN10", percent: 10 } }],
    ["referral tanpa uid", { feePercent: 30, referral: { uid: "", code: "TEMAN10", percent: 10 } }],
    ["referral bukan objek", { feePercent: 30, referral: "TEMAN10" }],
    ["null", null],
  ] as const) {
    check(`syarat rusak ditolak: ${nama}`, parsePremiumTerms(rusak) === null, "null");
  }
}

console.log("\n4. Pembagian proporsional");
{
  check("50.000 dibagi 1:1:1 → Σ tepat, sisa ke yang awal", JSON.stringify(bagiProporsional(50_000, [1, 1, 1])) === "[16667,16667,16666]", JSON.stringify(bagiProporsional(50_000, [1, 1, 1])));
  check("bobot nol dapat nol", JSON.stringify(bagiProporsional(100, [0, 3, 1])) === "[0,75,25]", JSON.stringify(bagiProporsional(100, [0, 3, 1])));
  let salah = "";
  const acak = mulberry32(5050);
  for (let t = 0; t < 2000; t++) {
    const total = Math.floor(acak() * 5_000_000);
    const bobot = Array.from({ length: 1 + Math.floor(acak() * 12) }, () => Math.floor(acak() * 40));
    if (!bobot.some((b) => b > 0)) bobot[0] = 1;
    const hasil = bagiProporsional(total, bobot);
    const jumlah = bobot.reduce((n, b) => n + b, 0);
    const adil = hasil.every((h, i) => Math.abs(h - (total * bobot[i]) / jumlah) < 1);
    if (!salah && (hasil.reduce((n, h) => n + h, 0) !== total || !adil)) salah = `${total} ${bobot}`;
  }
  check("2000 kasus acak: Σ = total dan tiap bagian < 1 rupiah dari bagian pasnya", !salah, salah || "ok");
  let melempar = false;
  try {
    bagiProporsional(10, [0, 0]);
  } catch {
    melempar = true;
  }
  check("semua bobot nol → melempar (bukan membagi diam-diam)", melempar, "ok");
}

console.log("\n5. Rencana pembagian satu periode");
{
  const kursus = (slug: string, lessons: number, ownerUid: string | null, contributors = ownerUid ? [{ uid: ownerUid, share: 100 }] : []): PemakaianKursus => ({
    courseSlug: slug,
    courseTitle: slug,
    lessons,
    ownerUid,
    contributors,
  });
  const syarat = makePremiumTerms(30, null, "x");
  const r = rencanakanPembagian(50_000, syarat, [kursus("a", 3, "ed-a"), kursus("b", 1, "ed-b")]);
  check("potongan 30% = 15.000, pool 35.000", r.feeAmount === 15_000 && r.pool === 35_000 && r.platformAmount === 15_000, `${r.feeAmount}/${r.pool}`);
  check("pool dibagi 3:1 sesuai pelajaran", r.perKursus.map((k) => k.amount).join(",") === "26250,8750", r.perKursus.map((k) => k.amount).join(","));
  check("pendapatan pemilik tercatat per kursus", r.lines.map((l) => `${l.uid}:${l.amount}`).join(",") === "ed-a:26250,ed-b:8750", r.lines.map((l) => `${l.uid}:${l.amount}`).join(","));

  const denganRujukan = rencanakanPembagian(50_000, makePremiumTerms(30, { uid: "rujuk", code: "TEMAN10", percent: 10 }, "x"), [kursus("a", 1, "ed-a")]);
  check("referral 10% diambil dari potongan: platform 10.000, referral 5.000, educator tetap 35.000", denganRujukan.referralAmount === 5_000 && denganRujukan.platformAmount === 10_000 && denganRujukan.lines[0].amount === 35_000, `${denganRujukan.platformAmount}/${denganRujukan.referralAmount}`);

  const tanpa = rencanakanPembagian(50_000, syarat, []);
  check("tanpa pemakaian → seluruh pool ke platform", tanpa.platformAmount === 50_000 && tanpa.lines.length === 0, String(tanpa.platformAmount));
  const nolPelajaran = rencanakanPembagian(50_000, syarat, [kursus("a", 0, "ed-a")]);
  check("pemakaian 0 pelajaran tidak dihitung", nolPelajaran.lines.length === 0 && nolPelajaran.platformAmount === 50_000, "ok");

  const tanpaPemilik = rencanakanPembagian(50_000, syarat, [kursus("lama", 2, null), kursus("a", 2, "ed-a")]);
  check("kursus tanpa pemilik → bagiannya belum teralokasi (ditinjau admin)", tanpaPemilik.unallocatedAmount === 17_500 && tanpaPemilik.lines.length === 1, String(tanpaPemilik.unallocatedAmount));

  const rusak = rencanakanPembagian(50_000, { feePercent: 300 }, [kursus("a", 1, "ed-a")]);
  check("syarat rusak → seluruh gross belum teralokasi, tak ada yang dibayar", !rusak.termsValid && rusak.unallocatedAmount === 50_000 && rusak.lines.length === 0, "ok");

  const kolaborasi = [{ uid: "pemilik", share: 70 }, { uid: "rekan", share: 30 }];
  const dibagi = rencanakanPembagian(50_000, syarat, [kursus("k", 5, "pemilik", kolaborasi)]);
  const harap = splitSale(35_000, 0, kolaborasi).lines.map((l) => `${l.uid}:${l.amount}`).join(",");
  check("kontributor dibagi persis seperti splitSale", dibagi.lines.map((l) => `${l.uid}:${l.amount}`).join(",") === harap, harap);

  const urutA = rencanakanPembagian(50_000, syarat, [kursus("b", 1, "x"), kursus("a", 1, "y"), kursus("c", 1, "z")]);
  const urutB = rencanakanPembagian(50_000, syarat, [kursus("c", 1, "z"), kursus("a", 1, "y"), kursus("b", 1, "x")]);
  check("hasil tidak bergantung urutan data pemakaian", JSON.stringify(urutA.lines) === JSON.stringify(urutB.lines), "ok");

  let salah = "";
  const acak = mulberry32(9090);
  for (let t = 0; t < 3000; t++) {
    const gross = Math.floor(acak() * 600_000);
    const fee = Math.floor(acak() * 101);
    const ref = acak() < 0.5 ? { uid: "r", code: "TEMAN10", percent: Math.floor(acak() * (fee + 1)) } : null;
    const pakai = Array.from({ length: Math.floor(acak() * 6) }, (_, i) => {
      const n = 1 + Math.floor(acak() * 3);
      const kontributor = n === 1 ? [{ uid: `o${i}`, share: 100 }] : [{ uid: `o${i}`, share: 60 }, ...Array.from({ length: n - 1 }, (_, j) => ({ uid: `c${i}-${j}`, share: j === n - 2 ? 40 - Math.floor(40 / (n - 1)) * (n - 2) : Math.floor(40 / (n - 1)) }))];
      return kursus(`k${i}`, Math.floor(acak() * 9), acak() < 0.1 ? null : `o${i}`, kontributor);
    });
    const p = rencanakanPembagian(gross, makePremiumTerms(fee, ref, "x"), pakai);
    const jumlah = p.platformAmount + p.referralAmount + p.unallocatedAmount + p.lines.reduce((n, l) => n + l.amount, 0);
    if (!salah && (jumlah !== gross || p.referralAmount > p.feeAmount || p.lines.some((l) => l.amount <= 0))) salah = `gross ${gross} fee ${fee} → ${jumlah}`;
  }
  check("3000 periode acak: uang tidak tercipta/hilang, referral ≤ potongan, tak ada baris 0", !salah, salah || "ok");
}

finish();
