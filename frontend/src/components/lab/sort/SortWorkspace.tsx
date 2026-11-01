"use client";
import { useEffect, useMemo, useState } from "react";
import ShareLabButton from "../ShareLabButton";
import { IKON, Ikon, Kelompok, TOMBOL } from "../LabAlat";
import PapanBubble from "./PapanBubble";
import PohonMerge from "./PohonMerge";
import KodeSorotBaca from "./KodeSorotBaca";
import { useLabPlayer } from "@/lib/useLabPlayer";
import { rekamBubble } from "@/lib/lab/sort/sortBubble";
import { rekamMerge } from "@/lib/lab/sort/sortMerge";
import { kodeBubble, kodeMerge } from "@/lib/lab/sort/sortKode";
import { CONTOH_KASUS, DATA_BAWAAN, dataAcak, uraiData } from "@/lib/lab/sort/sortData";
import { encodeSort, SORT_URL_PARAM, type IsiSort } from "@/lib/lab/sort/sortUrl";
import { KECEPATAN_SORT, SORT_MAX_DATA, type AlgoSort, type ArahSort, type LangkahBubble, type LangkahMerge } from "@/lib/lab/sort/sortTypes";
import { cn } from "@/lib/cn";

const INFO_ALGO: Record<AlgoSort, { nama: string; ide: string[]; kompleksitas: string; pindah: string }> = {
  bubble: {
    nama: "Bubble sort",
    ide: [
      "Bandingkan dua nilai yang bersebelahan, tukar bila urutannya terbalik.",
      "Satu putaran membawa nilai terbesar ke ujung kanan - seperti gelembung yang naik.",
      "Setiap putaran berikutnya satu pasangan lebih pendek.",
      "Bila satu putaran berjalan tanpa pertukaran, data sudah urut dan perulangan berhenti.",
    ],
    kompleksitas: "O(n²) - terbaik O(n) bila data sudah urut.",
    pindah: "Pertukaran",
  },
  merge: {
    nama: "Merge sort",
    ide: [
      "Bagi data menjadi dua di tengah, terus-menerus, sampai setiap bagian tinggal satu elemen.",
      "Satu elemen selalu sudah urut.",
      "Gabungkan dua bagian urut: bandingkan elemen terdepan masing-masing, ambil yang lebih kecil ke array bantu.",
      "Ulangi penggabungan naik sampai seluruh data menjadi satu bagian urut.",
    ],
    kompleksitas: "O(n log n) untuk data apa pun, dengan memori tambahan untuk array bantu.",
    pindah: "Penyalinan",
  },
};

const LEGENDA: Record<AlgoSort, { warna: string; arti: string }[]> = {
  bubble: [
    { warna: "bg-blue-300", arti: "sedang dibandingkan (j dan j+1)" },
    { warna: "bg-amber-500", arti: "baru saja ditukar" },
    { warna: "bg-blue-600", arti: "sudah di tempat akhirnya" },
    { warna: "bg-white/[0.16]", arti: "belum final" },
  ],
  merge: [
    { warna: "bg-white/[0.2]", arti: "belum urut / menunggu" },
    { warna: "bg-blue-300", arti: "sedang digabung (diisi satu per satu, k)" },
    { warna: "bg-blue-600", arti: "bagian yang sudah urut" },
    { warna: "bg-white/[0.06] shadow-[inset_0_0_0_1px_var(--color-blue-400)]", arti: "slot array bantu yang belum terisi" },
  ],
};

const LABEL_SEKSI = "mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted";

/**
 * Ruang kerja Lab 06 Sorting: bubble sort & merge sort, langkah demi langkah.
 *
 * Kedua algoritma direkam SEKALI dari data yang sama (rekaman murah: ≤ 12
 * elemen), lalu satu `useLabPlayer` memutar algoritma yang dipilih. Karena
 * datanya sama, ringkasan di akhir bisa membandingkan kerja keduanya.
 *
 * Mengganti data/algoritma/arah selalu kembali ke langkah pertama TANPA
 * memutar otomatis: guru biasanya ingin menjelaskan dulu sebelum menekan Putar.
 */
