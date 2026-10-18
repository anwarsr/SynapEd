/**
 * Pemeriksaan murni Roda Pemilih (lib/wheel.ts): tanpa server, tanpa Firestore.
 *
 *   npx tsx scripts/verify-wheel.ts
 */
import { check, finish } from "./checks";
import {
  PALET,
  WHEEL_MAX_ITEM,
  WHEEL_MAX_RODA,
  acakIndeks,
  bersihkanRoda,
  indeksDiPenunjuk,
  sudutTujuan,
  tambahItem,
  warnaRoda,
  warnaTeks,
} from "../frontend/src/lib/wheel";

// 1. Sudut tujuan SELALU mendarat di irisan yang diundi, dari sudut awal & jitter apa pun.
let salah = 0;
let total = 0;
for (let n = 2; n <= WHEEL_MAX_ITEM; n++) {
  for (let i = 0; i < n; i++) {
    for (const awal of [0, 37.5, -120, 359.9, 1234.5, 7777]) {
      for (const jitter of [-0.39, -0.2, 0, 0.2, 0.39]) {
        const akhir = sudutTujuan(awal, i, n, 5, jitter);
        total++;
        if (indeksDiPenunjuk(akhir, n) !== i) salah++;
        if (akhir < awal + 5 * 360 - 1e-6) salah++; // minimal 5 putaran penuh ke depan
      }
    }
  }
}
check("roda berhenti tepat di irisan yang diundi", salah === 0, `${salah} salah dari ${total} kasus`);

// 2. Undian seragam: hanya indeks sah, dan tiap indeks terpilih bila sumber acaknya merata.
let luar = 0;
const hitung = new Array(7).fill(0);
for (let x = 0; x < 7000; x++) {
  const r = acakIndeks(7, () => (x * 613566757 + 12345) >>> 0);
  if (r < 0 || r > 6) luar++;
  else hitung[r]++;
}
check("acakIndeks selalu di dalam rentang", luar === 0, `${luar} di luar rentang`);
check("acakIndeks menjangkau semua indeks", hitung.every((c) => c > 0), hitung.join(","));
check("acakIndeks pada n=0 -> -1", acakIndeks(0, () => 1) === -1, "");

// 3. Penolakan sampel bias: nilai di atas kelipatan n ditolak (n=3, 0xFFFFFFFF bias ke 0).
let panggil = 0;
const r3 = acakIndeks(3, () => (panggil++ === 0 ? 0xffffffff : 1));
check("acakIndeks menolak sampel bias", panggil === 2 && r3 === 1, `panggilan=${panggil}, hasil=${r3}`);

// 4. Normaliser: data rusak tak merusak.
const kotor = bersihkanRoda([
  null,
  { id: "a", name: "  Kelas   A ", items: ["Budi ", "", 5, "Sari", "x".repeat(200)], palet: "tidakada", durasi: 99, hapusPemenang: "ya" },
  { id: "a", name: "kembar", items: [] },
  { id: "", name: "tanpa id" },
  "bukan objek",
]);
check("normaliser: duplikat/kosong dibuang", kotor.length === 1, `${kotor.length} roda`);
check("normaliser: nama dirapikan", kotor[0]?.name === "Kelas A", String(kotor[0]?.name));
check("normaliser: item kosong/non-teks dibuang", kotor[0]?.items.length === 3, JSON.stringify(kotor[0]?.items.map((x) => x.length)));
check("normaliser: palet/durasi/hapus kembali ke nilai aman", kotor[0]?.palet === "samudra" && kotor[0]?.durasi === 12 && kotor[0]?.hapusPemenang === false, JSON.stringify(kotor[0]));
check("normaliser: bukan larik -> kosong", bersihkanRoda("x").length === 0 && bersihkanRoda(undefined).length === 0, "");
const banyak = bersihkanRoda(Array.from({ length: 30 }, (_, i) => ({ id: `r${i}`, name: "r", items: [] })));
check("normaliser: batas jumlah roda", banyak.length === WHEEL_MAX_RODA, String(banyak.length));

// 5. Tambah nama.
check("tambahItem menolak nama kosong", tambahItem([], "   ").error !== undefined, "");
check("tambahItem merapikan spasi", tambahItem([], "  Budi   Santoso ").items[0] === "Budi Santoso", "");
check("tambahItem menolak melewati batas", tambahItem(new Array(WHEEL_MAX_ITEM).fill("a"), "b").error !== undefined, "");

// 6. Palet & kontras teks.
check("setiap palet punya >= 4 warna heksa", Object.values(PALET).every((p) => p.warna.length >= 4 && p.warna.every((c) => /^#[0-9a-f]{6}$/i.test(c))), "");
check("teks gelap di atas warna terang, putih di atas gelap", warnaTeks("#ffffff") === "#07131b" && warnaTeks("#173C8C") === "#ffffff", "");

// 7. Warna kustom: hanya heksa sah, minimal 2, dan dipakai bila palet = kustom.
const kus = bersihkanRoda([{ id: "k", name: "k", items: [], palet: "kustom", warna: ["#FF0000", "merah", "#00ff00", 5, "#12345"], popup: true }]);
check("warna kustom: hanya heksa sah, huruf kecil", JSON.stringify(kus[0]?.warna) === JSON.stringify(["#ff0000", "#00ff00"]), JSON.stringify(kus[0]?.warna));
check("popup tersimpan sebagai boolean", kus[0]?.popup === true && bersihkanRoda([{ id: "z", popup: "ya" }])[0]?.popup === false, "");
const sedikit = bersihkanRoda([{ id: "s", palet: "kustom", warna: ["#ff0000"] }]);
check("warna kustom < 2 -> kembali ke warna awal", (sedikit[0]?.warna.length ?? 0) >= 2, JSON.stringify(sedikit[0]?.warna));
check("warnaRoda memakai warna kustom bila dipilih", warnaRoda({ palet: "kustom", warna: ["#ff0000", "#00ff00"] }).join() === "#ff0000,#00ff00", "");
check("warnaRoda memakai palet bawaan selain kustom", warnaRoda({ palet: "mono", warna: ["#ff0000", "#00ff00"] }) === PALET.mono.warna, "");

finish();
