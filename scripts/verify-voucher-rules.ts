/**
 * Menguji aturan voucher (lib/voucherRules.ts): hitungan potongan, cakupan,
 * status, alasan penolakan, validasi masukan admin, dan normaliser baca.
 * Murni - tanpa dev server & kredensial.
 *
 *   npx tsx scripts/verify-voucher-rules.ts
 */
import { check, finish } from "./checks";
import {
  MIN_BAYAR,
  alasanDitolak,
  buatKodeAcak,
  cocokSasaran,
  hitungHarga,
  kodeSah,
  normalisasiKode,
  parseVoucher,
  parseVoucherPesanan,
  pratinjauDariPesanan,
  statusVoucher,
  validasiVoucher,
  type KonteksPemakaian,
  type MasukanVoucher,
  type SasaranVoucher,
  type Voucher,
} from "../frontend/src/lib/voucherRules";

const NOW = new Date("2026-11-15T05:00:00.000Z");
const JAM = 3_600_000;

function v(extra: Partial<Voucher> = {}): Voucher {
  return parseVoucher(
    {
      active: true,
      jenis: "persen",
      nilai: 20,
      premium: false,
      semuaKursus: true,
      batasPerAkun: 1,
      ...extra,
    },
    extra.code ?? "HEMAT20",
  );
}

const kursus = (slug = "ai-dasar", category = "teknologi", price = 100_000): SasaranVoucher => ({ kind: "course", slug, category, price });
const premium = (price = 50_000): SasaranVoucher => ({ kind: "premium", price });
const ktx = (sasaran: SasaranVoucher, extra: Partial<KonteksPemakaian> = {}): KonteksPemakaian => ({
  now: NOW,
  uid: "u1",
  sasaran,
  pakaiAkun: 0,
  pakaiTotal: 0,
  pernahBeli: false,
  ...extra,
});

// ── Hitungan potongan ───────────────────────────────────────────────────
{
  const h = (vv: Partial<Voucher>, harga: number) => hitungHarga(v(vv), harga);
  check("20% dari 100.000 = potong 20.000", h({}, 100_000).potongan === 20_000 && h({}, 100_000).akhir === 80_000, JSON.stringify(h({}, 100_000)));
  check("persen dibulatkan ke BAWAH", h({ nilai: 15 }, 99_999).potongan === 14_999, String(h({ nilai: 15 }, 99_999).potongan));
  check("batas maksimal potongan persen dihormati", h({ nilai: 50, maksPotongan: 30_000 }, 100_000).potongan === 30_000, String(h({ nilai: 50, maksPotongan: 30_000 }, 100_000).potongan));
  check("nominal lebih besar dari harga = gratis penuh", h({ jenis: "nominal", nilai: 500_000 }, 100_000).akhir === 0, JSON.stringify(h({ jenis: "nominal", nilai: 500_000 }, 100_000)));
  check("100% = gratis", h({ nilai: 100 }, 75_000).akhir === 0 && h({ nilai: 100 }, 75_000).potongan === 75_000, JSON.stringify(h({ nilai: 100 }, 75_000)));
  const kecil = h({ jenis: "nominal", nilai: 99_500 }, 100_000);
  check(`sisa di bawah Rp${MIN_BAYAR} dinaikkan ke Rp${MIN_BAYAR}`, kecil.akhir === MIN_BAYAR && kecil.potongan === 99_000, JSON.stringify(kecil));
  const sub = h({ jenis: "nominal", nilai: 100 }, 800);
  check("harga di bawah minimal & tak gratis penuh = tanpa potongan", sub.potongan === 0 && sub.akhir === 800, JSON.stringify(sub));
  check("100% dengan batas maksimal TIDAK menggratiskan", h({ nilai: 100, maksPotongan: 10_000 }, 50_000).akhir === 40_000, JSON.stringify(h({ nilai: 100, maksPotongan: 10_000 }, 50_000)));
  for (const harga of [1_000, 12_345, 50_000, 999_999]) {
    for (const vv of [{ nilai: 33 }, { jenis: "nominal" as const, nilai: 7_777 }, { nilai: 99, maksPotongan: 5_000 }]) {
      const r = h(vv, harga);
      if (r.potongan + r.akhir !== harga || r.potongan < 0 || (r.akhir !== 0 && r.akhir < Math.min(harga, MIN_BAYAR))) {
        check(`invarian potongan + akhir = harga (${harga})`, false, JSON.stringify({ vv, r }));
      }
    }
  }
  check("invarian potongan + akhir = harga, akhir 0 atau ≥ minimal", true, "12 kombinasi");
}