export default function SortWorkspace({
  awal,
  judul,
  aktif,
  onJalan,
}: {
  awal: IsiSort | null;
  judul: React.ReactNode;
  aktif: boolean;
  /** Dipanggil saat pengguna mulai memakai lab (menyembunyikan pemberitahuan tautan rusak). */
  onJalan: () => void;
}) {
  const [algo, setAlgo] = useState<AlgoSort>(awal?.algo ?? "bubble");
  const [arah, setArah] = useState<ArahSort>(awal?.arah ?? "naik");
  const [nilai, setNilai] = useState<number[]>(() => awal?.nilai ?? [...DATA_BAWAAN]);
  const [teks, setTeks] = useState(() => (awal?.nilai ?? DATA_BAWAAN).join(", "));
  const [galat, setGalat] = useState<string | null>(null);
  const [kasus, setKasus] = useState<string | null>(awal ? null : "acak");
  const [presentasi, setPresentasi] = useState(false);

  const rekBubble = useMemo(() => rekamBubble(nilai, arah), [nilai, arah]);
  const rekMerge = useMemo(() => rekamMerge(nilai, arah), [nilai, arah]);
  const langkah: (LangkahBubble | LangkahMerge)[] = algo === "bubble" ? rekBubble.langkah : rekMerge.langkah;
  const pemutar = useLabPlayer(langkah);
  const l = langkah[pemutar.frame];
  const terakhir = langkah.length - 1;
  const info = INFO_ALGO[algo];
  const kode = useMemo(() => (algo === "bubble" ? kodeBubble(arah) : kodeMerge(arah)), [algo, arah]);

  function gantiData(baru: number[], idKasus: string | null) {
    setNilai(baru);
    setTeks(baru.join(", "));
    setGalat(null);
    setKasus(idKasus);
    pemutar.keLangkah(0);
    onJalan();
  }

  function terapkanTeks() {
    const h = uraiData(teks);
    if (!h.ok) return setGalat(h.galat);
    gantiData(h.nilai, null);
  }

  function pilihAlgo(a: AlgoSort) {
    setAlgo(a);
    pemutar.keLangkah(0);
    onJalan();
  }

  function putarAtauJeda() {
    if (pemutar.memutar) return pemutar.jeda();
    // Di ujung, Putar berarti "putar ulang dari awal".
    if (pemutar.frame >= terakhir) pemutar.keLangkah(0);
    pemutar.putar();
    onJalan();
  }

  // Pintasan keyboard — hanya saat lab ini yang tampil, dan tidak saat mengetik
  // atau saat fokus di tombol (Spasi di tombol sudah menekan tombol itu).
  useEffect(() => {
    if (!aktif) return;
    const tekan = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable='true']") || (e.key === " " && t.closest("button, summary")))) return;
      if (e.key === "Escape" && presentasi) setPresentasi(false);
      else if (e.key === " ") putarAtauJeda();
      else if (e.key === "ArrowRight") pemutar.maju();
      else if (e.key === "ArrowLeft") pemutar.mundur();
      else if (e.key === "Home") pemutar.keLangkah(0);
      else if (e.key === "End") pemutar.keLangkah(terakhir);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  });

  if (!l) return null;
  const dataTampil = nilai.join(", ");

  const tablist = (
    <div role="tablist" aria-label="Algoritma pengurutan" className="flex bg-paper-card p-1">
      {(["bubble", "merge"] as const).map((a) => {
        const dipilih = a === algo;
        return (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={dipilih}
            onClick={() => pilihAlgo(a)}
            className={cn(
              "px-4 py-1.5 text-sm font-semibold transition-colors duration-200",
              dipilih ? "bg-blue-600 text-white" : "text-ink-muted hover:bg-white/10 hover:text-ink",
            )}
          >
            {INFO_ALGO[a].nama}
          </button>
        );
      })}
    </div>
  );

  const bilah = (
    <div className="flex flex-wrap items-center gap-2">
      {tablist}
      <Kelompok label="Pemutar">
        <button type="button" className={TOMBOL} onClick={() => pemutar.keLangkah(0)} disabled={pemutar.frame === 0} title="Ke awal (Home)" aria-label="Ke awal">
          ⏮
        </button>
        <button type="button" className={TOMBOL} onClick={pemutar.mundur} disabled={pemutar.frame === 0} title="Langkah sebelumnya (←)" aria-label="Langkah sebelumnya">
          ‹
        </button>
        <button
          type="button"
          onClick={putarAtauJeda}
          disabled={pemutar.hematGerak}
          title={pemutar.hematGerak ? "Hemat gerak aktif: pakai tombol langkah" : "Putar / jeda (Spasi)"}
          className={cn(TOMBOL, "min-w-[5.5rem] justify-center bg-blue-600 font-semibold text-white hover:bg-blue-700")}
        >
          {!pemutar.hematGerak && <Ikon d={pemutar.memutar ? IKON.henti : IKON.putar} />}
          {pemutar.memutar ? "Jeda" : pemutar.frame >= terakhir ? "Ulangi" : "Putar"}
        </button>
        <button type="button" className={TOMBOL} onClick={pemutar.maju} disabled={pemutar.frame >= terakhir} title="Langkah berikutnya (→)" aria-label="Langkah berikutnya">
          ›
        </button>
        <button type="button" className={TOMBOL} onClick={() => pemutar.keLangkah(terakhir)} disabled={pemutar.frame >= terakhir} title="Ke akhir (End)" aria-label="Ke akhir">
          ⏭
        </button>
        <select
          aria-label="Kecepatan"
          value={pemutar.kecepatan}
          onChange={(e) => pemutar.setKecepatan(Number(e.target.value))}
          className="bg-transparent px-1 py-1 text-sm text-ink-body focus:outline-none"
        >
          {KECEPATAN_SORT.map((k) => (
            <option key={k} value={k}>
              {String(k).replace(".", ",")}×
            </option>
          ))}
        </select>
      </Kelompok>
      <div className="ml-auto flex items-center gap-2">
        <ShareLabButton param={SORT_URL_PARAM} kode={() => encodeSort({ algo, arah, nilai })} />
        <button type="button" className={TOMBOL} onClick={() => setPresentasi((p) => !p)} title="Layar penuh (Esc untuk keluar)">
          <Ikon d={IKON.layar} />
          <span className="hidden sm:inline">{presentasi ? "Keluar" : "Layar penuh"}</span>
        </button>
      </div>
    </div>
  );

  const narasi = (
    <div className="bg-paper-card px-5 py-4" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-300">{l.fase}</p>
        <p className="text-xs tabular-nums text-ink-muted">
          Langkah {pemutar.frame + 1} / {langkah.length}
        </p>
      </div>
      <p key={pemutar.frame} className="lab-fade-up mt-1.5 text-[15px] leading-relaxed text-ink">
        {l.narasi}
      </p>
    </div>
  );

  const papan = (
    <div style={{ "--lab-gerak": `${Math.round(1000 / pemutar.kecepatan)}ms` } as React.CSSProperties}>
      {algo === "bubble" ? <PapanBubble langkah={l as LangkahBubble} /> : <PohonMerge langkah={l as LangkahMerge} />}
    </div>
  );

  const garisWaktu = (
    <label className="flex items-center gap-3 text-xs text-ink-muted">
      <span className="shrink-0">Garis waktu</span>
      <input
        type="range"
        min={0}
        max={terakhir}
        value={pemutar.frame}
        onChange={(e) => pemutar.keLangkah(Number(e.target.value))}
        className="range-tipis w-full"
        aria-label="Pilih langkah"
      />
    </label>
  );

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

  const penghitung = [
    { label: "Perbandingan", nilai: l.banding },
    { label: info.pindah, nilai: l.pindah },
  ];

  return (
    <div className="grid gap-6 lg:h-full lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:grid-rows-[minmax(0,1fr)]">
      {/* ── Panel kiri: visual & narasi ─────────────────────────── */}
      <section aria-label="Visualisasi pengurutan" className="lab-pane flex min-w-0 flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:pr-3">
        {judul}

        {/* Bilah alat & narasi menempel di atas saat papan yang tinggi digulir. */}
        <div className="z-30 -mx-1 flex flex-col gap-2 bg-paper/90 px-1 py-1 backdrop-blur-md lg:sticky lg:top-0">
          {bilah}
          {narasi}
        </div>

        {papan}
        {garisWaktu}

        {pemutar.hematGerak && (
          <p className="text-xs text-ink-muted">Mode hemat gerak aktif: pemutaran otomatis dimatikan, gunakan tombol langkah (‹ ›).</p>
        )}

        <details className="group bg-paper-card px-5 py-3 text-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between text-ink-body">
            Tombol pintas keyboard
            <span aria-hidden="true" className="text-ink-faint transition-transform duration-200 group-open:rotate-180">
              ▾
            </span>
          </summary>
          <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-xs text-ink-muted sm:grid-cols-2">
            {[
              ["Spasi", "putar atau jeda"],
              ["← / →", "langkah mundur / maju"],
              ["Home / End", "ke awal / ke akhir"],
              ["Esc", "keluar layar penuh"],
            ].map(([tombol, arti]) => (
              <li key={tombol} className="flex items-center gap-2">
                <kbd className="bg-white/10 px-1.5 py-0.5 font-sans text-[11px] text-ink">{tombol}</kbd>
                {arti}
              </li>
            ))}
          </ul>
        </details>
      </section>

      {/* ── Panel kanan: data, kode, penjelasan ─────────────────── */}
      <aside aria-label="Data dan penjelasan" className="lab-pane flex min-w-0 flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
        <section className="bg-paper-card p-5">
          <p className={LABEL_SEKSI}>Data</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              terapkanTeks();
            }}
          >
            <input
              value={teks}
              onChange={(e) => setTeks(e.target.value)}
              aria-label={`Data, maksimal ${SORT_MAX_DATA} angka`}
              aria-invalid={galat !== null}
              placeholder="mis. 38, 27, 43, 3"
              className="min-w-0 flex-1 bg-white/[0.06] px-3 py-2 text-sm tabular-nums text-ink placeholder:text-ink-faint focus:outline-none focus:shadow-[inset_0_-2px_0_var(--color-blue-500)]"
            />
            <button type="submit" className="bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
              Pakai
            </button>
          </form>
          {galat ? (
            <p role="status" className="mt-2 text-xs text-error-text">
              {galat}
            </p>
          ) : (
            <p className="mt-2 text-xs text-ink-faint">2-{SORT_MAX_DATA} bilangan bulat 0-999, dipisah koma atau spasi.</p>
          )}

          <div className="mt-4 flex flex-wrap gap-1">
            {CONTOH_KASUS.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.ket}
                onClick={() => gantiData([...c.nilai], c.id)}
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
              onClick={() => gantiData(dataAcak(Math.floor(Math.random() * 2 ** 32)), null)}
              className="bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-ink-body transition-colors hover:bg-white/10"
            >
              Acak baru
            </button>
          </div>
          {kasus && <p className="mt-2 text-xs text-ink-muted">{CONTOH_KASUS.find((c) => c.id === kasus)?.ket}</p>}

          <label className="mt-4 flex items-center justify-between gap-3 text-sm text-ink-body">
            Arah urut
            <select
              value={arah}
              onChange={(e) => {
                setArah(e.target.value as ArahSort);
                pemutar.keLangkah(0);
                onJalan();
              }}
              className="bg-white/[0.06] px-2 py-1.5 text-sm text-ink focus:outline-none"
            >
              <option value="naik">Naik (kecil → besar)</option>
              <option value="turun">Turun (besar → kecil)</option>
            </select>
          </label>
        </section>

        <section className="grid grid-cols-2 gap-1">
          {penghitung.map((p) => (
            <div key={p.label} className="bg-paper-card px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">{p.label}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-ink">{p.nilai}</p>
            </div>
          ))}
        </section>

        {pemutar.frame >= terakhir && (
          <section className="lab-fade-up bg-paper-card p-5 shadow-[inset_3px_0_0_var(--color-blue-400)]">
            <p className={LABEL_SEKSI}>Bandingkan untuk data ini</p>
            <p className="mb-3 text-xs text-ink-muted">[{dataTampil}]</p>
            <dl className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-ink-muted" />
              <dd className="text-right text-[11px] uppercase tracking-wider text-ink-faint">Banding</dd>
              <dd className="text-right text-[11px] uppercase tracking-wider text-ink-faint">Pindah</dd>
              <dt className={algo === "bubble" ? "font-semibold text-ink" : "text-ink-body"}>Bubble sort</dt>
              <dd className="text-right tabular-nums text-ink">{rekBubble.banding}</dd>
              <dd className="text-right tabular-nums text-ink">{rekBubble.pindah}</dd>
              <dt className={algo === "merge" ? "font-semibold text-ink" : "text-ink-body"}>Merge sort</dt>
              <dd className="text-right tabular-nums text-ink">{rekMerge.banding}</dd>
              <dd className="text-right tabular-nums text-ink">{rekMerge.pindah}</dd>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-ink-muted">
              &quot;Pindah&quot; = pertukaran pada bubble sort, penyalinan ke array bantu pada merge sort. Coba contoh &quot;Sudah urut&quot; dan
              &quot;Terbalik&quot; untuk melihat kapan masing-masing unggul.
            </p>
          </section>
        )}

        <section className="bg-paper-card p-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Pseudocode 9618</p>
            <p className="text-[11px] text-ink-faint">bisa dicoba di Lab 05</p>
          </div>
          <KodeSorotBaca kode={kode} dari={l.baris} sampai={l.sampai} />
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
            {LEGENDA[algo].map((g) => (
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
