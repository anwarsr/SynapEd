"use client";
import { useMemo, useState } from "react";
import ShareLabButton from "../ShareLabButton";
import { IKON, Ikon, TOMBOL } from "../LabAlat";
import PapanCari from "./PapanCari";
import KodeSorotBaca from "../langkah/KodeSorotBaca";
import { DaftarPintasan, GarisWaktu, NarasiLangkah, PemutarLangkah, TabAlgoritma, usePintasanPemutar } from "../langkah/PemutarLangkah";
import { useLabPlayer } from "@/lib/useLabPlayer";
import { rekamLinear } from "@/lib/lab/search/searchLinear";
import { rekamBinary } from "@/lib/lab/search/searchBinary";
import { KODE_BINARY, KODE_LINEAR } from "@/lib/lab/search/searchKode";
import { CONTOH_BAWAAN, CONTOH_CARI, dataAcak, uraiData, uraiDicari } from "@/lib/lab/search/searchData";
import { CARI_URL_PARAM, encodeCari, type IsiCari } from "@/lib/lab/search/searchUrl";
import { CARI_MAX_DATA, maksBinary, type AlgoCari } from "@/lib/lab/search/searchTypes";
import { cn } from "@/lib/cn";

const INFO_ALGO: Record<AlgoCari, { nama: string; ide: string[]; kompleksitas: string }> = {
  linear: {
    nama: "Linear search",
    ide: [
      "Mulai dari data pertama, periksa satu per satu.",
      "Bila sama dengan yang dicari, berhenti: ketemu.",
      "Bila sampai data terakhir tidak ada yang sama, nilai itu tidak ada.",
      "Data TIDAK perlu urut.",
    ],
    kompleksitas: "O(n): terbaik 1 perbandingan (ada di depan), terburuk n (di belakang atau tidak ada).",
  },
  binary: {
    nama: "Binary search",
    ide: [
      "Data HARUS urut - kalau belum, diurutkan dulu.",
      "Tebak data di tengah (Tengah = (Kiri + Kanan) DIV 2).",
      "Bila tebakan lebih kecil dari yang dicari, buang separuh kiri; bila lebih besar, buang separuh kanan.",
      "Ulangi sampai ketemu, atau sampai tidak ada data tersisa (Kiri > Kanan).",
    ],
    kompleksitas: "O(log n): setiap tebakan membuang separuh sisa data, jadi 32 data paling banyak 6 tebakan.",
  },
};

const LEGENDA = [
  { warna: "bg-blue-300", arti: "sedang dibandingkan dengan nilai yang dicari" },
  { warna: "bg-blue-600", arti: "ketemu" },
  { warna: "bg-white/[0.08] opacity-30", arti: "sudah diperiksa / dibuang" },
  { warna: "bg-white/[0.08] shadow-[inset_0_-3px_0_var(--color-blue-400)]", arti: "masih mungkin (rentang Kiri..Kanan, binary)" },
];

const LABEL_SEKSI = "mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted";
const ISIAN =
  "min-w-0 bg-white/[0.06] px-3 py-2 text-sm tabular-nums text-ink placeholder:text-ink-faint focus:outline-none focus:shadow-[inset_0_-2px_0_var(--color-blue-500)]";

/**
 * Ruang kerja Lab 07 Searching: linear search & binary search, langkah demi
 * langkah. Pola dan kendalinya sama dengan Lab 06 Sorting (`components/lab/langkah/`):
 * kedua algoritma direkam sekali dari data + nilai cari yang sama, lalu
 * algoritma yang dipilih diputar; di akhir jumlah perbandingannya dibandingkan.
 */