// ── Cakupan ─────────────────────────────────────────────────────────────
{
  check("semua kursus cocok untuk kursus apa pun", cocokSasaran(v(), kursus()), "semuaKursus");
  check("semua kursus TIDAK mencakup Premium", !cocokSasaran(v(), premium()), "premium terpisah");
  check("khusus Premium cocok Premium", cocokSasaran(v({ semuaKursus: false, premium: true }), premium()), "premium");
  check("khusus Premium tidak cocok kursus", !cocokSasaran(v({ semuaKursus: false, premium: true }), kursus()), "premium");
  const tertentu = v({ semuaKursus: false, kursus: ["ai-dasar"] });
  check("kursus tertentu cocok", cocokSasaran(tertentu, kursus("ai-dasar")), "slug");
  check("kursus lain tidak cocok", !cocokSasaran(tertentu, kursus("python")), "slug lain");
  const kat = v({ semuaKursus: false, kategori: ["teknologi"] });
  check("kategori cocok", cocokSasaran(kat, kursus("python", "teknologi")), "kategori");
  check("kategori lain tidak cocok", !cocokSasaran(kat, kursus("python", "biologi")), "kategori lain");
  check("kursus tanpa kategori tidak cocok kategori kosong", !cocokSasaran(v({ semuaKursus: false, kategori: [""] }), kursus("x", "")), "kategori ''");
}

// ── Status & alasan penolakan ───────────────────────────────────────────
{
  check("aktif", statusVoucher(v(), NOW) === "aktif", "aktif");
  check("nonaktif", statusVoucher(v({ active: false }), NOW) === "nonaktif", "nonaktif");
  check("terjadwal", statusVoucher(v({ mulai: new Date(NOW.getTime() + JAM).toISOString() }), NOW) === "terjadwal", "mulai nanti");
  check("berakhir tepat di detiknya", statusVoucher(v({ berakhir: NOW.toISOString() }), NOW) === "berakhir", "berakhir = now");
  check("kuota habis", statusVoucher(v({ kuota: 3, dipakai: 3 }), NOW) === "habis", "habis");

  const tolak = (vv: Partial<Voucher>, s: SasaranVoucher, extra: Partial<KonteksPemakaian> = {}) => alasanDitolak(v(vv), ktx(s, extra));
  check("voucher sah diterima", tolak({}, kursus()) === null, String(tolak({}, kursus())));
  check("nonaktif ditolak", tolak({ active: false }, kursus())?.includes("tidak aktif") === true, String(tolak({ active: false }, kursus())));
  check("belum mulai ditolak + tanggal WIB", tolak({ mulai: "2026-11-20T03:00:00.000Z" }, kursus())?.includes("10.00 WIB") === true, String(tolak({ mulai: "2026-11-20T03:00:00.000Z" }, kursus())));
  check("kedaluwarsa ditolak", tolak({ berakhir: new Date(NOW.getTime() - 1).toISOString() }, kursus())?.includes("berakhir") === true, "berakhir");
  check("akun lain ditolak untuk voucher khusus", tolak({ khususUid: ["u2"] }, kursus())?.includes("akun Anda") === true, "khususUid");
  check("akun yang terdaftar diterima", tolak({ khususUid: ["u1"] }, kursus()) === null, "khususUid u1");
  check("cakupan salah: kursus", tolak({ semuaKursus: false, premium: true }, kursus())?.includes("kursus ini") === true, "kursus");
  check("cakupan salah: Premium", tolak({}, premium())?.includes("Premium") === true, "premium");
  check("minimal pembelian", tolak({ minHarga: 150_000 }, kursus())?.includes("minimal Rp150.000") === true, String(tolak({ minHarga: 150_000 }, kursus())));
  check("pembelian pertama: sudah pernah beli ditolak", tolak({ pembelianPertama: true }, kursus(), { pernahBeli: true })?.includes("pertama") === true, "pernahBeli");
  check("pembelian pertama: belum pernah = boleh", tolak({ pembelianPertama: true }, kursus()) === null, "belum");
  check("kuota: pakaiTotal (termasuk pesanan tertunda) menahan", tolak({ kuota: 5 }, kursus(), { pakaiTotal: 5 })?.includes("Kuota") === true, "kuota");
  check("kuota: masih tersisa satu = boleh", tolak({ kuota: 5 }, kursus(), { pakaiTotal: 4 }) === null, "4/5");
  check("per akun: sekali pakai", tolak({}, kursus(), { pakaiAkun: 1 }) === "Anda sudah memakai voucher ini.", String(tolak({}, kursus(), { pakaiAkun: 1 })));
  check("per akun: batas 3", tolak({ batasPerAkun: 3 }, kursus(), { pakaiAkun: 2 }) === null && tolak({ batasPerAkun: 3 }, kursus(), { pakaiAkun: 3 })?.includes("3 kali") === true, "batas 3");
  check("tanpa potongan nyata ditolak", tolak({ jenis: "nominal", nilai: 100 }, kursus("x", "y", 800)) !== null, "800");
  check("voucher yang dipakai habis oleh 'dipakai' saja ikut ditahan (kuota)", tolak({ kuota: 2, dipakai: 2 }, kursus(), { pakaiTotal: 2 })?.includes("Kuota") === true, "dipakai");
}

