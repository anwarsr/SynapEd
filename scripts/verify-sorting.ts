/**
 * Menguji Lab 06 Sorting (bubble sort & merge sort) — murni, tanpa dev server
 * & kredensial.
 *
 *   npx tsx scripts/verify-sorting.ts
 *
 * Yang dijaga:
 *   1. hasil akhir kedua algoritma = pengurutan STABIL bawaan, untuk ratusan
 *      data acak (benih tetap) dan semua contoh kasus, dua arah;
 *   2. bubble: setiap langkah permutasi, hanya langkah "tukar" yang
 *      memindahkan batang, jumlah pertukaran = jumlah inversi, data urut =
 *      n−1 perbandingan (berhenti lebih awal), data terbalik = n(n−1)/2;
 *   3. merge: pohon 2n−1 simpul, isi simpul selalu dari rentangnya sendiri
 *      tanpa ganda, simpul "urut" = gabungan terurut anak-anaknya, k = i + j
 *      di setiap penyalinan, perbandingan ≤ n⌈log₂ n⌉;
 *   4. baris pseudocode yang disorot menunjuk baris yang tepat;
 *   5. pseudocode yang TAMPIL benar-benar jalan di interpreter Lab 05 dan
 *      mengurutkan (jumlah putaran bubble = rekaman);
 *   6. urai data, tautan `?u=`, dan tempo yang tidak boleh dipercepat.
 */
import { check, finish } from "./checks";
import { mulberry32 } from "../frontend/src/lib/lab/labRandom";
import { jalankanPseudo } from "../frontend/src/lib/lab/pseudo/pseudoJalan";
import { rekamBubble } from "../frontend/src/lib/lab/sort/sortBubble";
import { rekamMerge } from "../frontend/src/lib/lab/sort/sortMerge";
import { barisBubble, barisMerge, kodeBubble, kodeMerge } from "../frontend/src/lib/lab/sort/sortKode";
import { CONTOH_KASUS, dataAcak, uraiData } from "../frontend/src/lib/lab/sort/sortData";
import { decodeSort, encodeSort } from "../frontend/src/lib/lab/sort/sortUrl";
import {
  KECEPATAN_SORT,
  SORT_MAX_DATA,
  TAHAN_MS,
  type ArahSort,
  type Batang,
  type LangkahMerge,
} from "../frontend/src/lib/lab/sort/sortTypes";

const ARAH: readonly ArahSort[] = ["naik", "turun"];

/** Urutan id yang benar: stabil (seri → id semula lebih kecil dulu). */
function idStabil(nilai: readonly number[], arah: ArahSort): number[] {
  return nilai
    .map((v, id) => ({ v, id }))
    .sort((a, b) => (arah === "naik" ? a.v - b.v : b.v - a.v) || a.id - b.id)
    .map((x) => x.id);
}
const idDari = (bs: readonly (Batang | null)[]) => bs.map((b) => (b ? b.id : -1));
const sama = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function inversi(nilai: readonly number[], arah: ArahSort): number {
  let c = 0;
  for (let i = 0; i < nilai.length; i++)
    for (let j = i + 1; j < nilai.length; j++) if (arah === "naik" ? nilai[i] > nilai[j] : nilai[i] < nilai[j]) c++;
  return c;
}

// Kumpulan data uji: contoh kasus + acak (nilai kecil supaya banyak kembar).
const kumpulan: number[][] = CONTOH_KASUS.map((c) => [...c.nilai]);
{
  const acak = mulberry32(6060);
  for (let t = 0; t < 300; t++) {
    const n = 2 + Math.floor(acak() * (SORT_MAX_DATA - 1));
    const maks = t % 3 === 0 ? 5 : 999;
    kumpulan.push(Array.from({ length: n }, () => Math.floor(acak() * (maks + 1))));
  }
}

