"use client";
import { useState } from "react";
import { bentukSimpul } from "@/lib/lab/flowGeometri";
import { RONA_JENIS } from "@/lib/lab/flowSvg";
import { tampilNilai, namaJenis } from "@/lib/lab/flowEkspresi";
import type { Temuan } from "@/lib/lab/flowPeriksa";
import type { KeadaanJalan } from "@/lib/lab/flowJalan";
import {
  FLOW_MAX_LABEL,
  FLOW_MAX_TEKS,
  FLOW_MAX_UKURAN,
  FLOW_MIN_UKURAN,
  INFO_JENIS,
  JENIS_SIMPUL,
  SISI,
  type Diagram,
  type Garis,
  type JenisSimpul,
  type Simpul,
  type Sisi,
} from "@/lib/lab/flowTypes";
import type { Pilihan } from "./FlowCanvas";
import { cn } from "@/lib/cn";

export type TabPanel = "simbol" | "properti" | "periksa" | "jalankan";

const KOLOM = "w-full bg-white/[0.06] px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:shadow-[inset_0_-2px_0_var(--color-blue-500)]";
const TOMBOL = "inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-ink-body transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";
const TOMBOL_UTAMA = "inline-flex items-center justify-center gap-1.5 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";
const LABEL = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted";
const NAMA_SISI: Record<Sisi, string> = { atas: "Atas", kanan: "Kanan", bawah: "Bawah", kiri: "Kiri" };

/** Gambar mini sebuah jenis simbol untuk palet & pilihan jenis. */
export function IkonJenis({ jenis, className }: { jenis: JenisSimpul; className?: string }) {
  const kotak = jenis === "konektor" ? { x: 9, y: 2, w: 20, h: 20 } : jenis === "keputusan" ? { x: 3, y: 1, w: 32, h: 22 } : { x: 2, y: 4, w: 34, h: 16 };
  const b = bentukSimpul({ jenis, ...kotak });
  const rona = RONA_JENIS[jenis];
  return (
    <svg viewBox="0 0 38 24" className={cn("h-6 w-10 shrink-0", className)} aria-hidden="true">
      <path d={b.d} fill={b.tanpaIsi ? "none" : `color-mix(in srgb, ${rona} 25%, transparent)`} stroke={b.tanpaIsi ? "none" : rona} strokeWidth={1.4} />
      {b.tambahan && <path d={b.tambahan} fill="none" stroke={rona} strokeWidth={1.4} />}
    </svg>
  );
}

export interface AksiPanel {
  onTambah: (jenis: JenisSimpul) => void;
  onUbahTeks: (id: number, teks: string) => void;
  onUbahJenis: (id: number, jenis: JenisSimpul) => void;
  onUbahUkuran: (id: number, w: number, h: number) => void;
  onUbahGaris: (id: number, ubah: Partial<Pick<Garis, "label" | "dariSisi" | "keSisi">>) => void;
  onBalikGaris: (id: number) => void;
  onHapus: () => void;
  onDuplikat: () => void;
  onPilih: (p: Pilihan) => void;
  onMulaiJalan: (masukan: string) => void;
}

/**
 * Panel kanan ruang kerja flowchart: palet simbol, properti pilihan, hasil
 * pemeriksa aturan, dan mode Jalankan.
 */
