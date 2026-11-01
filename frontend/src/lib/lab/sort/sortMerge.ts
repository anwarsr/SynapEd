/**
 * Perekam merge sort untuk Lab Sorting — cara buku teks: top-down dengan
 * array bantu, digambar sebagai pohon bagi-gabung.
 *
 * Pohonnya disusun lebih dulu (`Tengah = (Kiri + Kanan) DIV 2`, sama dengan
 * pseudocode), lalu rekursi dijalankan dalam urutan aslinya: bagi, urutkan
 * kiri sampai tuntas, urutkan kanan, gabung. Setiap simpul menyimpan isinya
 * sendiri, jadi potret langkah = pohon lengkap yang terlihat siswa.
 *
 * Saat menggabung, nilai yang SAMA diambil dari kiri dulu (`<=`). Itulah yang
 * membuat merge sort stabil, dan narasinya menyebutkan itu.
 *
 * Modul netral.
 */
import { barisMerge } from "./sortKode";
import {
  TAHAN_MS,
  terbalik,
  type ArahSort,
  type Batang,
  type JenisLangkah,
  type LangkahMerge,
  type Rekaman,
  type SimpulMerge,
} from "./sortTypes";

const rentang = (lo: number, hi: number) => (lo === hi ? `A[${lo + 1}]` : `A[${lo + 1}..${hi + 1}]`);
const daftar = (isi: readonly (Batang | null)[]) => isi.map((b) => (b ? String(b.nilai) : "_")).join(", ");