// ---------------------------------------------------------------------------
console.log("\n1-2. Bubble sort");
{
  let hasilSalah = "";
  let bukanPermutasi = "";
  let gerakDiLuarTukar = "";
  let inversiSalah = "";
  let bandingRusak = "";
  let hitungRusak = "";
  for (const nilai of kumpulan) {
    for (const arah of ARAH) {
      const r = rekamBubble(nilai, arah);
      const akhir = r.langkah.at(-1)!;
      if (!hasilSalah && !sama(idDari(akhir.urutan), idStabil(nilai, arah))) hasilSalah = `${arah} [${nilai}]`;
      let lalu = idDari(r.langkah[0].urutan);
      let bLalu = 0;
      let pLalu = 0;
      for (const l of r.langkah) {
        const ids = idDari(l.urutan);
        if (!bukanPermutasi && (!sama([...ids].sort((a, b) => a - b), nilai.map((_, i) => i)) || l.urutan.some((b) => b.nilai !== nilai[b.id])))
          bukanPermutasi = `[${nilai}]`;
        if (!gerakDiLuarTukar && l.jenis !== "tukar" && !sama(ids, lalu)) gerakDiLuarTukar = `${l.jenis} [${nilai}]`;
        if (!bandingRusak && l.jenis === "banding") {
          const pos = Object.entries(l.peran).filter(([, p]) => p === "banding").map(([id]) => ids.indexOf(Number(id))).sort((a, b) => a - b);
          if (pos.length !== 2 || pos[1] - pos[0] !== 1) bandingRusak = `[${nilai}] posisi ${pos}`;
        }
        if (!hitungRusak && (l.banding < bLalu || l.pindah < pLalu)) hitungRusak = `[${nilai}]`;
        bLalu = l.banding;
        pLalu = l.pindah;
        lalu = ids;
      }
      if (!hitungRusak && (akhir.banding !== r.banding || akhir.pindah !== r.pindah)) hitungRusak = `akhir [${nilai}]`;
      if (!inversiSalah && r.pindah !== inversi(nilai, arah)) inversiSalah = `${arah} [${nilai}]: ${r.pindah} vs ${inversi(nilai, arah)}`;
    }
  }
  check("bubble: hasil = urutan stabil bawaan (dua arah)", !hasilSalah, hasilSalah || `${kumpulan.length * 2} kasus`);
  check("bubble: setiap langkah permutasi data semula", !bukanPermutasi, bukanPermutasi || "ok");
  check("bubble: hanya langkah tukar yang memindahkan batang", !gerakDiLuarTukar, gerakDiLuarTukar || "ok");
  check("bubble: jumlah pertukaran = jumlah inversi", !inversiSalah, inversiSalah || "ok");
  check("bubble: langkah banding menyorot tepat dua tetangga", !bandingRusak, bandingRusak || "ok");
  check("bubble: penghitung kumulatif tidak menyusut & cocok dengan total", !hitungRusak, hitungRusak || "ok");

  for (const n of [2, 7, 12]) {
    const urut = Array.from({ length: n }, (_, i) => i * 3);
    const r = rekamBubble(urut, "naik");
    check(`bubble: data urut (n=${n}) = n−1 perbandingan, 0 pertukaran`, r.banding === n - 1 && r.pindah === 0, `${r.banding}/${r.pindah}`);
    const balik = [...urut].reverse();
    const rb = rekamBubble(balik, "naik");
    check(`bubble: data terbalik (n=${n}) = n(n−1)/2 pertukaran`, rb.pindah === (n * (n - 1)) / 2, String(rb.pindah));
  }
  const akhirUrut = rekamBubble([4, 9, 15], "naik").langkah.at(-1)!;
  check("bubble: langkah akhir menandai semua batang terurut", akhirUrut.batasTerurut === 0, String(akhirUrut.batasTerurut));
}