// ── Kode ────────────────────────────────────────────────────────────────
{
  check("normalisasi: huruf besar, tanpa spasi", normalisasiKode("  hemat 20 ") === "HEMAT20", normalisasiKode("  hemat 20 "));
  check("kode sah", kodeSah("MERDEKA-17") && kodeSah("A_B1"), "MERDEKA-17");
  check("kode terlalu pendek / tanda baca di ujung ditolak", !kodeSah("AB1") && !kodeSah("-ABCD") && !kodeSah("ABCD_"), "AB1 / -ABCD");
  check("kode huruf kecil (belum dinormalkan) ditolak", !kodeSah("hemat20"), "hemat20");
  check("kode berbahaya untuk ID dokumen ditolak", !kodeSah("A/B/C/D") && !kodeSah("..AB"), "A/B");
  const acak = new Set(Array.from({ length: 200 }, () => buatKodeAcak()));
  check("kode acak sah & tidak berulang", [...acak].every(kodeSah) && acak.size === 200, [...acak].slice(0, 2).join(","));
  check("kode acak berawalan", buatKodeAcak("promo").startsWith("PROMO") && kodeSah(buatKodeAcak("promo")), buatKodeAcak("promo"));
}

// ── Validasi masukan admin ──────────────────────────────────────────────
{
  const dasar: MasukanVoucher = {
    code: "hemat20",
    note: "  promo  ",
    active: true,
    jenis: "persen",
    nilai: 20,
    maksPotongan: "",
    premium: false,
    semuaKursus: false,
    kursus: ["ai-dasar", "ai-dasar", " "],
    kategori: [],
    mulai: null,
    berakhir: "2026-12-01T00:00:00.000Z",
    kuota: "",
    batasPerAkun: 1,
    minHarga: "",
    khususEmail: ["Siswa@Contoh.com"],
    pembelianPertama: false,
  };
  const ok = validasiVoucher(dasar, NOW, true);
  check("masukan sah", ok.ok, ok.ok ? "" : ok.error);
  if (ok.ok) {
    check("kode dinormalkan", ok.data.code === "HEMAT20", ok.data.code);
    check("kursus ganda & kosong dibuang", ok.data.kursus.join() === "ai-dasar", ok.data.kursus.join());
    check("kolom kosong = null / 0", ok.data.kuota === null && ok.data.maksPotongan === null && ok.data.minHarga === 0, JSON.stringify(ok.data));
    check("email dinormalkan huruf kecil", ok.data.khususEmail[0] === "siswa@contoh.com", ok.data.khususEmail[0]);
    check("catatan dirapikan", ok.data.note === "promo", ok.data.note);
  }
  const salah = (x: Partial<MasukanVoucher>, baru = true) => {
    const r = validasiVoucher({ ...dasar, ...x }, NOW, baru);
    return r.ok ? null : r.error;
  };
  check("kode salah ditolak", salah({ code: "a" }) !== null, String(salah({ code: "a" })));
  check("persen 0 ditolak", salah({ nilai: 0 }) !== null, "0");
  check("persen 101 ditolak", salah({ nilai: 101 }) !== null, "101");
  check("persen pecahan ditolak", salah({ nilai: 12.5 }) !== null, "12.5");
  check("nilai teks ditolak", salah({ nilai: "20" }) !== null, "'20'");
  check("nominal besar boleh, persen tidak", salah({ jenis: "nominal", nilai: 250_000 }) === null && salah({ nilai: 250_000 }) !== null, "250000");
  check("jenis tak dikenal ditolak", salah({ jenis: "gratis" }) !== null, "gratis");
  check("tanpa cakupan ditolak", salah({ kursus: [] })?.includes("cakupan") === true, String(salah({ kursus: [] })));
  check("Premium saja = cakupan sah", salah({ kursus: [], premium: true }) === null, "premium");
  check("semua kursus mengosongkan daftar kursus", (() => { const r = validasiVoucher({ ...dasar, semuaKursus: true }, NOW, true); return r.ok && r.data.kursus.length === 0; })(), "semua");
  check("berakhir sebelum mulai ditolak", salah({ mulai: "2026-12-05T00:00:00.000Z" }) !== null, "urutan tanggal");
  check("berakhir sudah lewat ditolak saat MEMBUAT", salah({ berakhir: "2026-11-01T00:00:00.000Z" })?.includes("lewat") === true, "baru");
  check("berakhir sudah lewat BOLEH saat menyunting (menutup lebih awal)", salah({ berakhir: "2026-11-01T00:00:00.000Z" }, false) === null, "ubah");
  check("tanggal rusak ditolak", salah({ mulai: "kemarin" }) !== null, "kemarin");
  check("kuota 0 ditolak", salah({ kuota: 0 }) !== null, "0");
  check("batas per akun 0 ditolak", salah({ batasPerAkun: 0 }) !== null, "0");
  check("batas per akun kosong ditolak", salah({ batasPerAkun: "" }) !== null, "''");
  check("minimal harga negatif ditolak", salah({ minHarga: -1 }) !== null, "-1");
  check("email rusak ditolak + disebut", salah({ khususEmail: ["bukan-email"] })?.includes("bukan-email") === true, String(salah({ khususEmail: ["bukan-email"] })));
  check("maks potongan diabaikan untuk nominal", (() => { const r = validasiVoucher({ ...dasar, jenis: "nominal", nilai: 5_000, maksPotongan: 1 }, NOW, true); return r.ok && r.data.maksPotongan === null; })(), "nominal");
  check("masukan kosong ditolak tanpa melempar", !validasiVoucher({} as MasukanVoucher, NOW, true).ok, "{}");
}