export function rekamMerge(nilai: readonly number[], arah: ArahSort): Rekaman<LangkahMerge> {
  const n = nilai.length;
  const data: Batang[] = nilai.map((v, id) => ({ id, nilai: v }));
  const L = barisMerge(arah);
  const simpul: SimpulMerge[] = [];

  function bangun(lo: number, hi: number, tingkat: number, induk: number | null): number {
    const id = simpul.length;
    simpul.push({ id, induk, kiri: null, kanan: null, tingkat, lo, hi, isi: data.slice(lo, hi + 1), status: "tersembunyi" });
    if (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      simpul[id].kiri = bangun(lo, mid, tingkat + 1, id);
      simpul[id].kanan = bangun(mid + 1, hi, tingkat + 1, id);
    }
    return id;
  }

  const langkah: LangkahMerge[] = [];
  let banding = 0;
  let pindah = 0;
  if (n === 0) return { langkah, banding, pindah };
  const akar = bangun(0, n - 1, 0, null);
  simpul[akar].status = "menunggu";

  function catat(
    jenis: JenisLangkah,
    fase: string,
    narasi: string,
    baris: number | [number, number],
    opsi: { aktif?: number | null; i?: number | null; j?: number | null; k?: number | null; ambil?: "kiri" | "kanan" | null } = {},
  ) {
    const [dari, sampai] = typeof baris === "number" ? [baris, baris] : baris;
    langkah.push({
      fase,
      narasi,
      baris: dari,
      sampai,
      banding,
      pindah,
      jenis,
      tahanMs: TAHAN_MS[jenis],
      simpul: simpul.map((s) => ({ ...s, isi: [...s.isi] })),
      aktif: opsi.aktif ?? null,
      penunjuk: { i: opsi.i ?? null, j: opsi.j ?? null, k: opsi.k ?? null },
      ambil: opsi.ambil ?? null,
    });
  }

  catat(
    "info",
    "Mulai",
    "Merge sort memakai strategi bagi-dan-gabung: belah data menjadi dua terus-menerus sampai setiap bagian tinggal satu " +
      "elemen, lalu gabungkan bagian-bagian itu sambil mengurutkannya.",
    L.mulai,
    { aktif: akar },
  );

  function urutkan(id: number) {
    const s = simpul[id];
    if (s.kiri === null || s.kanan === null) {
      s.status = "urut";
      catat(
        "daun",
        "Bagi",
        `${rentang(s.lo, s.hi)} = ${s.isi[0]?.nilai} tinggal satu elemen: Kiri < Kanan bernilai FALSE, jadi tidak dibagi lagi. ` +
          "Satu elemen selalu sudah urut.",
        L.daun,
        { aktif: id },
      );
      return;
    }

    const ki = simpul[s.kiri];
    const ka = simpul[s.kanan];
    s.status = "dibagi";
    ki.status = "menunggu";
    ka.status = "menunggu";
    catat(
      "bagi",
      "Bagi",
      `Bagi ${rentang(s.lo, s.hi)} di tengah: Tengah = (${s.lo + 1} + ${s.hi + 1}) DIV 2 = ${ki.hi + 1}. ` +
        `Kiri [${daftar(ki.isi)}], kanan [${daftar(ka.isi)}].`,
      L.bagi,
      { aktif: id },
    );

    urutkan(ki.id);
    urutkan(ka.id);
    gabung(id);
  }

  function gabung(id: number) {
    const s = simpul[id];
    const ki = simpul[s.kiri!];
    const ka = simpul[s.kanan!];
    const kiri = [...ki.isi] as Batang[];
    const kanan = [...ka.isi] as Batang[];
    s.isi = s.isi.map(() => null);
    s.status = "menggabung";
    let i = 0;
    let j = 0;
    let k = 0;
    catat(
      "info",
      "Gabung",
      `Gabungkan [${daftar(kiri)}] dan [${daftar(kanan)}] - keduanya sudah urut. ` +
        "i menunjuk awal bagian kiri, j awal bagian kanan, k tempat kosong berikutnya di array bantu B.",
      [L.gabungDari, L.gabungSampai],
      { aktif: id, i, j, k },
    );

    const kecil = arah === "naik" ? "lebih kecil" : "lebih besar";
    while (i < kiri.length && j < kanan.length) {
      banding++;
      const a = kiri[i];
      const b = kanan[j];
      const ambilKanan = terbalik(a.nilai, b.nilai, arah);
      catat(
        "banding",
        "Gabung",
        `Bandingkan kiri ${a.nilai} dengan kanan ${b.nilai}: ` +
          (a.nilai === b.nilai
            ? `sama besar - ambil yang KIRI dulu supaya nilai kembar tetap dalam urutan semulanya (merge sort stabil).`
            : `${ambilKanan ? b.nilai : a.nilai} ${kecil}, jadi itu yang diambil.`),
        L.banding,
        { aktif: id, i, j, k },
      );
      if (ambilKanan) {
        s.isi[k] = b;
        j++;
      } else {
        s.isi[k] = a;
        i++;
      }
      k++;
      pindah++;
      const diambil = (ambilKanan ? b : a).nilai;
      catat(
        "salin",
        "Gabung",
        `Salin ${diambil} ke B[${s.lo + k}], lalu ${ambilKanan ? "j" : "i"} dan k maju satu.`,
        ambilKanan ? L.ambilKanan : L.ambilKiri,
        { aktif: id, i, j, k, ambil: ambilKanan ? "kanan" : "kiri" },
      );
    }

    if (i < kiri.length || j < kanan.length) {
      const sisaKiri = i < kiri.length;
      const sisa = sisaKiri ? kiri.slice(i) : kanan.slice(j);
      catat(
        "info",
        "Gabung",
        `Bagian ${sisaKiri ? "kanan" : "kiri"} sudah habis. Sisa bagian ${sisaKiri ? "kiri" : "kanan"} ` +
          `[${daftar(sisa)}] sudah urut, jadi tinggal disalin berurutan tanpa perlu dibandingkan.`,
        sisaKiri ? L.sisaKiri : L.sisaKanan,
        { aktif: id, i, j, k },
      );
      while (i < kiri.length || j < kanan.length) {
        const ambilKiri = i < kiri.length;
        const b = ambilKiri ? kiri[i++] : kanan[j++];
        s.isi[k++] = b;
        pindah++;
        catat(
          "salin",
          "Gabung",
          `Salin ${b.nilai} ke B[${s.lo + k}].`,
          ambilKiri ? L.sisaKiriSalin : L.sisaKananSalin,
          { aktif: id, i, j, k, ambil: ambilKiri ? "kiri" : "kanan" },
        );
      }
    }

    s.status = "urut";
    ki.status = "terpakai";
    ka.status = "terpakai";
    catat(
      "info",
      "Gabung",
      `B[${s.lo + 1}..${s.hi + 1}] disalin kembali ke A: ${rentang(s.lo, s.hi)} kini urut - ${daftar(s.isi)}.`,
      L.salinBalik,
      { aktif: id },
    );
  }

  urutkan(akar);

  catat(
    "selesai",
    "Selesai",
    `Selesai: ${daftar(simpul[akar].isi)}. Merge sort memakai ${banding} perbandingan dan ${pindah} penyalinan. ` +
      "Kompleksitasnya O(n log n) untuk data apa pun - bahkan data yang sudah urut tetap dibagi dan digabung.",
    L.mulai,
  );

  return { langkah, banding, pindah };
}
