/**
 * Pengurutan untuk semua lab: lima algoritma, direkam langkah demi langkah.
 *
 * Algoritmanya ditulis SEKALI di atas "deret slot" abstrak (0..n−1), lalu
 * setiap lab memetakan slot ke posisi selnya sendiri: indeks pada 1D, sel
 * `[i][j]` pada 2D, offset memori pada 3D/N-D. Karena itu bubble sort di kubus
 * 3D memakai perbandingan, pertukaran, dan narasi yang PERSIS sama dengan
 * bubble sort di array 1D — siswa melihat satu algoritma, bukan lima versi.
 *
 * Array berdimensi lebih dari satu diurutkan sebagai satu deret atau lebih:
 * seluruhnya dalam urutan memori (baris demi baris), atau setiap garis di
 * sepanjang satu sumbu (tiap baris, tiap kolom, tiap pilar) sendiri-sendiri.
 * Setiap garis itu memang array 1D.
 *
 * Mesin TIDAK menyalin keadaan lab; ia hanya mencatat permutasi slot. Setiap
 * langkah tetap sebuah permutasi dari isi semula — tidak ada elemen yang
 * hilang atau tergandakan, termasuk saat merge sort "menyisipkan" elemen.
 *
 * Modul NETRAL tanpa impor alias `@/`.
 */
import type { LabPeran, LabStep } from "./labTypes";
import type { OpField, OpSpecOf } from "./labForm";

export type KindUrut = "bubbleSort" | "selectionSort" | "insertionSort" | "mergeSort" | "quickSort";
export const KIND_URUT: readonly KindUrut[] = ["bubbleSort", "selectionSort", "insertionSort", "mergeSort", "quickSort"];
export type ArahUrut = "naik" | "turun";

export function isKindUrut(k: string): k is KindUrut {
  return (KIND_URUT as readonly string[]).includes(k);
}

export function isArahUrut(a: unknown): a is ArahUrut {
  return a === "naik" || a === "turun";
}

export const INFO_URUT: Record<KindUrut, { nama: string; ringkas: string; pertukaran: string }> = {
  bubbleSort: {
    nama: "Bubble sort",
    ringkas: "Bandingkan dua tetangga, tukar kalau terbalik; nilai terbesar 'menggelembung' ke ujung setiap putaran. O(n²).",
    pertukaran: "pertukaran",
  },
  selectionSort: {
    nama: "Selection sort",
    ringkas: "Cari nilai terkecil di bagian yang belum urut, lalu tukar ke depan. Pertukarannya paling sedikit. O(n²).",
    pertukaran: "pertukaran",
  },
  insertionSort: {
    nama: "Insertion sort",
    ringkas: "Ambil satu nilai, sisipkan ke tempatnya di bagian kiri yang sudah urut — seperti menyusun kartu. O(n²), cepat untuk data yang hampir urut.",
    pertukaran: "pergeseran",
  },
  mergeSort: {
    nama: "Merge sort",
    ringkas: "Bagi dua terus sampai tinggal satu elemen, lalu gabungkan bagian-bagian yang sudah urut. O(n log n).",
    pertukaran: "perpindahan",
  },
  quickSort: {
    nama: "Quick sort",
    ringkas: "Pilih pivot, kumpulkan yang lebih kecil di kirinya, lalu urutkan kedua sisi. Rata-rata O(n log n).",
    pertukaran: "pertukaran",
  },
};

export const OPSI_ARAH: readonly { nilai: ArahUrut; label: string }[] = [
  { nilai: "naik", label: "Naik (kecil → besar)" },
  { nilai: "turun", label: "Turun (besar → kecil)" },
];

const ANGKA_RE = /^-?\d+(\.\d+)?$/;

/**
 * Membandingkan dua nilai sel. Dua angka dibandingkan sebagai ANGKA (jadi 10
 * sesudah 9, bukan sesudah 1 seperti urutan teks); angka selalu sebelum
 * teks; teks dibandingkan menurut abjad tanpa membedakan huruf besar-kecil,
 * dengan kode karakter sebagai penentu seri supaya hasilnya pasti.
 */