// ── Normaliser baca ─────────────────────────────────────────────────────
{
  const rusak = parseVoucher({ active: true, jenis: "persen", nilai: 500, semuaKursus: true }, "RUSAK1");
  check("nilai persen rusak → nonaktif & potongan 0 (bukan 100%)", !rusak.active && rusak.nilai === 0 && hitungHarga(rusak, 100_000).potongan === 0, JSON.stringify({ a: rusak.active, n: rusak.nilai }));
  const lama = parseVoucher({}, "KOSONG1");
  check("dokumen kosong: bawaan aman", !lama.active && lama.batasPerAkun === 1 && lama.kuota === null && lama.khususUid.length === 0, JSON.stringify(lama));
  check("pesanan tanpa voucher = null", parseVoucherPesanan(undefined) === null && parseVoucherPesanan(null) === null, "null");
  check("potongan pesanan > harga ditolak", parseVoucherPesanan({ code: "HEMAT20", original: 1000, discount: 2000 }) === null, "rusak");
  const snap = parseVoucherPesanan({ code: "hemat20", original: 100_000, discount: 20_000 });
  check("potongan pesanan sah dibaca", snap?.code === "HEMAT20" && snap.discount === 20_000, JSON.stringify(snap));
  const pr = pratinjauDariPesanan({ amount: 80_000, voucher: snap });
  check("pratinjau dari pesanan", pr?.harga === 100_000 && pr.potongan === 20_000 && pr.akhir === 80_000, JSON.stringify(pr));
  check("pratinjau tanpa voucher = null", pratinjauDariPesanan({ amount: 1, voucher: null }) === null && pratinjauDariPesanan(null) === null, "null");
}

finish();