// ---------------------------------------------------------------------------
console.log("\n3. Merge sort");
{
  let hasilSalah = "";
  let jumlahSimpul = "";
  let isiLiar = "";
  let urutSalah = "";
  let kSalah = "";
  let bandingBanyak = "";
  let salinSalah = "";
  for (const nilai of kumpulan) {
    for (const arah of ARAH) {
      const r = rekamMerge(nilai, arah);
      const n = nilai.length;
      const akhir = r.langkah.at(-1)!;
      const akar = akhir.simpul[0];
      if (!hasilSalah && !sama(idDari(akar.isi), idStabil(nilai, arah))) hasilSalah = `${arah} [${nilai}]`;
      if (!jumlahSimpul && akhir.simpul.length !== 2 * n - 1) jumlahSimpul = `[${nilai}] ${akhir.simpul.length}`;

      for (const l of r.langkah) {
        for (const s of l.simpul) {
          const ids = s.isi.filter((b): b is Batang => b !== null).map((b) => b.id);
          if (!isiLiar && (ids.some((id) => id < s.lo || id > s.hi) || new Set(ids).size !== ids.length || s.isi.length !== s.hi - s.lo + 1))
            isiLiar = `[${nilai}] simpul ${s.lo}..${s.hi}`;
          if (!urutSalah && s.status === "urut") {
            const harap = idStabil(nilai, arah).filter((id) => id >= s.lo && id <= s.hi);
            if (!sama(idDari(s.isi), harap)) urutSalah = `${arah} [${nilai}] simpul ${s.lo}..${s.hi}`;
          }
        }
        if (!kSalah && l.jenis === "salin") {
          const { i, j, k } = l.penunjuk;
          if (i === null || j === null || k === null || k !== i + j) kSalah = `[${nilai}] i=${i} j=${j} k=${k}`;
        }
      }
      const batas = n * Math.ceil(Math.log2(n));
      if (!bandingBanyak && r.banding > batas) bandingBanyak = `[${nilai}] ${r.banding} > ${batas}`;
      // Setiap simpul dalam menyalin seluruh isinya tepat sekali.
      const harapSalin = akhir.simpul.filter((s) => s.kiri !== null).reduce((t, s) => t + s.hi - s.lo + 1, 0);
      if (!salinSalah && r.pindah !== harapSalin) salinSalah = `[${nilai}] ${r.pindah} vs ${harapSalin}`;
    }
  }
  check("merge: hasil = urutan stabil bawaan (dua arah)", !hasilSalah, hasilSalah || `${kumpulan.length * 2} kasus`);
  check("merge: pohon berisi 2n−1 simpul", !jumlahSimpul, jumlahSimpul || "ok");
  check("merge: isi simpul selalu dari rentangnya sendiri, tanpa ganda", !isiLiar, isiLiar || "ok");
  check("merge: simpul 'urut' = gabungan terurut stabil dari rentangnya", !urutSalah, urutSalah || "ok");
  check("merge: k = i + j di setiap penyalinan", !kSalah, kSalah || "ok");
  check("merge: perbandingan ≤ n⌈log₂ n⌉", !bandingBanyak, bandingBanyak || "ok");
  check("merge: penyalinan = jumlah isi seluruh simpul dalam", !salinSalah, salinSalah || "ok");

  const r = rekamMerge([38, 27, 43, 3], "naik");
  const statusAwal = r.langkah[0].simpul.map((s) => s.status);
  check(
    "merge: awalnya hanya akar yang terlihat",
    statusAwal[0] === "menunggu" && statusAwal.slice(1).every((s) => s === "tersembunyi"),
    statusAwal.join(","),
  );
  const urutanJenis = r.langkah.map((l: LangkahMerge) => l.jenis);
  check(
    "merge: bagi dulu sampai daun, baru gabung",
    urutanJenis.indexOf("bagi") < urutanJenis.indexOf("daun") && urutanJenis.indexOf("daun") < urutanJenis.indexOf("banding"),
    urutanJenis.slice(0, 6).join(","),
  );
}