export function bandingkanNilai(a: string, b: string): number {
  const na = ANGKA_RE.test(a);
  const nb = ANGKA_RE.test(b);
  if (na && nb) return Number(a) - Number(b);
  if (na !== nb) return na ? -1 : 1;
  const ka = a.toLowerCase();
  const kb = b.toLowerCase();
  if (ka !== kb) return ka < kb ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Mesin perekam
// ---------------------------------------------------------------------------

/** Satu langkah rekaman, dalam koordinat SLOT (0..n−1). */
export interface LangkahUrut {
  /** isi[s] = indeks elemen semula yang sekarang berada di slot s. */
  isi: number[];
  narasi: string;
  peran: Record<number, LabPeran>;
  label: Record<number, string>;
  /** Langkah ini memindahkan elemen (ditahan lebih lama). */
  gerak: boolean;
}

export interface RekamanUrut {
  langkah: LangkahUrut[];
  perbandingan: number;
  perpindahan: number;
}

/**
 * Menjalankan satu algoritma pada `nilai` dan merekam setiap langkahnya.
 * `nama(slot)` memberi nama posisi untuk narasi ("indeks 3", "arr[1][2]").
 */
export function rekamUrut(nilai: readonly string[], kind: KindUrut, arah: ArahUrut, nama: (slot: number) => string): RekamanUrut {
  const n = nilai.length;
  const isi = Array.from({ length: n }, (_, i) => i);
  const langkah: LangkahUrut[] = [];
  const terurut = new Set<number>();
  let perbandingan = 0;
  let perpindahan = 0;

  const v = (s: number) => nilai[isi[s]];
  /** Elemen di slot a seharusnya berada SESUDAH elemen di slot b. */
  const terbalik = (a: number, b: number) => {
    const c = bandingkanNilai(v(a), v(b));
    return arah === "naik" ? c > 0 : c < 0;
  };
  const simbol = (a: number, b: number) => {
    const c = bandingkanNilai(v(a), v(b));
    return c < 0 ? "<" : c > 0 ? ">" : "=";
  };
  const sebut = (s: number) => `${v(s)} (${nama(s)})`;
  const ekstrem = arah === "naik" ? "terkecil" : "terbesar";
  const ujung = arah === "naik" ? "terbesar" : "terkecil";

  function catat(
    narasi: string,
    opsi: { peran?: Record<number, LabPeran>; label?: Record<number, string>; gerak?: boolean; rentang?: [number, number] } = {},
  ) {
    const peran: Record<number, LabPeran> = {};
    if (opsi.rentang) {
      for (let s = 0; s < n; s++) if (s < opsi.rentang[0] || s > opsi.rentang[1]) peran[s] = "luar";
    }
    for (const s of terurut) peran[s] = "terurut";
    Object.assign(peran, opsi.peran ?? {});
    langkah.push({ isi: [...isi], narasi, peran, label: { ...(opsi.label ?? {}) }, gerak: opsi.gerak ?? false });
  }

  function tukar(a: number, b: number) {
    [isi[a], isi[b]] = [isi[b], isi[a]];
    perpindahan++;
  }

  const kalimatBanding = (a: number, b: number) => `Bandingkan ${sebut(a)} dengan ${sebut(b)}: ${v(a)} ${simbol(a, b)} ${v(b)}`;

  if (n < 2) return { langkah, perbandingan, perpindahan };

  switch (kind) {
    case "bubbleSort": {
      for (let p = 0; p < n - 1; p++) {
        let ditukar = false;
        catat(`Putaran ${p + 1}: telusuri pasangan bertetangga dari kiri; nilai ${ujung} akan terbawa sampai ${nama(n - 1 - p)}.`, {
          rentang: [0, n - 1 - p],
        });
        for (let j = 0; j < n - 1 - p; j++) {
          perbandingan++;
          const salah = terbalik(j, j + 1);
          catat(`${kalimatBanding(j, j + 1)} — ${salah ? "urutannya terbalik, harus ditukar" : "sudah urut, biarkan"}.`, {
            peran: { [j]: "banding", [j + 1]: "banding" },
            label: { [j]: "j", [j + 1]: "j+1" },
            rentang: [0, n - 1 - p],
          });
          if (salah) {
            tukar(j, j + 1);
            ditukar = true;
            catat(`Tukar: ${v(j)} pindah ke kiri, ${v(j + 1)} pindah ke kanan.`, {
              peran: { [j]: "banding", [j + 1]: "banding" },
              label: { [j]: "j", [j + 1]: "j+1" },
              gerak: true,
              rentang: [0, n - 1 - p],
            });
          }
        }
        terurut.add(n - 1 - p);
        if (!ditukar) {
          for (let s = 0; s < n; s++) terurut.add(s);
          catat(`Putaran ${p + 1} tanpa satu pun pertukaran — artinya semua sudah urut. Berhenti lebih awal.`);
          break;
        }
        catat(`Putaran ${p + 1} selesai: ${v(n - 1 - p)} sudah di tempat akhirnya (${nama(n - 1 - p)}).`);
      }
      break;
    }

    case "selectionSort": {
      const lbl = arah === "naik" ? "min" : "maks";
      for (let i = 0; i < n - 1; i++) {
        let m = i;
        catat(`Cari nilai ${ekstrem} mulai ${nama(i)}. Sementara, ${lbl} = ${sebut(i)}.`, {
          peran: { [i]: "kunci" },
          label: { [i]: lbl },
        });
        for (let j = i + 1; j < n; j++) {
          perbandingan++;
          const baru = terbalik(m, j);
          catat(`${kalimatBanding(j, m)} — ${baru ? `${v(j)} jadi ${lbl} yang baru` : `${lbl} tetap ${v(m)}`}.`, {
            peran: { [j]: "banding", [m]: "kunci" },
            label: { [j]: "j", [m]: lbl },
          });
          if (baru) m = j;
        }
        if (m !== i) {
          const nilaiM = v(m);
          tukar(i, m);
          catat(`Tukar ${lbl} ${nilaiM} ke ${nama(i)}; ${v(m)} pindah ke tempat lamanya.`, {
            peran: { [i]: "kunci", [m]: "banding" },
            label: { [i]: lbl },
            gerak: true,
          });
        }
        terurut.add(i);
        catat(`${v(i)} sudah di tempat akhirnya (${nama(i)}).`);
      }
      terurut.add(n - 1);
      break;
    }

    case "insertionSort": {
      const urutKiri = (sampai: number) => Object.fromEntries(Array.from({ length: sampai + 1 }, (_, s) => [s, "sementara" as LabPeran]));
      for (let i = 1; i < n; i++) {
        let j = i;
        catat(`Ambil ${sebut(i)} sebagai kunci, lalu sisipkan ke bagian kiri yang sudah urut.`, {
          peran: { ...urutKiri(i - 1), [i]: "kunci" },
          label: { [i]: "kunci" },
        });
        while (j > 0) {
          perbandingan++;
          const geser = terbalik(j - 1, j);
          catat(`${kalimatBanding(j - 1, j)} — ${geser ? "kunci harus di kirinya, geser" : "kunci sudah di tempat yang benar, berhenti"}.`, {
            peran: { ...urutKiri(i), [j - 1]: "banding", [j]: "kunci" },
            label: { [j]: "kunci" },
          });
          if (!geser) break;
          tukar(j - 1, j);
          j--;
          catat(`${v(j + 1)} bergeser ke kanan; kunci ${v(j)} maju ke ${nama(j)}.`, {
            peran: { ...urutKiri(i), [j]: "kunci", [j + 1]: "banding" },
            label: { [j]: "kunci" },
            gerak: true,
          });
        }
        catat(`Bagian ${nama(0)} sampai ${nama(i)} kini urut (sementara — nilai yang datang kemudian masih bisa menyisip).`, {
          peran: urutKiri(i),
        });
      }
      for (let s = 0; s < n; s++) terurut.add(s);
      break;
    }

    case "mergeSort": {
      const urut = (lo: number, hi: number): Record<number, LabPeran> =>
        Object.fromEntries(Array.from({ length: hi - lo + 1 }, (_, x) => [lo + x, "sementara" as LabPeran]));
      const sortir = (lo: number, hi: number) => {
        if (lo >= hi) return;
        const mid = Math.floor((lo + hi) / 2);
        catat(`Bagi ${nama(lo)}–${nama(hi)} menjadi dua: ${nama(lo)}–${nama(mid)} dan ${nama(mid + 1)}–${nama(hi)}.`, {
          rentang: [lo, hi],
          label: { [lo]: "kiri", [mid + 1]: "kanan" },
        });
        sortir(lo, mid);
        sortir(mid + 1, hi);
        catat(`Gabungkan dua bagian yang masing-masing sudah urut: ${nama(lo)}–${nama(mid)} dan ${nama(mid + 1)}–${nama(hi)}.`, {
          rentang: [lo, hi],
          peran: urut(lo, hi),
        });
        let i = lo;
        let j = mid + 1;
        while (i < j && j <= hi) {
          perbandingan++;
          const ambilKanan = terbalik(i, j);
          catat(`${kalimatBanding(i, j)} — ${ambilKanan ? `${v(j)} dari kanan didahulukan` : `${v(i)} dari kiri sudah di tempatnya`}.`, {
            rentang: [lo, hi],
            peran: { ...(i > lo ? urut(lo, i - 1) : {}), [i]: "banding", [j]: "banding" },
            label: { [i]: "kiri", [j]: "kanan" },
          });
          if (ambilKanan) {
            const nilaiJ = v(j);
            // Sisip: elemen kanan pindah ke slot i, sisa bagian kiri bergeser satu.
            const [diambil] = isi.splice(j, 1);
            isi.splice(i, 0, diambil);
            perpindahan++;
            catat(`${nilaiJ} pindah ke ${nama(i)}; sisa bagian kiri bergeser satu ke kanan.`, {
              rentang: [lo, hi],
              peran: { ...urut(lo, i), [i + 1]: "banding" },
              label: { [i + 1]: "kiri" },
              gerak: true,
            });
            j++;
          }
          i++;
        }
        catat(`${nama(lo)}–${nama(hi)} kini urut: ${Array.from({ length: hi - lo + 1 }, (_, x) => v(lo + x)).join(", ")}.`, {
          rentang: [lo, hi],
          peran: urut(lo, hi),
        });
      };
      sortir(0, n - 1);
      for (let s = 0; s < n; s++) terurut.add(s);
      break;
    }

    case "quickSort": {
      const qs = (lo: number, hi: number) => {
        if (lo > hi) return;
        if (lo === hi) {
          terurut.add(lo);
          return;
        }
        catat(`Bagian ${nama(lo)}–${nama(hi)}: pilih ${sebut(hi)} (elemen terakhir) sebagai pivot.`, {
          rentang: [lo, hi],
          peran: { [hi]: "pivot" },
          label: { [hi]: "pivot" },
        });
        let i = lo;
        const batas = (sampai: number) => Object.fromEntries(Array.from({ length: sampai - lo }, (_, x) => [lo + x, "sementara" as LabPeran]));
        for (let j = lo; j < hi; j++) {
          perbandingan++;
          const keKiri = terbalik(hi, j);
          catat(
            `${kalimatBanding(j, hi)} — ${keKiri ? `${v(j)} harus di sisi kiri pivot` : `${v(j)} tetap di sisi kanan`}.`,
            {
              rentang: [lo, hi],
              peran: { ...batas(i), [j]: "banding", [hi]: "pivot" },
              label: { [j]: "j", [hi]: "pivot", ...(i <= hi - 1 && i !== j ? { [i]: "i" } : {}) },
            },
          );
          if (keKiri) {
            if (i !== j) {
              tukar(i, j);
              catat(`Tukar ${v(i)} ke ${nama(i)}, ujung sisi kiri pivot.`, {
                rentang: [lo, hi],
                peran: { ...batas(i + 1), [hi]: "pivot", [j]: "banding" },
                label: { [hi]: "pivot", [i]: "i" },
                gerak: true,
              });
            }
            i++;
          }
        }
        if (i !== hi) {
          tukar(i, hi);
          catat(`Pindahkan pivot ${v(i)} ke ${nama(i)}: semua di kirinya ${arah === "naik" ? "lebih kecil" : "lebih besar"}, di kanannya tidak. Pivot sudah di tempat akhirnya.`, {
            rentang: [lo, hi],
            peran: { ...batas(i), [i]: "pivot" },
            label: { [i]: "pivot" },
            gerak: true,
          });
        } else {
          catat(`Pivot ${v(i)} sudah di tempat akhirnya (${nama(i)}) — tidak ada yang perlu dipindah.`, {
            rentang: [lo, hi],
            peran: { ...batas(i), [i]: "pivot" },
            label: { [i]: "pivot" },
          });
        }
        terurut.add(i);
        qs(lo, i - 1);
        qs(i + 1, hi);
      };
      qs(0, n - 1);
      break;
    }

    default: {
      const _lengkap: never = kind;
      throw new Error(`rekamUrut: algoritma tidak dikenal (${String(_lengkap)}).`);
    }
  }

  return { langkah, perbandingan, perpindahan };
}

// ---------------------------------------------------------------------------
// Penerjemah ke langkah lab
// ---------------------------------------------------------------------------

const TAHAN_BANDING_MS = 1300;
const TAHAN_GERAK_MS = 2000;

export interface DeretUrut {
  /** Posisi (indeks datar milik lab) dalam urutan slot. */
  posisi: number[];
  /** Awalan narasi untuk deret ini, mis. "Baris 2: "; kosong untuk deret tunggal. */
  awalan: string;
}

/**
 * Mengubah rekaman pengurutan satu deret atau lebih menjadi langkah lab.
 *
 * `bingkai(penempatan)` menyusun keadaan lab dengan sel dipindah: penempatan
 * memetakan posisi → posisi SEMULA dari sel yang kini menempatinya (posisi
 * yang tidak disebut tidak berubah). `akhir` sama, untuk keadaan terakhir —
 * misalnya mengembalikan sorotan pengguna yang disembunyikan selama animasi.
 *
 * Deret diurutkan satu per satu; deret yang sudah selesai ditandai "terurut",
 * yang belum disentuh diredupkan, supaya mata tahu deret mana yang sedang
 * dikerjakan.
 */
export function langkahUrut<S>(opsi: {
  kind: KindUrut;
  arah: ArahUrut;
  deret: readonly DeretUrut[];
  nilaiDi: (pos: number) => string;
  idDi: (pos: number) => number;
  nama: (pos: number) => string;
  bingkai: (penempatan: ReadonlyMap<number, number>) => S;
  akhir: (penempatan: ReadonlyMap<number, number>) => S;
  pembuka: string;
}): { steps: LabStep<S>[]; perbandingan: number; perpindahan: number } {
  const { kind, arah, deret } = opsi;
  const info = INFO_URUT[kind];
  const penempatan = new Map<number, number>();
  const steps: LabStep<S>[] = [];
  let perbandingan = 0;
  let perpindahan = 0;

  const semuaPos = deret.flatMap((d) => d.posisi);
  const peranDeret = (sampai: number, status: LabPeran, dari = 0): Record<number, LabPeran> => {
    const hasil: Record<number, LabPeran> = {};
    for (let t = dari; t < sampai; t++) {
      for (const p of deret[t].posisi) hasil[opsi.idDi(penempatan.get(p) ?? p)] = status;
    }
    return hasil;
  };

  steps.push({
    state: opsi.bingkai(penempatan),
    narasi: `${info.nama} ${arah === "naik" ? "naik (kecil → besar)" : "turun (besar → kecil)"}: ${opsi.pembuka}`,
    fokus: [],
    tahanMs: TAHAN_BANDING_MS + 400,
    peran: deret.length > 1 ? peranDeret(deret.length, "luar") : {},
  });

  deret.forEach((d, t) => {
    const rekaman = rekamUrut(
      d.posisi.map((p) => opsi.nilaiDi(p)),
      kind,
      arah,
      (s) => opsi.nama(d.posisi[s]),
    );
    perbandingan += rekaman.perbandingan;
    perpindahan += rekaman.perpindahan;

    if (deret.length > 1 && rekaman.langkah.length === 0) return;
    for (const l of rekaman.langkah) {
      d.posisi.forEach((p, s) => penempatan.set(p, d.posisi[l.isi[s]]));
      const idSlot = (s: number) => opsi.idDi(d.posisi[l.isi[s]]);
      const peran: Record<number, LabPeran> = { ...peranDeret(t, "terurut"), ...peranDeret(deret.length, "luar", t + 1) };
      for (const [s, r] of Object.entries(l.peran)) peran[idSlot(Number(s))] = r;
      const labelSel: Record<number, string> = {};
      for (const [s, teks] of Object.entries(l.label)) labelSel[idSlot(Number(s))] = teks;
      steps.push({
        state: opsi.bingkai(penempatan),
        narasi: `${d.awalan}${l.narasi}`,
        fokus: [],
        tahanMs: l.gerak ? TAHAN_GERAK_MS : TAHAN_BANDING_MS,
        peran,
        labelSel,
      });
    }
  });

  const ringkasan = `${perbandingan} perbandingan, ${perpindahan} ${info.pertukaran}`;
  steps.push({
    state: opsi.bingkai(penempatan),
    narasi: `Semua elemen sudah di tempat akhirnya.`,
    fokus: [],
    tahanMs: TAHAN_BANDING_MS,
    peran: Object.fromEntries(semuaPos.map((p) => [opsi.idDi(penempatan.get(p) ?? p), "terurut" as LabPeran])),
  });
  steps.push({
    state: opsi.akhir(penempatan),
    narasi: `${info.nama} selesai: ${ringkasan}. Coba algoritma lain pada isi yang sama dan bandingkan angkanya.`,
    fokus: [],
    tahanMs: TAHAN_BANDING_MS,
  });
  return { steps, perbandingan, perpindahan };
}

/**
 * Kalimat penolakan kalau animasinya terlalu panjang. Dihitung SETELAH
 * merekam: jumlah langkah bergantung pada isinya (bubble sort pada data yang
 * sudah urut hanya satu putaran), jadi menebak dari ukuran saja akan menolak
 * kasus yang sebenarnya pendek.
 */
export function galatTerlaluPanjang(kind: KindUrut, jumlahLangkah: number, batas: number): string {
  const lambat = kind === "bubbleSort" || kind === "selectionSort" || kind === "insertionSort";
  return `${INFO_URUT[kind].nama} pada isi ini butuh ${jumlahLangkah} langkah animasi; batasnya ${batas}. Perkecil array${lambat ? ", atau coba merge sort / quick sort yang jauh lebih sedikit langkahnya" : ""}.`;
}

// ---------------------------------------------------------------------------
// Katalog bersama
// ---------------------------------------------------------------------------

export const FIELD_ARAH: OpField = { name: "arah", label: "Arah", kind: "pilihan", opsi: OPSI_ARAH };

/**
 * Lima kartu operasi pengurutan untuk katalog sebuah lab — satu kartu per
 * algoritma, supaya ringkasan cara kerjanya terbaca tanpa membuka apa pun.
 */
export function katalogUrut<G extends string, Op>(
  grup: G,
  isianTambahan: readonly OpField[],
  contoh: (kind: KindUrut) => Op,
): Record<KindUrut, OpSpecOf<KindUrut, G, Op>> {
  const hasil = {} as Record<KindUrut, OpSpecOf<KindUrut, G, Op>>;
  for (const kind of KIND_URUT) {
    hasil[kind] = {
      kind,
      label: INFO_URUT[kind].nama,
      grup,
      ringkas: INFO_URUT[kind].ringkas,
      fields: [FIELD_ARAH, ...isianTambahan],
      contoh: contoh(kind),
    };
  }
  return hasil;
}
