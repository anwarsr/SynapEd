/**
 * Menguji logika tema kustom (murni, tanpa server): validasi palet, deteksi
 * latar terang/gelap, turunan variabel, kontras, dan keamanan CSS yang dihasilkan.
 *
 *   npx tsx scripts/verify-tema-kustom.ts
 */
import { check, finish } from "./checks";
import {
  NAMA_VARIABEL,
  PALET_BAWAAN,
  PALET_CONTOH,
  cssDari,
  hexSah,
  hitungTema,
  kontras,
  sahkanPalet,
} from "../frontend/src/lib/customTheme";

console.log("\nTema kustom (murni)\n");

check("hex sah hanya #RRGGBB", hexSah("#0b1a24") && hexSah("#FFFFFF") && !hexSah("#fff") && !hexSah("red") && !hexSah("#12345G") && !hexSah(null), "format");
const kotor = sahkanPalet({ latar: "url(javascript:alert(1))", kartu: "#12293A", teks: 5, aksen: "#2F6FED; background:red" });
check("palet kotor jatuh ke bawaan per warna", kotor.latar === PALET_BAWAAN.latar && kotor.teks === PALET_BAWAAN.teks && kotor.aksen === PALET_BAWAAN.aksen && kotor.kartu === "#12293A", JSON.stringify(kotor));
check("data bukan objek → palet bawaan", JSON.stringify(sahkanPalet("x")) === JSON.stringify(PALET_BAWAAN) && JSON.stringify(sahkanPalet(null)) === JSON.stringify(PALET_BAWAAN), "bawaan");

check("kontras hitam-putih ≈ 21", Math.abs(kontras("#000000", "#FFFFFF") - 21) < 0.01, kontras("#000000", "#FFFFFF").toFixed(2));
check("kontras simetris", Math.abs(kontras("#123456", "#FEDCBA") - kontras("#FEDCBA", "#123456")) < 1e-9, "a↔b");

const gelap = hitungTema(PALET_BAWAAN);
check("palet bawaan = latar gelap", !gelap.terang, "gelap");
check("latar gelap tak menyentuh --color-white", gelap.vars["--color-white"] === undefined, "tetap putih");
check("aksen bawaan dipertahankan sebagai isi tombol", gelap.vars["--color-blue-600"] === "#2F6FED", String(gelap.vars["--color-blue-600"]));

const terang = hitungTema({ latar: "#FAF6EE", kartu: "#EFE8D8", teks: "#2A2418", aksen: "#B45309" });
check("latar krem = tema terang", terang.terang, "terang");
check("tema terang membalik --color-white jadi Teks", terang.vars["--color-white"] === "#2A2418", String(terang.vars["--color-white"]));

check("semua variabel (kecuali white di gelap) terisi", NAMA_VARIABEL.every((n) => n === "--color-white" || gelap.vars[n]), "26 variabel");
check("nilai variabel hanya warna (tanpa ; { } url)", Object.values({ ...gelap.vars, ...terang.vars }).every((v) => /^(#[0-9A-F]{6}|rgb\(\d+ \d+ \d+ \/ [0-9.]+\))$/.test(v)), "bentuk aman");
check("cssDari tak menyisipkan pemisah liar", !cssDari(terang.vars).includes("}") && cssDari(terang.vars).split(";").length === Object.keys(terang.vars).length, "satu deklarasi per variabel");

const kuning = hitungTema({ ...PALET_BAWAAN, aksen: "#FFFF00" });
check("aksen terlalu terang digelapkan agar tulisan putih terbaca", kontras(kuning.vars["--color-blue-600"], "#FFFFFF") >= 3.2, kontras(kuning.vars["--color-blue-600"], "#FFFFFF").toFixed(2));
check("teks aksen di latar gelap lebih terang dari isinya", kontras(gelap.vars["--color-blue-700"], PALET_BAWAAN.latar) > 4.5, kontras(gelap.vars["--color-blue-700"], PALET_BAWAAN.latar).toFixed(2));
check("teks aksen di latar terang cukup kontras", kontras(terang.vars["--color-blue-700"], "#FAF6EE") > 4.5, kontras(terang.vars["--color-blue-700"], "#FAF6EE").toFixed(2));

check("palet tanpa masalah tak diberi peringatan", gelap.peringatan.length === 0 && terang.peringatan.length === 0, "bersih");
const buruk = hitungTema({ latar: "#222222", kartu: "#2A2A2A", teks: "#333333", aksen: "#252525" });
check("teks senada latar diberi peringatan kontras", buruk.peringatan.length >= 2, buruk.peringatan.join(" | "));

check("semua contoh palet menghasilkan tema tanpa peringatan", PALET_CONTOH.every((c) => hitungTema(c.palet).peringatan.length === 0), PALET_CONTOH.map((c) => c.nama).join(","));
check("contoh terang & gelap sama-sama ada", PALET_CONTOH.some((c) => hitungTema(c.palet).terang) && PALET_CONTOH.some((c) => !hitungTema(c.palet).terang), "keduanya");

finish();