// ---------------------------------------------------------------------------
console.log("\n4. Baris pseudocode yang disorot");
for (const arah of ARAH) {
  const kb = kodeBubble(arah).split("\n");
  const km = kodeMerge(arah).split("\n");
  const teks = (k: string[], n: number) => (k[n - 1] ?? "").trim();
  const B = barisBubble(arah);
  const M = barisMerge(arah);
  const contoh = [38, 27, 43, 3, 9, 82, 10, 27];

  let liar = "";
  for (const l of rekamBubble(contoh, arah).langkah) if (l.baris < 1 || l.sampai < l.baris || l.sampai > kb.length) liar = `bubble ${l.baris}-${l.sampai}`;
  for (const l of rekamMerge(contoh, arah).langkah) if (l.baris < 1 || l.sampai < l.baris || l.sampai > km.length) liar = `merge ${l.baris}-${l.sampai}`;
  check(`${arah}: setiap sorotan menunjuk baris yang ada`, !liar, liar || "ok");

  const op = arah === "naik" ? ">" : "<";
  check(`${arah}: bubble banding → baris IF`, teks(kb, B.banding) === `IF A[j] ${op} A[j + 1]`, teks(kb, B.banding));
  check(
    `${arah}: bubble tukar → Temp sampai Ditukar ← TRUE`,
    teks(kb, B.tukarDari).startsWith("Temp") && teks(kb, B.tukarSampai) === "Ditukar ← TRUE" && B.tukarSampai - B.tukarDari === 3,
    `${B.tukarDari}-${B.tukarSampai}`,
  );
  check(`${arah}: bubble putaran → Ditukar ← FALSE`, teks(kb, B.putaran) === "Ditukar ← FALSE", teks(kb, B.putaran));
  check(`${arah}: bubble akhir putaran → UNTIL`, teks(kb, B.akhirPutaran).startsWith("UNTIL"), teks(kb, B.akhirPutaran));

  check(`${arah}: merge bagi → Tengah ← … DIV 2`, teks(km, M.bagi).includes("DIV 2"), teks(km, M.bagi));
  check(`${arah}: merge daun → IF Kiri < Kanan`, teks(km, M.daun) === "IF Kiri < Kanan", teks(km, M.daun));
  check(`${arah}: merge banding → IF A[i]`, teks(km, M.banding).startsWith("IF A[i]"), teks(km, M.banding));
  check(
    `${arah}: merge salin kiri/kanan → B[k] ← A[i] / A[j]`,
    teks(km, M.ambilKiri[0]) === "B[k] ← A[i]" && teks(km, M.ambilKanan[0]) === "B[k] ← A[j]" &&
      teks(km, M.sisaKiriSalin[0]) === "B[k] ← A[i]" && teks(km, M.sisaKananSalin[0]) === "B[k] ← A[j]",
    `${M.ambilKiri} ${M.ambilKanan} ${M.sisaKiriSalin} ${M.sisaKananSalin}`,
  );
  check(
    `${arah}: merge perulangan sisa → WHILE tanpa AND`,
    teks(km, M.sisaKiri) === "WHILE i <= Tengah" && teks(km, M.sisaKanan) === "WHILE j <= Kanan",
    `${teks(km, M.sisaKiri)} | ${teks(km, M.sisaKanan)}`,
  );
  check(`${arah}: merge salin balik → FOR k … NEXT k`, teks(km, M.salinBalik[0]).startsWith("FOR k") && teks(km, M.salinBalik[1]) === "NEXT k", `${M.salinBalik}`);
}

// ---------------------------------------------------------------------------
console.log("\n5. Pseudocode yang tampil berjalan di interpreter Lab 05");
{
  const bungkus = (kode: string, ekor = "") =>
    `DECLARE A : ARRAY[1:12] OF INTEGER
DECLARE N, Idx : INTEGER
INPUT N
FOR Idx ← 1 TO N
   INPUT A[Idx]
NEXT Idx
${kode}
FOR Idx ← 1 TO N
   OUTPUT A[Idx]
NEXT Idx
${ekor}`;
  const masukan = (nilai: number[]) => [nilai.length, ...nilai].join("\n");

  let galat = "";
  let salah = "";
  let putaranBeda = "";
  const sampel = kumpulan.slice(0, 40);
  for (const nilai of sampel) {
    for (const arah of ARAH) {
      const harap = idStabil(nilai, arah).map((id) => nilai[id]);
      const jb = jalankanPseudo(bungkus(kodeBubble(arah), 'OUTPUT "P", Putaran - 1'), masukan(nilai), { rekam: false });
      const jm = jalankanPseudo(bungkus(kodeMerge(arah)), masukan(nilai), { rekam: false });
      for (const [nama, j] of [["bubble", jb], ["merge", jm]] as const) {
        if (j.galat) {
          galat ||= `${nama} ${arah}: ${j.galat.pesan} (baris ${j.galat.baris})`;
          continue;
        }
        const baris = j.keluaran.trim().split("\n");
        const angka = baris.filter((b) => !b.startsWith("P")).map(Number);
        if (!salah && !sama(angka, harap)) salah = `${nama} ${arah} [${nilai}] → [${angka}]`;
        if (nama === "bubble") {
          const p = Number(baris.find((b) => b.startsWith("P"))?.slice(1));
          const direkam = rekamBubble(nilai, arah).langkah.filter((l) => l.jenis === "info" && /^Putaran \d+$/.test(l.fase) && l.narasi.startsWith("Putaran") && l.narasi.includes(": periksa")).length;
          if (!putaranBeda && p !== direkam) putaranBeda = `${arah} [${nilai}] pseudocode ${p} vs rekaman ${direkam}`;
        }
      }
    }
  }
  check("pseudocode bubble & merge berjalan tanpa galat", !galat, galat || `${sampel.length * 2 * 2} program`);
  check("keluaran pseudocode = urutan yang benar", !salah, salah || "ok");
  check("jumlah putaran bubble di pseudocode = rekaman (berhenti lebih awal sama)", !putaranBeda, putaranBeda || "ok");
}

