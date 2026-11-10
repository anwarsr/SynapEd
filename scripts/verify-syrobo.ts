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
 *   7. menggosok dengan spons: menambah kebersihan, dibatasi per panggilan, berhenti di 100.
 */
import { getFirestore } from "firebase-admin/firestore";
import { check, finish } from "./checks";
import { initAdmin } from "./project";
import { beli, beliPakaian, beriMakan, bacaSyrobo, detak, gantiNama, gosok, klaim, mandikan, pasangPakaian, ukuranPakaian, SYROBO } from "../frontend/src/lib/syrobo/syroboCore";
import {
  AMBANG_LAPAR,
  DETAK_MAKS_DETIK,
  HADIAH,
  JAM_LAPAR_HABIS,
  PAKAIAN,
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
    const rusak = normalisasi({ poin: -5, kenyang: "x", baju: "sihir", kepala: "naga", punya: ["topi", "topi", "x"], ukuran: { kepala: 9999 }, stok: { roti: 9999 }, diklaim: [999, 1] }, t0);
    check("pakaian rusak dinormalkan (kosong, daftar milik bersih, ukuran dijepit)", rusak.kepala === null && rusak.punya.join() === "topi" && rusak.ukuran.kepala === 140 && rusak.ukuran.badan === 100, JSON.stringify([rusak.kepala, rusak.punya, rusak.ukuran]));
    const lama = normalisasi({ baju: "dasi" }, t0);
    check("data lama (satu baju) dipindah ke slot badan & dianggap dimiliki", lama.badan === "dasi" && lama.kepala === null && lama.punya.includes("dasi"), JSON.stringify([lama.kepala, lama.badan, lama.punya]));
    check("katalog: minimal 10 pakaian, keduanya ada slot kepala & badan", PAKAIAN.length >= 10 && PAKAIAN.some((p) => p.slot === "kepala") && PAKAIAN.some((p) => p.slot === "badan"), String(PAKAIAN.length));
    check("data rusak dinormalkan", rusak.poin === 0 && rusak.stok.roti === 20 && rusak.diklaim.join() === "1" && rusak.kenyang === 80, JSON.stringify(rusak.diklaim));

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
    check("hadiah masuk hari ini bisa diklaim", masuk.ok && masuk.robot.poin === 20, masuk.ok ? String(masuk.robot.poin) : masuk.error);
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
    check("poin tepat setelah dua klaim", skrg.poin === 20 + (HADIAH.find((h) => h.menit === 30)?.poin ?? 0), String(skrg.poin));

    // 4. beli / makan / mandi
    const mahal = await beli(db, uid, "pizza", t0);
    check("beli ditolak bila poin kurang", !mahal.ok, mahal.ok ? "lolos!" : mahal.error);
    const roti = await beli(db, uid, "roti", t0);
    check("beli roti: poin -10, stok +1", roti.ok && roti.robot.poin === skrg.poin - 10 && roti.robot.stok.roti === 2, roti.ok ? `${roti.robot.poin}/${roti.robot.stok.roti}` : roti.error);
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
  } finally {
    await ref.delete().catch(() => undefined);
  }
  finish();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