export default function SearchWorkspace({
  awal,
  judul,
  aktif,
  onJalan,
}: {
  awal: IsiCari | null;
  judul: React.ReactNode;
  aktif: boolean;
  onJalan: () => void;
}) {
  const [algo, setAlgo] = useState<AlgoCari>(awal?.algo ?? "linear");
  const [nilai, setNilai] = useState<number[]>(() => awal?.nilai ?? [...CONTOH_BAWAAN.nilai]);
  const [dicari, setDicari] = useState(awal?.dicari ?? CONTOH_BAWAAN.dicari);
  const [teksData, setTeksData] = useState(() => (awal?.nilai ?? CONTOH_BAWAAN.nilai).join(", "));
  const [teksCari, setTeksCari] = useState(() => String(awal?.dicari ?? CONTOH_BAWAAN.dicari));
  const [galat, setGalat] = useState<string | null>(null);
  const [kasus, setKasus] = useState<string | null>(awal ? null : CONTOH_BAWAAN.id);
  const [presentasi, setPresentasi] = useState(false);

  const rekLinear = useMemo(() => rekamLinear(nilai, dicari), [nilai, dicari]);
  const rekBinary = useMemo(() => rekamBinary(nilai, dicari), [nilai, dicari]);
  const rek = algo === "linear" ? rekLinear : rekBinary;
  const langkah = rek.langkah;
  const pemutar = useLabPlayer(langkah);
  const l = langkah[pemutar.frame];
  const terakhir = langkah.length - 1;
  const info = INFO_ALGO[algo];

  usePintasanPemutar({
    aktif,
    pemutar,
    jumlah: langkah.length,
    presentasi,
    keluarPresentasi: () => setPresentasi(false),
    onMulai: onJalan,
  });

  function gantiData(baru: number[], cari: number, idKasus: string | null) {
    setNilai(baru);
    setDicari(cari);
    setTeksData(baru.join(", "));
    setTeksCari(String(cari));
    setGalat(null);
    setKasus(idKasus);
    pemutar.keLangkah(0);
    onJalan();
  }

  function terapkan() {
    const d = uraiData(teksData);
    if (!d.ok) return setGalat(d.galat);
    const c = uraiDicari(teksCari);
    if (!c.ok) return setGalat(`Nilai yang dicari: ${c.galat}`);
    gantiData(d.nilai, c.nilai, null);
  }

  function pilihAlgo(a: AlgoCari) {
    setAlgo(a);
    pemutar.keLangkah(0);
    onJalan();
  }

  if (!l) return null;

  const bilah = (
    <div className="flex flex-wrap items-center gap-2">
      <TabAlgoritma
        label="Algoritma pencarian"
        pilihan={[
          { id: "linear", nama: INFO_ALGO.linear.nama },
          { id: "binary", nama: INFO_ALGO.binary.nama },
        ]}
        nilai={algo}
        onPilih={pilihAlgo}
      />
      <PemutarLangkah pemutar={pemutar} jumlah={langkah.length} onMulai={onJalan} />
      <div className="ml-auto flex items-center gap-2">
        <ShareLabButton param={CARI_URL_PARAM} kode={() => encodeCari({ algo, dicari, nilai })} />
        <button type="button" className={TOMBOL} onClick={() => setPresentasi((p) => !p)} title="Layar penuh (Esc untuk keluar)">
          <Ikon d={IKON.layar} />
          <span className="hidden sm:inline">{presentasi ? "Keluar" : "Layar penuh"}</span>
        </button>
      </div>
    </div>
  );

  const narasi = <NarasiLangkah fase={l.fase} narasi={l.narasi} ke={pemutar.frame} jumlah={langkah.length} />;
  const papan = (
    <div style={{ "--lab-gerak": `${Math.round(1000 / pemutar.kecepatan)}ms` } as React.CSSProperties}>
      <PapanCari langkah={l} dicari={dicari} />
    </div>
  );
  const garisWaktu = <GarisWaktu pemutar={pemutar} jumlah={langkah.length} />;

  if (presentasi) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col gap-4 overflow-y-auto bg-paper px-6 py-5">
        {bilah}
        {narasi}
        {papan}
        {garisWaktu}
      </div>
    );
  }

  const n = nilai.length;
  const hasilTeks = (h: { ketemu: boolean; indeks: number | null }) => (h.ketemu ? `ketemu di A[${h.indeks! + 1}]` : "tidak ada");

  return (
    <div className="grid gap-6 lg:h-full lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:grid-rows-[minmax(0,1fr)]">
      {/* ── Panel kiri: visual & narasi ─────────────────────────── */}
      <section aria-label="Visualisasi pencarian" className="lab-pane flex min-w-0 flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:pr-3">
        {judul}
        <div className="z-30 -mx-1 flex flex-col gap-2 bg-paper/90 px-1 py-1 backdrop-blur-md lg:sticky lg:top-0">
          {bilah}
          {narasi}
        </div>
        {papan}
        {garisWaktu}
        {pemutar.hematGerak && (
          <p className="text-xs text-ink-muted">Mode hemat gerak aktif: pemutaran otomatis dimatikan, gunakan tombol langkah (‹ ›).</p>
        )}
        <DaftarPintasan />
      </section>

      {/* ── Panel kanan: data, kode, penjelasan ─────────────────── */}
      <aside aria-label="Data dan penjelasan pencarian" className="lab-pane flex min-w-0 flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
        <section className="bg-paper-card p-5">
          <p className={LABEL_SEKSI}>Data</p>
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              terapkan();
            }}
          >
            <input
              value={teksData}
              onChange={(e) => setTeksData(e.target.value)}
              aria-label={`Data, maksimal ${CARI_MAX_DATA} angka`}
              aria-invalid={galat !== null}
              placeholder="mis. 38, 27, 43, 3"
              className={ISIAN}
            />
            <div className="flex gap-2">
              <label className="flex flex-1 items-center gap-2 text-sm text-ink-body">
                Cari
                <input
                  value={teksCari}
                  onChange={(e) => setTeksCari(e.target.value)}
                  inputMode="numeric"
                  aria-label="Nilai yang dicari"
                  className={cn(ISIAN, "w-full")}
                />
              </label>
              <button type="submit" className="bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Pakai
              </button>
            </div>
          </form>
          {galat ? (
            <p role="status" className="mt-2 text-xs text-error-text">
              {galat}
            </p>
          ) : (
            <p className="mt-2 text-xs text-ink-faint">2-{CARI_MAX_DATA} bilangan bulat 0-999, dipisah koma atau spasi.</p>
          )}

          <div className="mt-4 flex flex-wrap gap-1">
            {CONTOH_CARI.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.ket}
                onClick={() => gantiData([...c.nilai], c.dicari, c.id)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  kasus === c.id ? "bg-blue-600 text-white" : "bg-white/[0.06] text-ink-body hover:bg-white/10",
                )}
              >
                {c.nama}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const a = dataAcak(Math.floor(Math.random() * 2 ** 32));
                gantiData(a.nilai, a.dicari, null);
              }}
              className="bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-ink-body transition-colors hover:bg-white/10"
            >
              Acak baru
            </button>
          </div>
          {kasus && <p className="mt-2 text-xs text-ink-muted">{CONTOH_CARI.find((c) => c.id === kasus)?.ket}</p>}
        </section>

        <section className="grid grid-cols-2 gap-1">
          <div className="bg-paper-card px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Perbandingan</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-ink">{l.banding}</p>
          </div>
          <div className="bg-paper-card px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Paling banyak</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-ink-muted">{algo === "linear" ? n : maksBinary(n)}</p>
            <p className="mt-0.5 text-[11px] text-ink-faint">{algo === "linear" ? "= n" : "= ⌊log₂ n⌋ + 1"}</p>
          </div>
        </section>

        {pemutar.frame >= terakhir && (
          <section className="lab-fade-up bg-paper-card p-5 shadow-[inset_3px_0_0_var(--color-blue-400)]">
            <p className={LABEL_SEKSI}>Bandingkan untuk data ini</p>
            <dl className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1.5 text-sm">
              <dt />
              <dd className="text-right text-[11px] uppercase tracking-wider text-ink-faint">Banding</dd>
              <dd className="text-right text-[11px] uppercase tracking-wider text-ink-faint">Hasil</dd>
              <dt className={algo === "linear" ? "font-semibold text-ink" : "text-ink-body"}>Linear search</dt>
              <dd className="text-right tabular-nums text-ink">{rekLinear.banding}</dd>
              <dd className="text-right text-ink-body">{hasilTeks(rekLinear.hasil)}</dd>
              <dt className={algo === "binary" ? "font-semibold text-ink" : "text-ink-body"}>Binary search</dt>
              <dd className="text-right tabular-nums text-ink">{rekBinary.banding}</dd>
              <dd className="text-right text-ink-body">{rekBinary.hasil.ketemu ? "ketemu*" : "tidak ada"}</dd>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-ink-muted">
              *Posisi binary search dihitung pada data yang sudah diurutkan. Binary search hampir selalu lebih sedikit
              membandingkan, tetapi datanya harus urut dulu - dan mengurutkan juga butuh kerja.
            </p>
          </section>
        )}

        <section className="bg-paper-card p-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Pseudocode 9618</p>
            <p className="text-[11px] text-ink-faint">bisa dicoba di Lab 05</p>
          </div>
          <KodeSorotBaca kode={algo === "linear" ? KODE_LINEAR : KODE_BINARY} dari={l.baris} sampai={l.sampai} />
        </section>

        <section className="bg-paper-card p-5">
          <p className={LABEL_SEKSI}>Ide {info.nama.toLowerCase()}</p>
          <ol className="space-y-2 text-sm leading-relaxed text-ink-body">
            {info.ide.map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-4 shrink-0 font-semibold tabular-nums text-blue-300">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-ink-muted">{info.kompleksitas}</p>
        </section>

        <section className="bg-paper-card p-5">
          <p className={LABEL_SEKSI}>Arti warna</p>
          <ul className="space-y-2 text-sm text-ink-body">
            {LEGENDA.map((g) => (
              <li key={g.arti} className="flex items-center gap-3">
                <span aria-hidden="true" className={cn("h-3.5 w-6 shrink-0", g.warna)} />
                {g.arti}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