export default function FlowPanel({
  tab,
  onTab,
  diagram,
  pilihan,
  temuan,
  bisaSunting,
  aksi,
  jalanan,
}: {
  tab: TabPanel;
  onTab: (t: TabPanel) => void;
  diagram: Diagram;
  pilihan: Pilihan;
  temuan: Temuan[];
  bisaSunting: boolean;
  aksi: AksiPanel;
  /** Isi tab Jalankan saat sedang berjalan (dirender ruang kerja). */
  jalanan: React.ReactNode;
}) {
  const jumlahGalat = temuan.filter((t) => t.tingkat === "galat").length;
  const TAB: { id: TabPanel; label: string; lencana?: number }[] = [
    { id: "simbol", label: "Simbol" },
    { id: "properti", label: "Properti" },
    { id: "periksa", label: "Periksa", lencana: temuan.length },
    { id: "jalankan", label: "Jalankan" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Panel flowchart" className="grid grid-cols-4 bg-paper-card p-1">
        {TAB.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => onTab(t.id)}
            className={cn(
              "relative px-2 py-1.5 text-sm font-semibold transition-colors",
              tab === t.id ? "bg-blue-600 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            {t.label}
            {t.lencana ? (
              <span
                className={cn(
                  "ml-1 inline-flex min-w-[1.25rem] justify-center px-1 text-[10px] tabular-nums",
                  t.id === "periksa" && jumlahGalat > 0 ? "bg-[#E0795A] text-white" : "bg-white/15",
                )}
              >
                {t.lencana}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "simbol" && <TabSimbol bisaSunting={bisaSunting} onTambah={aksi.onTambah} />}
      {tab === "properti" && <TabProperti diagram={diagram} pilihan={pilihan} bisaSunting={bisaSunting} aksi={aksi} />}
      {tab === "periksa" && <TabPeriksa temuan={temuan} onPilih={aksi.onPilih} />}
      {tab === "jalankan" && (jalanan ?? <TabMulaiJalan jumlahGalat={jumlahGalat} onMulai={aksi.onMulaiJalan} adaSimbol={diagram.simpul.length > 0} />)}
    </div>
  );
}

function TabSimbol({ bisaSunting, onTambah }: { bisaSunting: boolean; onTambah: (j: JenisSimpul) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-ink-muted">Seret simbol ke kanvas, atau klik untuk menaruhnya di tengah tampilan.</p>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {JENIS_SIMPUL.map((j) => (
          <li key={j}>
            <button
              type="button"
              draggable={bisaSunting}
              disabled={!bisaSunting}
              onDragStart={(e) => {
                e.dataTransfer.setData("application/x-flow-jenis", j);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => onTambah(j)}
              title={INFO_JENIS[j].ket}
              className="flex w-full items-center gap-2.5 bg-paper-card px-2.5 py-2 text-left transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IkonJenis jenis={j} />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{INFO_JENIS[j].nama}</span>
                <span className="block truncate text-[11px] text-ink-muted">{INFO_JENIS[j].ket}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <details className="group bg-paper-card px-4 py-3 text-xs text-ink-muted">
        <summary className="cursor-pointer list-none text-sm text-ink-body">Cara memakai kanvas ▾</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4 leading-relaxed">
          <li>Arahkan ke simbol → muncul bulatan biru. Seret bulatan ke simbol lain untuk menyambung.</li>
          <li>Klik ganda simbol untuk mengubah teksnya (Ctrl+Enter menyimpan), klik ganda garis untuk labelnya.</li>
          <li>Seret area kosong untuk menggeser kanvas; Shift+seret untuk memilih beberapa simbol.</li>
          <li>Roda mouse menggeser, Ctrl+roda memperbesar.</li>
          <li>Del menghapus, Ctrl+D menggandakan, Ctrl+Z/Ctrl+Y batal/ulangi, panah menggeser simbol terpilih.</li>
        </ul>
      </details>
    </div>
  );
}

function TabProperti({ diagram, pilihan, bisaSunting, aksi }: { diagram: Diagram; pilihan: Pilihan; bisaSunting: boolean; aksi: AksiPanel }) {
  const simpul = diagram.simpul.filter((s) => pilihan.simpul.has(s.id));
  const garis = diagram.garis.filter((g) => pilihan.garis.has(g.id));

  if (simpul.length === 0 && garis.length === 0) {
    return (
      <p className="bg-paper-card px-4 py-6 text-center text-sm text-ink-muted">
        Pilih simbol atau garis di kanvas untuk menyunting propertinya.
        <span className="mt-2 block text-xs">
          {diagram.simpul.length} simbol · {diagram.garis.length} garis
        </span>
      </p>
    );
  }
  if (simpul.length === 1 && garis.length === 0) {
    return <PropertiSimpul key={`${simpul[0].id}-${simpul[0].teks}-${simpul[0].w}-${simpul[0].h}`} s={simpul[0]} bisaSunting={bisaSunting} aksi={aksi} />;
  }
  if (garis.length === 1 && simpul.length === 0) {
    return <PropertiGaris key={`${garis[0].id}-${garis[0].label}`} g={garis[0]} diagram={diagram} bisaSunting={bisaSunting} aksi={aksi} />;
  }
  return (
    <div className="flex flex-col gap-3 bg-paper-card p-4">
      <p className="text-sm text-ink-body">
        {simpul.length} simbol dan {garis.length} garis terpilih.
      </p>
      <div className="flex gap-2">
        <button type="button" className={TOMBOL} onClick={aksi.onDuplikat} disabled={!bisaSunting || simpul.length === 0}>
          Gandakan
        </button>
        <button type="button" className={cn(TOMBOL, "hover:text-error-text")} onClick={aksi.onHapus} disabled={!bisaSunting}>
          Hapus
        </button>
      </div>
    </div>
  );
}

function PropertiSimpul({ s, bisaSunting, aksi }: { s: Simpul; bisaSunting: boolean; aksi: AksiPanel }) {
  // Teks & ukuran dipegang lokal dan baru diterapkan saat fokus pergi:
  // menerapkannya tiap ketukan akan membuat satu entri undo per huruf.
  const [teks, setTeks] = useState(s.teks);
  const [w, setW] = useState(String(s.w));
  const [h, setH] = useState(String(s.h));
  const terapkanUkuran = () => {
    const nw = Number(w);
    const nh = Number(h);
    if (Number.isFinite(nw) && Number.isFinite(nh) && (nw !== s.w || nh !== s.h)) aksi.onUbahUkuran(s.id, nw, nh);
  };

  return (
    <div className="flex flex-col gap-4 bg-paper-card p-4">
      <div>
        <label htmlFor="flow-jenis" className={LABEL}>
          Jenis simbol
        </label>
        <select
          id="flow-jenis"
          value={s.jenis}
          disabled={!bisaSunting}
          onChange={(e) => aksi.onUbahJenis(s.id, e.target.value as JenisSimpul)}
          className={KOLOM}
        >
          {JENIS_SIMPUL.map((j) => (
            <option key={j} value={j}>
              {INFO_JENIS[j].nama}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-ink-muted">{INFO_JENIS[s.jenis].ket}</p>
      </div>
      <div>
        <label htmlFor="flow-teks" className={LABEL}>
          Teks
        </label>
        <textarea
          id="flow-teks"
          value={teks}
          maxLength={FLOW_MAX_TEKS}
          rows={3}
          disabled={!bisaSunting}
          onChange={(e) => setTeks(e.target.value)}
          onBlur={() => teks !== s.teks && aksi.onUbahTeks(s.id, teks)}
          className={cn(KOLOM, "resize-y font-mono text-[13px]")}
        />
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{PETUNJUK_TEKS[s.jenis]}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["Lebar", w, setW, "flow-w"],
            ["Tinggi", h, setH, "flow-h"],
          ] as const
        ).map(([label, nilai, setel, id]) => (
          <div key={id}>
            <label htmlFor={id} className={LABEL}>
              {label}
            </label>
            <input
              id={id}
              type="number"
              min={FLOW_MIN_UKURAN}
              max={FLOW_MAX_UKURAN}
              step={10}
              value={nilai}
              disabled={!bisaSunting}
              onChange={(e) => setel(e.target.value)}
              onBlur={terapkanUkuran}
              onKeyDown={(e) => e.key === "Enter" && terapkanUkuran()}
              className={KOLOM}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" className={TOMBOL} onClick={aksi.onDuplikat} disabled={!bisaSunting}>
          Gandakan
        </button>
        <button type="button" className={cn(TOMBOL, "hover:text-error-text")} onClick={aksi.onHapus} disabled={!bisaSunting}>
          Hapus
        </button>
      </div>
    </div>
  );
}

const PETUNJUK_TEKS: Record<JenisSimpul, string> = {
  mulai: "Biasanya cukup “Mulai”.",
  selesai: "Biasanya cukup “Selesai”.",
  proses: "Penugasan, satu per baris: total = total + i. Bisa juga ←, +=, ++.",
  io: "Input: Baca n  ·  Output: Tampilkan \"Hasil =\", x",
  keputusan: "Kondisi benar/salah: n mod 2 = 0?  ·  i <= n dan x > 0",
  persiapan: "Inisialisasi, satu per baris: i = 1",
  subproses: "Nama prosedur (dilewati saat dijalankan), atau penugasan yang ingin dijalankan.",
  konektor: "Label pasangan, mis. A. Konektor tanpa garis keluar melompat ke konektor berlabel sama.",
  dokumen: "Keterangan dokumen. Tidak dijalankan.",
  data: "Keterangan penyimpanan. Tidak dijalankan.",
  catatan: "Keterangan bebas; tidak ikut alur.",
};

function PropertiGaris({ g, diagram, bisaSunting, aksi }: { g: Garis; diagram: Diagram; bisaSunting: boolean; aksi: AksiPanel }) {
  const [label, setLabel] = useState(g.label);
  const dari = diagram.simpul.find((s) => s.id === g.dari);
  const ke = diagram.simpul.find((s) => s.id === g.ke);
  return (
    <div className="flex flex-col gap-4 bg-paper-card p-4">
      <p className="text-sm text-ink-body">
        Garis dari <b className="text-ink">{dari?.teks || dari?.jenis}</b> ke <b className="text-ink">{ke?.teks || ke?.jenis}</b>
      </p>
      <div>
        <label htmlFor="flow-label" className={LABEL}>
          Label
        </label>
        <div className="flex gap-1">
          {["Ya", "Tidak"].map((l) => (
            <button
              key={l}
              type="button"
              disabled={!bisaSunting}
              onClick={() => {
                setLabel(l);
                aksi.onUbahGaris(g.id, { label: l });
              }}
              className={cn(TOMBOL, "bg-white/[0.06]", g.label === l && "bg-blue-600 text-white hover:bg-blue-700")}
            >
              {l}
            </button>
          ))}
          <input
            id="flow-label"
            value={label}
            maxLength={FLOW_MAX_LABEL}
            disabled={!bisaSunting}
            placeholder="tanpa label"
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => label !== g.label && aksi.onUbahGaris(g.id, { label })}
            className={KOLOM}
          />
        </div>
        {dari?.jenis === "keputusan" && <p className="mt-1 text-xs text-ink-muted">Cabang keputusan harus berlabel Ya atau Tidak.</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["Keluar dari sisi", "dariSisi", g.dariSisi],
            ["Masuk ke sisi", "keSisi", g.keSisi],
          ] as const
        ).map(([judul, kunci, nilai]) => (
          <div key={kunci}>
            <label className={LABEL}>{judul}</label>
            <select value={nilai} disabled={!bisaSunting} onChange={(e) => aksi.onUbahGaris(g.id, { [kunci]: e.target.value as Sisi })} className={KOLOM}>
              {SISI.map((s) => (
                <option key={s} value={s}>
                  {NAMA_SISI[s]}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={TOMBOL} onClick={() => aksi.onBalikGaris(g.id)} disabled={!bisaSunting}>
          Balik arah
        </button>
        <button type="button" className={cn(TOMBOL, "hover:text-error-text")} onClick={aksi.onHapus} disabled={!bisaSunting}>
          Hapus garis
        </button>
      </div>
    </div>
  );
}

function TabPeriksa({ temuan, onPilih }: { temuan: Temuan[]; onPilih: (p: Pilihan) => void }) {
  if (temuan.length === 0) {
    return (
      <div className="bg-paper-card px-4 py-6 text-center">
        <p className="text-sm font-semibold text-ink">Tidak ada masalah</p>
        <p className="mt-1 text-xs text-ink-muted">Flowchart ini mengikuti aturan: satu Mulai, alur tersambung sampai Selesai, cabang berlabel.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-ink-muted">Klik sebuah temuan untuk memilih simbol yang bersangkutan.</p>
      <ul className="flex flex-col gap-1.5">
        {temuan.map((t, i) => (
          <li key={`${t.kode}-${i}`}>
            <button
              type="button"
              onClick={() => onPilih({ simpul: new Set(t.simpul), garis: new Set(t.garis) })}
              className="flex w-full items-start gap-2.5 bg-paper-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/10"
            >
              <span
                className={cn(
                  "mt-0.5 shrink-0 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  t.tingkat === "galat" ? "bg-[#E0795A]/20 text-error-text" : "bg-amber-500/15 text-warn-text",
                )}
              >
                {t.tingkat === "galat" ? "Galat" : "Saran"}
              </span>
              <span className="text-ink-body">{t.pesan}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabMulaiJalan({ jumlahGalat, adaSimbol, onMulai }: { jumlahGalat: number; adaSimbol: boolean; onMulai: (masukan: string) => void }) {
  const [masukan, setMasukan] = useState("");
  return (
    <div className="flex flex-col gap-4 bg-paper-card p-4">
      <p className="text-sm leading-relaxed text-ink-body">
        Jalankan flowchart langkah demi langkah: simbol yang sedang dikerjakan menyala, variabel dan keluaran tampil di sini.
      </p>
      <div>
        <label htmlFor="flow-masukan" className={LABEL}>
          Masukan di muka (opsional)
        </label>
        <input
          id="flow-masukan"
          value={masukan}
          onChange={(e) => setMasukan(e.target.value)}
          placeholder="mis. 4, 5 — untuk simbol Baca"
          className={KOLOM}
        />
        <p className="mt-1 text-xs text-ink-muted">Kosongkan untuk mengetik nilainya saat simbol Baca dijalankan.</p>
      </div>
      {jumlahGalat > 0 && (
        <p className="bg-amber-500/15 px-3 py-2 text-xs text-warn-text">
          Ada {jumlahGalat} galat aturan (lihat tab Periksa) — jalannya mungkin berhenti di tengah.
        </p>
      )}
      <button type="button" className={TOMBOL_UTAMA} disabled={!adaSimbol} onClick={() => onMulai(masukan)}>
        ▶ Jalankan
      </button>
      <p className="text-xs leading-relaxed text-ink-muted">
        Bahasa yang dipahami: penugasan <code>x = x + 1</code>, kondisi <code>n mod 2 = 0</code>, <code>dan</code>/<code>atau</code>/<code>tidak</code>,
        teks dalam kutip, dan fungsi akar, abs, bulat, min, max.
      </p>
    </div>
  );
}

/** Isi tab Jalankan saat berjalan: narasi, kontrol, input, variabel, keluaran. */
export function PanelJalan({
  k,
  sebelumnya,
  memutar,
  kecepatan,
  bisaMundur,
  onPutar,
  onJeda,
  onLangkah,
  onMundur,
  onAkhir,
  onUlang,
  onHenti,
  onKecepatan,
  onMasukan,
}: {
  k: KeadaanJalan;
  sebelumnya: KeadaanJalan | null;
  memutar: boolean;
  kecepatan: number;
  bisaMundur: boolean;
  onPutar: () => void;
  onJeda: () => void;
  onLangkah: () => void;
  onMundur: () => void;
  onAkhir: () => void;
  onUlang: () => void;
  onHenti: () => void;
  onKecepatan: (v: number) => void;
  onMasukan: (teks: string) => void;
}) {
  const [nilai, setNilai] = useState("");
  const lama = new Map(sebelumnya?.vars ?? []);
  const berjalan = k.status === "jalan";
  const STATUS: Record<KeadaanJalan["status"], [string, string]> = {
    jalan: ["Berjalan", "bg-blue-600 text-white"],
    "tunggu-input": ["Menunggu masukan", "bg-amber-500/20 text-warn-text"],
    selesai: ["Selesai", "bg-blue-500/20 text-blue-700"],
    galat: ["Berhenti: galat", "bg-[#E0795A]/25 text-error-text"],
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1 bg-paper-card p-1">
        <button type="button" className={TOMBOL} onClick={onUlang} title="Ulang dari awal">
          ⟲
        </button>
        <button type="button" className={TOMBOL} onClick={onMundur} disabled={!bisaMundur} title="Langkah sebelumnya">
          ‹
        </button>
        <button
          type="button"
          className={cn(TOMBOL, "bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700")}
          onClick={memutar ? onJeda : onPutar}
          disabled={!berjalan && !memutar}
        >
          {memutar ? "Jeda" : "Putar"}
        </button>
        <button type="button" className={TOMBOL} onClick={onLangkah} disabled={!berjalan} title="Langkah berikutnya">
          ›
        </button>
        <button type="button" className={TOMBOL} onClick={onAkhir} disabled={!berjalan} title="Jalankan sampai berhenti">
          ⇥
        </button>
        <select
          aria-label="Kecepatan"
          value={kecepatan}
          onChange={(e) => onKecepatan(Number(e.target.value))}
          className="bg-transparent px-1 py-1 text-sm text-ink-body focus:outline-none"
        >
          {[0.5, 1, 2, 4].map((x) => (
            <option key={x} value={x}>
              {x}×
            </option>
          ))}
        </select>
        <button type="button" className={cn(TOMBOL, "ml-auto")} onClick={onHenti}>
          Sunting
        </button>
      </div>

      <div className="bg-paper-card p-4" role="status" aria-live="polite">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className={cn("px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider", STATUS[k.status][1])}>{STATUS[k.status][0]}</span>
          <span className="text-xs tabular-nums text-ink-muted">Langkah {k.langkah}</span>
        </div>
        <p className="text-sm leading-relaxed text-ink">{k.narasi}</p>
      </div>

      {k.status === "tunggu-input" && k.menunggu && (
        <form
          className="flex gap-2 bg-paper-card p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!nilai.trim()) return;
            onMasukan(nilai);
            setNilai("");
          }}
        >
          <label className="sr-only" htmlFor="flow-isi">
            Nilai untuk {k.menunggu.join(", ")}
          </label>
          <input id="flow-isi" autoFocus value={nilai} onChange={(e) => setNilai(e.target.value)} placeholder={`Nilai ${k.menunggu.join(", ")}`} className={KOLOM} />
          <button type="submit" className={TOMBOL_UTAMA}>
            Kirim
          </button>
        </form>
      )}

      <div className="bg-paper-card p-4">
        <p className={LABEL}>Variabel</p>
        {k.vars.length === 0 ? (
          <p className="text-xs text-ink-muted">Belum ada.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {k.vars.map(([n, v]) => {
                const baru = !lama.has(n) || lama.get(n) !== v;
                return (
                  <tr key={n} className={cn("border-t border-white/5", baru && sebelumnya && "bg-blue-500/10")}>
                    <td className="py-1 pr-2 font-mono text-ink">{n}</td>
                    <td className="py-1 pr-2 font-mono text-ink-body">{typeof v === "string" ? `"${v}"` : tampilNilai(v)}</td>
                    <td className="py-1 text-right text-[11px] text-ink-muted">{namaJenis(v)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-paper-card p-4">
        <p className={LABEL}>Keluaran</p>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap bg-white/[0.06] p-3 font-mono text-[13px] leading-relaxed text-ink">
          {k.keluaran.length > 0 ? k.keluaran.join("\n") : <span className="text-ink-muted">(belum ada)</span>}
        </pre>
      </div>
    </div>
  );
}
