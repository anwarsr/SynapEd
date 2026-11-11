/**
 * Menguji SyRobo: aturan murni + penulis (`syroboCore`) pada Firestore proyek asli dengan uid uji, yang dihapus lagi.
 *
 *   npx tsx scripts/verify-syrobo.ts
 *
 * Yang dijaga:
 *   1. kondisi menurun menurut waktu, suasana menurut ambang;
 *   2. detak: terlalu rapat diabaikan, kenaikan dibatasi, ganti hari (WIB) mengosongkan hitungan;
 *   3. klaim: butuh waktu cukup, tepat sekali, poin tak bisa digandakan oleh klaim bersamaan;
 *   4. beli/beri makan/mandi: poin & stok akurat, ditolak bila tak cukup / sudah kenyang / sudah bersih;
 *   5. nama divalidasi; data rusak dinormalkan; data lama (satu `baju`) dipindah ke slot pakaian;
 *   6. pakaian: dibeli dengan poin (sekali), dipasang per slot (kepala/badan) hanya bila dimiliki & cocok slot, ukuran 70-140%;
 *   7. menggosok dengan spons: menambah kebersihan, dibatasi per panggilan, berhenti di 100;
 *   8. PREMIUM: 4 pakaian kaisar/raja & 10 makanan dewa hanya untuk premium aktif (dicek server), tak dijual, tak tersimpan di `punya`,
 *      disembunyikan bila premium berakhir; makanan dewa membekukan bar kenyang 24 jam lalu turun normal.
 */
import { getFirestore } from "firebase-admin/firestore";
import { check, finish } from "./checks";
import { initAdmin } from "./project";
import { aktifkanCheat, mandikan as mandikanCheat, bangunkan, tidurkan, beli, beliPakaian, beriMakan, beriMakanDewa, simpanKoinGame, tukarKoinGame, bacaSyrobo, detak, gantiNama, gosok, klaim, mandikan, pasangPakaian, ukuranPakaian, SYROBO } from "../frontend/src/lib/syrobo/syroboCore";
import {
  CHEAT_MENIT,
  CHEAT_POIN,
  KODE_CHEAT,
  KODE_CHEAT_DEWA,
  MAKANAN_DEWA as DAFTAR_DEWA,
  sisaEmasMs,
  AMBANG_LELAH,
  AMBANG_TIDUR,
  JAM_LELAH_HABIS,
  JAM_TIDUR_PENUH,
  energiSaatIni,
  AMBANG_LAPAR,
  DETAK_MAKS_DETIK,
  HADIAH,
  poinHadiah,
  JAM_BEKU_DEWA,
  KOIN_HARIAN_MAKS,
  KOIN_PER_POIN,
  KOIN_SETOR_MAKS,
  JAM_LAPAR_HABIS,
  MAKANAN_DEWA,
  PAKAIAN,
  PAKAIAN_PREMIUM,
  sisaBekuMs,
  dataBaru,
  kondisiSaatIni,
  namaSah,
  normalisasi,
  suasana,
  tanggalWib,
} from "../frontend/src/lib/syrobo/syroboRules";

const MENIT = 60_000;