// ---------------------------------------------------------------------------
console.log("\n6. Data, tautan, tempo");
{
  const sah = uraiData(" 38, 27;43 3 ");
  check("urai: koma, titik koma, spasi", sah.ok && sama(sah.nilai, [38, 27, 43, 3]), JSON.stringify(sah));
  const tolak: [string, string][] = [
    ["", "minimal 2"],
    ["5", "Minimal 2"],
    [Array.from({ length: 13 }, (_, i) => i).join(","), "Maksimal 12"],
    ["3, x", "bukan bilangan bulat"],
    ["3.5 2", "bukan bilangan bulat"],
    ["-4 2", "negatif"],
    ["1000 2", "maksimal 999"],
  ];
  for (const [t, pesan] of tolak) {
    const h = uraiData(t);
    check(`urai menolak "${t.slice(0, 20)}"`, !h.ok && h.galat.includes(pesan), h.ok ? "diterima" : h.galat);
  }
  check("contoh kasus semuanya sah", CONTOH_KASUS.every((c) => uraiData(c.nilai.join(",")).ok), "ok");
  const urut = CONTOH_KASUS.find((c) => c.id === "urut")!.nilai;
  const terbalik = CONTOH_KASUS.find((c) => c.id === "terbalik")!.nilai;
  check("contoh 'sudah urut' memang urut, 'terbalik' memang terbalik", sama([...urut].sort((a, b) => a - b), urut) && sama([...urut].reverse(), terbalik), "ok");
  const kembar = CONTOH_KASUS.find((c) => c.id === "kembar")!.nilai;
  check("contoh 'kembar' memang berisi nilai kembar", new Set(kembar).size < kembar.length, "ok");
  check("data acak berbenih: sama untuk benih sama, sah", sama(dataAcak(7), dataAcak(7)) && uraiData(dataAcak(7).join(",")).ok, dataAcak(7).join(","));

  for (const isi of [
    { algo: "bubble", arah: "naik", nilai: [38, 27, 43] },
    { algo: "merge", arah: "turun", nilai: [0, 999, 5, 5] },
  ] as const) {
    const kode = encodeSort({ ...isi, nilai: [...isi.nilai] });
    const balik = decodeSort(kode);
    check(`tautan bolak-balik ${kode}`, !!balik && balik.algo === isi.algo && balik.arah === isi.arah && sama(balik.nilai, isi.nilai), JSON.stringify(balik));
  }
  for (const rusak of ["", "1b~n~", "1x~n~1,2", "1b~q~1,2", "1b~n~1", "1b~n~1,,2", "1b~n~1,2,", "2b~n~1,2", "1b~n~1000,2", `1b~n~${Array(13).fill(1).join(",")}`, `1b~n~${"1,".repeat(70)}1`]) {
    check(`tautan rusak ditolak "${rusak.slice(0, 24)}"`, decodeSort(rusak) === null, "null");
  }

  const minimum = { info: 2800, banding: 1900, tukar: 2600, bagi: 2200, daun: 1500, salin: 2600, selesai: 2800 } as const;
  const dipercepat = Object.entries(minimum).filter(([j, ms]) => TAHAN_MS[j as keyof typeof minimum] < ms);
  check("tempo tidak dipercepat diam-diam", dipercepat.length === 0, dipercepat.map(([j]) => j).join(",") || "ok");
  check("kecepatan maksimal 2×", Math.max(...KECEPATAN_SORT) <= 2 && KECEPATAN_SORT.includes(1), KECEPATAN_SORT.join(","));
  const r = rekamBubble([3, 1, 2], "naik");
  check("setiap langkah membawa tahanMs sesuai jenisnya", r.langkah.every((l) => l.tahanMs === TAHAN_MS[l.jenis]), "ok");
}

finish();