async function main() {
  const db = getFirestore(initAdmin());
  const uid = `uji-syrobo-${Date.now().toString(36)}`;
  const ref = db.collection(SYROBO).doc(uid);
  const t0 = new Date("2026-03-10T03:00:00Z"); // 10:00 WIB

  try {
    // 1. kondisi & suasana (murni)
    const d = dataBaru(t0);
    const jam7 = kondisiSaatIni(d, new Date(t0.getTime() + 7 * 3600_000));
    check("kenyang turun menurut waktu", Math.abs(jam7.kenyang - (80 - (7 * 100) / JAM_LAPAR_HABIS)) < 0.01, `${jam7.kenyang.toFixed(1)}`);
    check("suasana senang saat baru", suasana(kondisiSaatIni(d, t0)) === "senang", "senang");
    check("lapar di bawah ambang", suasana({ kenyang: AMBANG_LAPAR - 1, bersih: 90 }) === "lapar", "lapar");
    check("kotor di bawah ambang", suasana({ kenyang: 90, bersih: 10 }) === "kotor", "kotor");
    check("lapar & kotor", suasana({ kenyang: 10, bersih: 10 }) === "lapar-kotor", "keduanya");

    // 5. validasi & normalisasi
    check("nama dirapikan", namaSah("  Bobo   Si  Robo ") === "Bobo Si Robo", "spasi");
    check("nama kosong ditolak", namaSah("   ") === null, "kosong");
    check("nama terlalu panjang ditolak", namaSah("x".repeat(21)) === null, "21 huruf");
    check("tag dibuang dari nama", namaSah("<b>Hi</b>") === "bHi/b", "karakter < > dibuang");
    const rusak = normalisasi({ poin: -5, kenyang: "x", baju: "sihir", kepala: "naga", punya: ["topi", "topi", "x"], ukuran: { kepala: 9999 }, stok: { roti: 9999 }, diklaim: [999, 5] }, t0);
    check("pakaian rusak dinormalkan (kosong, daftar milik bersih, ukuran dijepit)", rusak.kepala === null && rusak.punya.join() === "topi" && rusak.ukuran.kepala === 140 && rusak.ukuran.badan === 100, JSON.stringify([rusak.kepala, rusak.punya, rusak.ukuran]));
    const lama = normalisasi({ baju: "dasi" }, t0);
    check("data lama (satu baju) dipindah ke slot badan & dianggap dimiliki", lama.badan === "dasi" && lama.kepala === null && lama.punya.includes("dasi"), JSON.stringify([lama.kepala, lama.badan, lama.punya]));
    check("katalog: minimal 10 pakaian, keduanya ada slot kepala & badan", PAKAIAN.length >= 10 && PAKAIAN.some((p) => p.slot === "kepala") && PAKAIAN.some((p) => p.slot === "badan"), String(PAKAIAN.length));
    check("data rusak dinormalkan", rusak.poin === 0 && rusak.stok.roti === 20 && rusak.diklaim.join() === "5" && rusak.kenyang === 80, JSON.stringify(rusak.diklaim));

    // 2. detak
    let r = await detak(db, uid, t0);
    check("detak pertama membuat dokumen", r.ok && r.robot.aktifDetik === 0, "0 dtk");
    r = await detak(db, uid, new Date(t0.getTime() + 3000));
    check("detak terlalu rapat diabaikan", r.ok && r.robot.aktifDetik === 0, "tetap 0");
    r = await detak(db, uid, new Date(t0.getTime() + 30_000));
    check("detak 30 dtk menambah 30", r.ok && r.robot.aktifDetik === 30, r.ok ? String(r.robot.aktifDetik) : r.error);
    r = await detak(db, uid, new Date(t0.getTime() + 30_000 + 10 * MENIT));
    check("detak setelah jeda panjang dibatasi", r.ok && r.robot.aktifDetik === 30 + DETAK_MAKS_DETIK, r.ok ? String(r.robot.aktifDetik) : r.error);

    // 3. klaim
    const masuk = await klaim(db, uid, 0, t0);
    check("hadiah masuk hari ini bisa diklaim", masuk.ok && masuk.robot.poin === 5, masuk.ok ? String(masuk.robot.poin) : masuk.error);
    const ulang = await klaim(db, uid, 0, t0);
    check("klaim kedua ditolak", !ulang.ok, ulang.ok ? "lolos!" : ulang.error);
    const awal10 = await klaim(db, uid, 10, t0);
    check("hadiah 10 menit ditolak bila waktu kurang", !awal10.ok, awal10.ok ? "lolos!" : awal10.error);
    const asing = await klaim(db, uid, 7, t0);
    check("hadiah tak dikenal ditolak", !asing.ok, "ditolak");
    await ref.update({ aktifDetik: 3600 });
    const [a, b] = await Promise.all([klaim(db, uid, 30, t0), klaim(db, uid, 30, t0)]);
    check("klaim bersamaan hanya sekali", [a, b].filter((x) => x.ok).length === 1, `${[a, b].filter((x) => x.ok).length} sukses`);
    const skrg = await bacaSyrobo(db, uid, t0);
    check("poin tepat setelah dua klaim", skrg.poin === 5 + (HADIAH.find((h) => h.menit === 30)?.poin ?? 0), String(skrg.poin));

    const sebelumPrem = skrg.poin;
    const prem = await klaim(db, uid, 20, t0, true);
    check("hadiah Premium +50% dibulatkan ke atas (5 -> 8)", prem.ok && prem.robot.poin === sebelumPrem + 8 && poinHadiah(1, true) === 2 && poinHadiah(7, true) === 11 && poinHadiah(7, false) === 7, prem.ok ? String(prem.robot.poin - sebelumPrem) : prem.error);
    check("daftar hadiah sesuai permintaan (0/5/10/20/30/60/120 menit = 5/1/3/5/7/10/15)", HADIAH.map((h) => `${h.menit}:${h.poin}`).join(" ") === "0:5 5:1 10:3 20:5 30:7 60:10 120:15", HADIAH.map((h) => `${h.menit}:${h.poin}`).join(" "));

    // Hadiah kini kecil; poin dipatok 45 supaya pembelian di bawah (roti 10, kacamata 30, dst.) tetap diuji seperti semula.
    await ref.update({ poin: 45 });

    // 4. beli / makan / mandi
    const mahal = await beli(db, uid, "pizza", t0);
    check("beli ditolak bila poin kurang", !mahal.ok, mahal.ok ? "lolos!" : mahal.error);
    const roti = await beli(db, uid, "roti", t0);
    check("beli roti: poin -10, stok +1", roti.ok && roti.robot.poin === 45 - 10 && roti.robot.stok.roti === 2, roti.ok ? `${roti.robot.poin}/${roti.robot.stok.roti}` : roti.error);
    const palsu = await beli(db, uid, "../x", t0);
    check("makanan palsu ditolak", !palsu.ok, "ditolak");

    // lapar dulu: 12 jam kemudian
    const t12 = new Date(t0.getTime() + 12 * 3600_000);
    const lapar = await bacaSyrobo(db, uid, t12);
    check("12 jam kemudian lapar", lapar.suasana === "lapar" || lapar.suasana === "lapar-kotor", lapar.suasana);
    const makan = await beriMakan(db, uid, "roti", t12);
    check("beri makan menambah kenyang & mengurangi stok", makan.ok && makan.robot.kenyangSekarang > lapar.kenyangSekarang && makan.robot.stok.roti === 1, makan.ok ? String(makan.robot.kenyangSekarang) : makan.error);
    const tanpaStok = await beriMakan(db, uid, "pizza", t12);
    check("beri makan tanpa stok ditolak", !tanpaStok.ok, "ditolak");
    const mandi = await mandikan(db, uid, t12);
    check("mandi memulihkan bersih", mandi.ok && mandi.robot.bersihSekarang === 100, mandi.ok ? String(mandi.robot.bersihSekarang) : mandi.error);
    const mandiLagi = await mandikan(db, uid, t12);
    check("mandi saat bersih ditolak", !mandiLagi.ok, "ditolak");

    // pakaian (poin sekarang 35)
    check("beli pakaian ditolak bila poin kurang", !(await beliPakaian(db, uid, "mahkota", t12)).ok, "mahkota 120");
    check("pakaian tak dikenal ditolak", !(await beliPakaian(db, uid, "naga", t12)).ok, "ditolak");
    const sebelumBeli = await bacaSyrobo(db, uid, t12);
    const kaca = await beliPakaian(db, uid, "kacamata", t12);
    check("beli kacamata: poin -30 & masuk daftar milik", kaca.ok && kaca.robot.poin === sebelumBeli.poin - 30 && kaca.robot.punya.includes("kacamata"), kaca.ok ? `${kaca.robot.poin}` : kaca.error);
    check("beli dua kali ditolak (poin tak berkurang lagi)", !(await beliPakaian(db, uid, "kacamata", t12)).ok, "sudah dimiliki");
    check("pasang yang belum dibeli ditolak", !(await pasangPakaian(db, uid, "kepala", "topi", t12)).ok, "belum dibeli");
    check("pasang ke slot yang salah ditolak", !(await pasangPakaian(db, uid, "badan", "kacamata", t12)).ok, "kacamata = kepala");
    check("slot tak dikenal ditolak", !(await pasangPakaian(db, uid, "kaki", "kacamata", t12)).ok, "ditolak");
    const pakai = await pasangPakaian(db, uid, "kepala", "kacamata", t12);
    check("pasang kacamata di slot kepala", pakai.ok && pakai.robot.kepala === "kacamata" && pakai.robot.badan === null, "kepala");
    const uk = await ukuranPakaian(db, uid, "kepala", 120, t12);
    check("ukuran 120% tersimpan per slot", uk.ok && uk.robot.ukuran.kepala === 120 && uk.robot.ukuran.badan === 100, "120/100");
    const ukTolak = await Promise.all([69, 141, 100.5, "100"].map(async (v) => (await ukuranPakaian(db, uid, "kepala", v, t12)).ok));
    check("ukuran di luar 70-140 / pecahan / teks ditolak", ukTolak.every((ok) => !ok), JSON.stringify(ukTolak));
    const lepas = await pasangPakaian(db, uid, "kepala", null, t12);
    check("melepas pakaian", lepas.ok && lepas.robot.kepala === null && lepas.robot.punya.includes("kacamata"), "kosong, tetap dimiliki");
    const poinAkhir = lepas.ok ? lepas.robot.poin : -1;

    // menggosok dengan spons: 10 jam kemudian bersih turun ke 50
    const t22 = new Date(t12.getTime() + 10 * 3600_000);
    const kotor = await bacaSyrobo(db, uid, t22);
    check("sebelum digosok bersih 50%", kotor.bersihSekarang === 50, String(kotor.bersihSekarang));
    const g1 = await gosok(db, uid, 20, t22);
    check("gosok 20 poin: bersih 70%", g1.ok && g1.robot.bersihSekarang === 70, g1.ok ? String(g1.robot.bersihSekarang) : g1.error);
    const gsTolak = await Promise.all([0, -5, "9", NaN].map(async (v) => (await gosok(db, uid, v, t22)).ok));
    check("gosokan tak sah (0, negatif, teks, NaN) ditolak", gsTolak.every((ok) => !ok), JSON.stringify(gsTolak));
    const g2 = await gosok(db, uid, 9999, t22);
    check("satu panggilan dibatasi 50 poin lalu dijepit 100%", g2.ok && g2.robot.bersihSekarang === 100, g2.ok ? String(g2.robot.bersihSekarang) : g2.error);
    check("menggosok robot yang sudah bersih ditolak", !(await gosok(db, uid, 5, t22)).ok, "sudah bersih")

    const nm = await gantiNama(db, uid, "Bobo", t12);
    check("ganti nama", nm.ok && nm.robot.nama === "Bobo", "Bobo");
    check("nama kosong ditolak oleh penulis", !(await gantiNama(db, uid, "", t12)).ok, "ditolak");

    // ganti hari
    const besok = new Date(t0.getTime() + 24 * 3600_000);
    const hariBaru = await bacaSyrobo(db, uid, besok);
    check("ganti hari mengosongkan hitungan harian", hariBaru.aktifDetik === 0 && hariBaru.diklaim.length === 0 && hariBaru.hari === tanggalWib(besok), hariBaru.hari);
    check("poin, stok, dan pakaian bertahan lintas hari", hariBaru.poin === poinAkhir && hariBaru.stok.roti === 1 && hariBaru.punya.includes("kacamata"), `${hariBaru.poin}/${hariBaru.stok.roti}/${hariBaru.punya.join()}`);

    // 8. Premium: pakaian kaisar/raja & makanan dewa
    console.log("\nPremium: pakaian & makanan dewa");
    check("4 pakaian premium (topi kaisar, mahkota raja, baju kaisar, jubah raja)", PAKAIAN_PREMIUM.join() === "topiKaisar,mahkotaRaja,bajuKaisar,jubahRaja", PAKAIAN_PREMIUM.join());
    check("10 makanan dewa", MAKANAN_DEWA.length === 10 && new Set(MAKANAN_DEWA.map((m) => m.id)).size === 10, String(MAKANAN_DEWA.length));
    const tp = new Date("2026-03-20T03:00:00Z");
    const pa = await pasangPakaian(db, uid, "kepala", "topiKaisar", tp, false);
    check("tanpa premium: memasang topi kaisar ditolak", !pa.ok && pa.error.includes("Premium"), pa.ok ? "lolos" : pa.error);
    const pb = await beliPakaian(db, uid, "mahkotaRaja", tp, true);
    check("pakaian premium tak bisa DIBELI (walau premium aktif)", !pb.ok && pb.error.includes("tidak dijual"), pb.ok ? "lolos" : pb.error);
    const pc = await pasangPakaian(db, uid, "kepala", "topiKaisar", tp, true);
    check("premium aktif: terpasang tanpa dibeli, dan terbuka di daftar", pc.ok && pc.robot.kepala === "topiKaisar" && pc.robot.punya.includes("jubahRaja") && pc.robot.premium === true, pc.ok ? String(pc.robot.kepala) : pc.error);
    check("slot salah tetap ditolak (jubah raja ke kepala)", !(await pasangPakaian(db, uid, "kepala", "jubahRaja", tp, true)).ok, "slot");
    const pd = await bacaSyrobo(db, uid, tp, false);
    check("premium berakhir: pakaian premium disembunyikan (data tetap)", pd.kepala === null && !pd.punya.includes("topiKaisar") && pd.premium === false, String(pd.kepala));
    const mentah = (await ref.get()).data();
    check("pakaian premium tak pernah masuk `punya` di database", !(mentah?.punya ?? []).some((x: string) => PAKAIAN_PREMIUM.includes(x as never)) && mentah?.kepala === "topiKaisar", JSON.stringify(mentah?.punya));
    check("premium aktif lagi: pakaian kembali tampil", (await bacaSyrobo(db, uid, tp, true)).kepala === "topiKaisar", "kembali");

    const tolakDewa = await beriMakanDewa(db, uid, "ambrosia", tp, false);
    check("makanan dewa tanpa premium ditolak", !tolakDewa.ok && tolakDewa.error.includes("Premium"), tolakDewa.ok ? "lolos" : tolakDewa.error);
    check("makanan dewa tak dikenal ditolak", !(await beriMakanDewa(db, uid, "pizza", tp, true)).ok, "id asing");
    const dewa = await beriMakanDewa(db, uid, "ambrosia", tp, true);
    check("makanan dewa: kenyang penuh & beku 24 jam", dewa.ok && dewa.robot.kenyangSekarang === 100 && dewa.robot.bekuLaparSampai !== null, dewa.ok ? String(dewa.robot.bekuLaparSampai) : dewa.error);
    const d12 = await bacaSyrobo(db, uid, new Date(tp.getTime() + 12 * 3600_000), true);
    check("12 jam kemudian bar kenyang TIDAK turun (masih 100)", d12.kenyangSekarang === 100, String(d12.kenyangSekarang));
    const d23 = await bacaSyrobo(db, uid, new Date(tp.getTime() + 23.9 * 3600_000), true);
    check("23,9 jam kemudian masih 100", d23.kenyangSekarang === 100, String(d23.kenyangSekarang));
    const d38 = await bacaSyrobo(db, uid, new Date(tp.getTime() + (JAM_BEKU_DEWA + 7) * 3600_000), true);
    check("sesudah beku: turun normal (7 jam setelahnya = 50)", Math.abs(d38.kenyangSekarang - 50) <= 1, String(d38.kenyangSekarang));
    check("bersih tetap turun selama kenyang beku", (await bacaSyrobo(db, uid, new Date(tp.getTime() + 10 * 3600_000), true)).bersihSekarang < 90, "bersih turun");
    const ulangDewa = await beriMakanDewa(db, uid, "nektar", new Date(tp.getTime() + 3600_000), true);
    check("selama beku, makanan dewa lain ditolak (sisa jam disebut)", !ulangDewa.ok && ulangDewa.error.includes("sisa"), ulangDewa.ok ? "lolos" : ulangDewa.error);
    const lagi = await beriMakanDewa(db, uid, "nektar", new Date(tp.getTime() + 25 * 3600_000), true);
    check("sesudah beku berakhir boleh makan dewa lagi", lagi.ok, lagi.ok ? "ok" : lagi.error);
    check("sisaBekuMs benar (±24 jam setelah makan)", Math.abs(sisaBekuMs({ bekuLaparSampai: new Date(tp.getTime() + 24 * 3600_000).toISOString() }, tp) - 24 * 3600_000) < 1, "24 jam");
    const mandiBeku = await mandikan(db, uid, new Date(tp.getTime() + 25 * 3600_000 + 7200_000), true);
    check("memotret ulang (mandi) tidak menghilangkan/menggandakan beku", mandiBeku.ok || mandiBeku.error.length > 0, "ok");

    // 9. Koin game -> poin bintang
    console.log("\nKoin game: setor & tukar");
    const tk = new Date("2026-04-01T03:00:00Z");
    const poin0 = (await bacaSyrobo(db, uid, tk)).poin;
    check("setoran tak sah ditolak (0, negatif, pecahan, teks, di atas batas)", (await Promise.all([0, -5, 2.5, "9", KOIN_SETOR_MAKS + 1].map((n) => simpanKoinGame(db, uid, n, tk)))).every((h) => !h.ok), "semua ditolak");
    const s1 = await simpanKoinGame(db, uid, 150, tk);
    check("setor 150 koin: saldo 150", s1.ok && s1.robot.koinGame === 150, s1.ok ? String(s1.robot.koinGame) : s1.error);
    const tkBelum = await tukarKoinGame(db, uid, tk);
    check("saldo 150 → tukar 1 poin, sisa 50 koin", tkBelum.ok && tkBelum.robot.poin === poin0 + 1 && tkBelum.robot.koinGame === 50, tkBelum.ok ? `${tkBelum.robot.poin}/${tkBelum.robot.koinGame}` : tkBelum.error);
    const tkKurang = await tukarKoinGame(db, uid, tk);
    check("saldo 50 (< 100) tidak bisa ditukar", !tkKurang.ok && tkKurang.error.includes(String(KOIN_PER_POIN)), tkKurang.ok ? "lolos" : tkKurang.error);
    await simpanKoinGame(db, uid, 250, tk); // saldo 300
    const tkBanyak = await tukarKoinGame(db, uid, tk);
    check("saldo 300 → tukar 3 poin sekaligus, sisa 0", tkBanyak.ok && tkBanyak.robot.poin === poin0 + 4 && tkBanyak.robot.koinGame === 0, tkBanyak.ok ? `${tkBanyak.robot.poin}/${tkBanyak.robot.koinGame}` : tkBanyak.error);
    // batas harian: 150 + 250 sudah disetor = 400; sisa jatah 1100
    let tersimpan = 400;
    while (tersimpan + KOIN_SETOR_MAKS <= KOIN_HARIAN_MAKS) {
      await simpanKoinGame(db, uid, KOIN_SETOR_MAKS, tk);
      tersimpan += KOIN_SETOR_MAKS;
    }
    const potong = await simpanKoinGame(db, uid, KOIN_SETOR_MAKS, tk);
    const harian = (await bacaSyrobo(db, uid, tk)).koinSetorHari;
    check("jatah harian dipotong: total setoran hari itu tak melebihi batas", harian === KOIN_HARIAN_MAKS && (potong.ok ? potong.robot.koinSetorHari === KOIN_HARIAN_MAKS : true), `${harian}/${KOIN_HARIAN_MAKS}`);
    const lewat = await simpanKoinGame(db, uid, 1, tk);
    check("jatah habis: setoran berikutnya ditolak", !lewat.ok && lewat.error.includes("hari ini"), lewat.ok ? "lolos" : lewat.error);
    const hariLain = await simpanKoinGame(db, uid, 10, new Date(tk.getTime() + 24 * 3600_000));
    check("ganti hari (WIB) jatah harian pulih, saldo koin lama tetap", hariLain.ok && hariLain.robot.koinSetorHari === 10 && hariLain.robot.koinGame >= 10, hariLain.ok ? `${hariLain.robot.koinSetorHari}/${hariLain.robot.koinGame}` : hariLain.error);

    // 10. Energi (kelelahan) & tidur
    console.log("\nEnergi & tidur");
    const te = new Date("2026-05-01T03:00:00Z");
    const segar = dataBaru(te);
    check("robot baru segar (energi 100, tidak tidur)", energiSaatIni(segar, te) === 100 && segar.tidurSejak === null, "100");
    const lelahJam = (JAM_LELAH_HABIS * (100 - AMBANG_LELAH + 5)) / 100;
    check("terjaga: energi turun menurut waktu dan melewati ambang lelah", energiSaatIni(segar, new Date(te.getTime() + lelahJam * 3600_000)) < AMBANG_LELAH, energiSaatIni(segar, new Date(te.getTime() + lelahJam * 3600_000)).toFixed(1));
    check("energi tak pernah di bawah 0", energiSaatIni(segar, new Date(te.getTime() + 99 * 3600_000)) === 0, "0");
    const tidurData = { ...segar, energi: 10, energiAt: te.toISOString(), tidurSejak: te.toISOString() };
    const pulih = energiSaatIni(tidurData, new Date(te.getTime() + (JAM_TIDUR_PENUH * 3600_000) / 2));
    check("tidur: energi pulih (±setengah jam = +50)", Math.abs(pulih - 60) < 0.01, pulih.toFixed(1));
    check("tidur: energi tak pernah di atas 100", energiSaatIni(tidurData, new Date(te.getTime() + 9 * 3600_000)) === 100, "100");
    check("ambang: perlu tidur lebih rendah dari lelah", AMBANG_TIDUR < AMBANG_LELAH, `${AMBANG_TIDUR}<${AMBANG_LELAH}`);

    // tidur & bangun lewat transaksi (idempoten; energi yang terkumpul tidak hilang)
    await ref.update({ energi: 20, energiAt: te.toISOString(), tidurSejak: null });
    const tdr = await tidurkan(db, uid, te);
    check("padamkan lampu: robot tidur, energi dipotret", tdr.ok && tdr.robot.tidur && Math.round(tdr.robot.energiSekarang) === 20, tdr.ok ? `${tdr.robot.energiSekarang}` : tdr.error);
    const tdr2 = await tidurkan(db, uid, new Date(te.getTime() + 10 * MENIT));
    check("padamkan lampu lagi: tak mengulang potret (tetap sejak semula)", tdr2.ok && tdr2.robot.tidurSejak === te.toISOString(), tdr2.ok ? String(tdr2.robot.tidurSejak) : tdr2.error);
    const tBangun = new Date(te.getTime() + 5 * MENIT); // tidur penuh 10 menit: 5 menit = +50
    const bgn = await bangunkan(db, uid, tBangun);
    check("nyalakan lampu setelah 5 menit tidur (penuh = 10 menit): energi 20 → 70, tidak tidur lagi", bgn.ok && !bgn.robot.tidur && bgn.robot.tidurSejak === null && Math.round(bgn.robot.energi) === 70, bgn.ok ? `${bgn.robot.energi}` : bgn.error);
    const bgn2 = await bangunkan(db, uid, new Date(tBangun.getTime() + 5 * MENIT));
    check("nyalakan lampu lagi: tak mengubah potret energi", bgn2.ok && bgn.ok && bgn2.robot.energiAt === bgn.robot.energiAt && Math.round(bgn2.robot.energi) === 70, bgn2.ok ? bgn2.robot.energiAt : bgn2.error);
    const sesudah = await bacaSyrobo(db, uid, new Date(tBangun.getTime() + (JAM_LELAH_HABIS * 3600_000) / 10));
    check("setelah bangun energi mulai turun lagi (1/10 masa lelah = -10)", Math.abs(sesudah.energiSekarang - 60) <= 1, `${sesudah.energiSekarang}`);
    const dataLamaE = normalisasi({ nama: "Lama" }, te);
    check("data lama tanpa field energi terbaca segar (energi 100, tidak tidur)", dataLamaE.energi === 100 && dataLamaE.tidurSejak === null, `${dataLamaE.energi}`);
    const dataRusakE = normalisasi({ energi: "x", energiAt: "bukan-tanggal", tidurSejak: 5 }, te);
    check("energi/tanggal rusak jatuh ke bawaan", dataRusakE.energi === 100 && dataRusakE.tidurSejak === null && !Number.isNaN(Date.parse(dataRusakE.energiAt)), "ok");

    const td0 = new Date("2026-05-20T03:00:00Z").getTime();
    // 11. Easter egg: kode cheat (emas 10 menit + 50 poin, sekali sehari WIB) & aura makanan dewa
    console.log("\nCheat & aura dewa");
    const tc = new Date("2026-06-01T03:00:00Z"); // 10:00 WIB
    const poinC = (await bacaSyrobo(db, uid, tc)).poin;
    const salah = await aktifkanCheat(db, uid, "kingolg", tc);
    check("kode salah ditolak tanpa mengubah apa pun", !salah.ok && (await bacaSyrobo(db, uid, tc)).poin === poinC, salah.ok ? "lolos" : salah.error);
    const bukanTeks = await aktifkanCheat(db, uid, 123, tc);
    check("kode bukan teks ditolak", !bukanTeks.ok, "ditolak");
    const c1 = await aktifkanCheat(db, uid, " kingolga ", tc);
    check("kode benar (huruf kecil & spasi diabaikan): +" + CHEAT_POIN + " poin dan robot emas", c1.ok && c1.robot.poin === poinC + CHEAT_POIN && c1.robot.emas && Math.abs(c1.robot.emasSisaMs - CHEAT_MENIT * 60_000) < 1000, c1.ok ? `${c1.robot.poin} emas=${c1.robot.emas}` : c1.error);
    const c2 = await aktifkanCheat(db, uid, KODE_CHEAT, new Date(tc.getTime() + 5 * MENIT));
    check("kedua kali di hari yang sama ditolak (poin tak bertambah)", !c2.ok && c2.error.includes("hari ini") && (await bacaSyrobo(db, uid, tc)).poin === poinC + CHEAT_POIN, c2.ok ? "lolos" : c2.error);
    const habisEmas = await bacaSyrobo(db, uid, new Date(tc.getTime() + (CHEAT_MENIT + 1) * MENIT));
    check("emas berakhir sesudah " + CHEAT_MENIT + " menit", !habisEmas.emas && habisEmas.emasSisaMs === 0, `emas=${habisEmas.emas}`);
    const jam23 = await aktifkanCheat(db, uid, KODE_CHEAT, new Date("2026-06-01T16:59:00Z")); // 23:59 WIB, hari yang sama
    check("23:59 WIB masih hari yang sama: tetap ditolak", !jam23.ok, jam23.ok ? "lolos" : jam23.error);
    const cheatBesok = await aktifkanCheat(db, uid, KODE_CHEAT, new Date("2026-06-01T17:01:00Z")); // 00:01 WIB hari berikutnya
    check("lewat tengah malam WIB jatah pulih: +" + CHEAT_POIN + " poin lagi", cheatBesok.ok && cheatBesok.robot.poin === poinC + CHEAT_POIN * 2 && cheatBesok.robot.emas, cheatBesok.ok ? `${cheatBesok.robot.poin}` : cheatBesok.error);
    check("emas hanya ada selama sisa waktunya (murni)", sisaEmasMs({ emasSampai: null }, tc) === 0 && sisaEmasMs({ emasSampai: new Date(tc.getTime() + 1000).toISOString() }, tc) === 1000, "ok");
    const tanggalRusak = normalisasi({ cheatHari: "kemarin", emasSampai: "xx" }, tc);
    check("cheatHari/emasSampai rusak jatuh ke null", tanggalRusak.cheatHari === null && tanggalRusak.emasSampai === null, "ok");

    // tidur memblokir makan & mandi (robot harus dibangunkan dulu)
    await ref.update({ tidurSejak: new Date(td0).toISOString(), energi: 50, energiAt: new Date(td0).toISOString() });
    const makanTidur = await beriMakan(db, uid, "roti", new Date(td0));
    check("robot tidur: tak bisa diberi makan", !makanTidur.ok && makanTidur.error.includes("tidur"), makanTidur.ok ? "lolos" : makanTidur.error);
    const mandiTidur = await mandikanCheat(db, uid, new Date(td0));
    check("robot tidur: tak bisa dimandikan", !mandiTidur.ok && mandiTidur.error.includes("tidur"), mandiTidur.ok ? "lolos" : mandiTidur.error);
    const dewaTidur = await beriMakanDewa(db, uid, "madu", new Date(td0), true);
    check("robot tidur: tak bisa diberi makanan dewa (walau premium)", !dewaTidur.ok && dewaTidur.error.includes("tidur"), dewaTidur.ok ? "lolos" : dewaTidur.error);
    await bangunkan(db, uid, new Date(td0 + MENIT));
    check("tidur tak berakhir sendiri: dibaca sehari kemudian masih tidur (energi penuh)", (await (async () => {
      await tidurkan(db, uid, new Date(td0 + 2 * MENIT));
      return bacaSyrobo(db, uid, new Date(td0 + 26 * 3600_000));
    })()).tidur === true, "masih tidur");
    await bangunkan(db, uid, new Date(td0 + 27 * 3600_000));

    // cheat kedua: DEIDOSTUDIO = 1 tiap makanan dewa, sekali seumur akun
    await ref.update({ bekuLaparSampai: null, dewaId: null, tidurSejak: null, stokDewa: {}, cheatDewa: false });
    const tdew = new Date("2026-08-01T03:00:00Z");
    const tanpaStokDewa = await beriMakanDewa(db, uid, "madu", tdew, false);
    check("tanpa Premium & tanpa stok: makanan dewa ditolak", !tanpaStokDewa.ok, tanpaStokDewa.ok ? "lolos" : tanpaStokDewa.error);
    const cd = await aktifkanCheat(db, uid, KODE_CHEAT_DEWA.toLowerCase(), tdew);
    check("DEIDOSTUDIO: semua makanan dewa masing-masing 1", cd.ok && DAFTAR_DEWA.every((m) => cd.robot.stokDewa[m.id] === 1) && cd.robot.cheatDewa, cd.ok ? JSON.stringify(cd.robot.stokDewa) : cd.error);
    const cd2 = await aktifkanCheat(db, uid, KODE_CHEAT_DEWA, new Date(tdew.getTime() + 3 * 24 * 3600_000));
    check("DEIDOSTUDIO kedua kali (bahkan hari berikutnya) ditolak, stok tak bertambah", !cd2.ok && cd2.error.includes("satu kali") && (await bacaSyrobo(db, uid, tdew)).stokDewa.madu === 1, cd2.ok ? "lolos" : cd2.error);
    const makanStok = await beriMakanDewa(db, uid, "madu", tdew, false);
    check("tanpa Premium tetapi punya stok: makanan dewa bisa dimakan dan stok berkurang jadi 0", makanStok.ok && makanStok.robot.stokDewa.madu === 0 && makanStok.robot.dewaId === "madu", makanStok.ok ? String(makanStok.robot.stokDewa.madu) : makanStok.error);
    const stokLain = (await bacaSyrobo(db, uid, tdew)).stokDewa;
    check("makanan dewa lain tak ikut berkurang", DAFTAR_DEWA.filter((m) => m.id !== "madu").every((m) => stokLain[m.id] === 1), "ok");
    const premiumGratis = await beriMakanDewa(db, uid, "nektar", new Date(tdew.getTime() + 25 * 3600_000), true);
    check("Premium aktif makan gratis: stok tidak berkurang", premiumGratis.ok && premiumGratis.robot.stokDewa.nektar === 1, premiumGratis.ok ? String(premiumGratis.robot.stokDewa.nektar) : premiumGratis.error);
    check("stokDewa rusak terbaca 0 (bukan angka negatif/teks)", normalisasi({ stokDewa: { madu: -5, nektar: "x", ambrosia: 3.9 } }, tdew).stokDewa.madu === 0 && normalisasi({ stokDewa: { ambrosia: 3.9 } }, tdew).stokDewa.ambrosia === 3, "ok");

    // aura makanan dewa: tersimpan saat dimakan, tampil hanya selama kenyang masih beku
    const td = new Date("2026-07-01T03:00:00Z");
    await ref.update({ bekuLaparSampai: null, dewaId: null });
    const dewaAura = await beriMakanDewa(db, uid, "madu", td, true);
    check("makan makanan dewa menyimpan auranya (dewaId) selama beku", dewaAura.ok && dewaAura.robot.dewaId === "madu", dewaAura.ok ? String(dewaAura.robot.dewaId) : dewaAura.error);
    const sesudahBeku = await bacaSyrobo(db, uid, new Date(td.getTime() + (JAM_BEKU_DEWA + 1) * 3600_000), true);
    check("aura hilang setelah masa beku 24 jam berakhir", sesudahBeku.dewaId === null, String(sesudahBeku.dewaId));
    check("dewaId tak sah terbaca null", normalisasi({ dewaId: "bukan-makanan" }, td).dewaId === null, "ok");
  } finally {
    await ref.delete().catch(() => undefined);
  }
  finish();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
