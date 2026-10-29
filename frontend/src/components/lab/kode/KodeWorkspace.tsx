"use client";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import KodeEditor from "./KodeEditor";
import { KonsolKode, KotakGalat, LABEL, PanelVariabel, PemutarKode } from "./PanelKode";
import { IKON, ITEM_MENU, Ikon, Kelompok, Menu, TOMBOL, unduh } from "../LabAlat";
import { KODE_MAKS_KARAKTER, KODE_MAKS_MASUKAN, type ContohKode, type JejakKode } from "@/lib/lab/kodeTypes";
import {
  berkasKeKode,
  drafKeTeks,
  encodeKode,
  KODE_MAKS_BERKAS_BYTE,
  KODE_URL_PARAM,
  teksKeDraf,
  type BahasaKode,
  type IsiKode,
} from "@/lib/lab/kodeUrl";
import { LAB_URL_PARAM } from "@/lib/lab/labUrl";
import { FLOW_URL_PARAM } from "@/lib/lab/flowUrl";
import { cn } from "@/lib/cn";

/** Mesin yang menjalankan kode dan merekam jejaknya — Pyodide atau interpreter pseudocode. */
export interface MesinKode {
  status: "siap" | "memuat" | "gagal";
  /** Penjelasan status untuk pengguna, mis. "Menyiapkan Python…". */
  pesan: string | null;
  /** `rekam` false = mode Jalankan: hanya keluaran & keadaan akhir. */
  jalankan: (kode: string, masukan: string, rekam: boolean) => Promise<JejakKode>;
  /** Menghentikan eksekusi yang sedang berjalan (bila mesinnya bisa). */
  hentikan: () => void;
}

/** Jeda per langkah di kecepatan 1×. Pelan disengaja: penontonnya siswa yang baru belajar. */
const JEDA_LANGKAH_MS = 1000;

const TOMBOL_UTAMA =
  "inline-flex items-center gap-1.5 bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50";

type Hasil = { jejak: JejakKode; mode: "jalan" | "langkah"; kode: string };

function langgananDraf(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

/**
 * Ruang kerja lab kode (Python & pseudocode): editor di kiri, masukan,
 * keluaran, variabel, dan pemutar langkah di kanan.
 *
 * Satu komponen untuk kedua bahasa — yang berbeda hanya `mesin`, contoh, dan
 * panduannya. Kedua mesin menghasilkan `JejakKode` yang sama, dan "langkah
 * demi langkah" di sini adalah MEMUTAR ULANG jejak yang sudah terekam, bukan
 * menjalankan program sedikit-sedikit: maju-mundur jadi gratis, dan program
 * yang tidak pernah berhenti sudah dihentikan mesinnya sebelum diputar.
 *
 * Mode langkah MENGUNCI editor (sama seperti mode Jalankan flowchart): sorotan
 * baris menunjuk kode yang direkam, dan mengetik di tengahnya membuat sorotan
 * menunjuk baris yang sudah lain isinya.
 */
export default function KodeWorkspace({
  bahasa,
  judul,
  aktif,
  awal,
  contoh,
  mesin,
  panduan,
  ekstensi,
}: {
  bahasa: BahasaKode;
  judul: React.ReactNode;
  aktif: boolean;
  /** Isi dari tautan (`?py=`/`?ps=`), sudah dibaca di server. */
  awal: IsiKode | null;
  contoh: readonly ContohKode[];
  mesin: MesinKode;
  panduan: React.ReactNode;
  ekstensi: string;
}) {
  const kunciDraf = `synaplab-${bahasa}-draf`;
  const namaBahasa = bahasa === "python" ? "Python" : "pseudocode";

  const [kode, setKode] = useState(awal?.kode ?? contoh[0]?.kode ?? "");
  const [masukan, setMasukan] = useState(awal?.masukan ?? contoh[0]?.masukan ?? "");
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [ke, setKe] = useState(0);
  const [memutar, setMemutar] = useState(false);
  const [kecepatan, setKecepatan] = useState(1);
  const [berjalan, setBerjalan] = useState<"jalan" | "langkah" | null>(null);
  const [pesan, setPesan] = useState<{ teks: string; ok: boolean } | null>(null);
  const [layarPenuh, setLayarPenuh] = useState(false);
  const [abaikanDraf, setAbaikanDraf] = useState(false);

  const timer = useRef<number | null>(null);
  const berkasRef = useRef<HTMLInputElement>(null);

  // Draf dibaca lewat useSyncExternalStore (server: null) supaya HTML server =
  // render pertama klien; tawarannya muncul setelah hidrasi.
  const drafMentah = useSyncExternalStore(
    langgananDraf,
    () => {
      try {
        return localStorage.getItem(kunciDraf);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const draf = teksKeDraf(drafMentah);
  const tawarkanDraf = !abaikanDraf && draf !== null && draf.kode !== kode && draf.kode.trim() !== "";

  const langkahMode = hasil?.mode === "langkah";
  const jejak = hasil?.jejak ?? null;
  const langkah = jejak ? (jejak.langkah[Math.min(ke, jejak.langkah.length - 1)] ?? null) : null;
  const diAkhir = jejak !== null && ke >= jejak.langkah.length - 1;
  const basi = hasil !== null && hasil.kode !== kode;

  // ── Penyimpanan draf ───────────────────────────────────────────────
  // Ditulis dari PENANGAN ketik, bukan efek: memuat contoh tidak boleh
  // menimpa draf — draf itulah jalan pulang ke kode pengguna sebelumnya.
  function simpanDraf(isi: IsiKode) {
    try {
      localStorage.setItem(kunciDraf, drafKeTeks(isi));
    } catch {
      // Penyimpanan diblokir (mode privat) — draf memang hanya kenyamanan.
    }
  }

  function ubahKode(v: string) {
    setKode(v);
    simpanDraf({ kode: v, masukan });
  }
  function ubahMasukan(v: string) {
    setMasukan(v);
    simpanDraf({ kode, masukan: v });
  }

  function beriPesan(teks: string, ok: boolean) {
    setPesan({ teks, ok });
    window.setTimeout(() => setPesan((p) => (p?.teks === teks ? null : p)), 3200);
  }

  function muat(isi: IsiKode) {
    hentikanPemutar();
    setHasil(null);
    setKode(isi.kode);
    setMasukan(isi.masukan);
  }

  // ── Pemutar ────────────────────────────────────────────────────────
  const keRef = useRef(ke);
  const jumlahRef = useRef(0);
  const kecepatanRef = useRef(kecepatan);
  useLayoutEffect(() => {
    keRef.current = ke;
    jumlahRef.current = jejak?.langkah.length ?? 0;
    kecepatanRef.current = kecepatan;
  });
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  function hentikanPemutar() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setMemutar(false);
  }

  function tik() {
    timer.current = null;
    const berikut = keRef.current + 1;
    if (berikut >= jumlahRef.current) return setMemutar(false);
    keRef.current = berikut;
    setKe(berikut);
    if (berikut >= jumlahRef.current - 1) return setMemutar(false);
    timer.current = window.setTimeout(tik, JEDA_LANGKAH_MS / kecepatanRef.current);
  }

  function putar() {
    if (!jejak || diAkhir) return;
    setMemutar(true);
    if (timer.current === null) timer.current = window.setTimeout(tik, JEDA_LANGKAH_MS / kecepatanRef.current);
  }

  function keLangkah(i: number) {
    hentikanPemutar();
    if (!jejak) return;
    setKe(Math.max(0, Math.min(jejak.langkah.length - 1, i)));
  }

  // ── Menjalankan ────────────────────────────────────────────────────
  async function jalankan(mode: "jalan" | "langkah") {
    if (berjalan) return;
    hentikanPemutar();
    setBerjalan(mode);
    const dijalankan = kode;
    try {
      const j = await mesin.jalankan(dijalankan, masukan, mode === "langkah");
      setHasil({ jejak: j, mode, kode: dijalankan });
      setKe(mode === "langkah" ? 0 : Math.max(0, j.langkah.length - 1));
    } catch (e) {
      beriPesan(e instanceof Error ? e.message : "Gagal menjalankan program.", false);
    } finally {
      setBerjalan(null);
    }
  }

  function henti() {
    mesin.hentikan();
  }

  function sunting() {
    hentikanPemutar();
    setHasil((h) => (h ? { ...h, mode: "jalan" } : h));
    setKe((k) => (jejak ? jejak.langkah.length - 1 : k));
  }

  // ── Berkas & tautan ────────────────────────────────────────────────
  async function bagikan() {
    if (!kode.trim()) return beriPesan("Kode masih kosong.", false);
    const isi = await encodeKode({ kode, masukan });
    if (!isi) return beriPesan(`Terlalu panjang untuk tautan - pakai Berkas → Simpan ${ekstensi}.`, false);
    const url = new URL(window.location.pathname, window.location.origin);
    for (const p of [LAB_URL_PARAM, FLOW_URL_PARAM, ...Object.values(KODE_URL_PARAM)]) url.searchParams.delete(p);
    url.searchParams.set(KODE_URL_PARAM[bahasa], isi);
    try {
      await navigator.clipboard.writeText(url.toString());
      beriPesan("Tautan disalin", true);
    } catch {
      beriPesan(url.toString(), false);
    }
  }

  function bukaBerkas(file: File | undefined) {
    if (!file) return;
    if (file.size > KODE_MAKS_BERKAS_BYTE) return beriPesan("Berkas terlalu besar.", false);
    file.text().then((isi) => {
      const k = berkasKeKode(isi);
      if (k === null) return beriPesan(`Berkas bukan teks kode yang sah (maks ${KODE_MAKS_KARAKTER.toLocaleString("id-ID")} karakter).`, false);
      muat({ kode: k, masukan });
      simpanDraf({ kode: k, masukan });
      beriPesan("Berkas dibuka", true);
    });
  }

  // ── Keyboard (di luar editor) ──────────────────────────────────────
  const tombolRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useLayoutEffect(() => {
    tombolRef.current = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        // Di dalam editor, Ctrl+Enter sudah ditangani KodeEditor.
        if (t?.tagName === "TEXTAREA" && t.getAttribute("aria-label")?.startsWith("Kode")) return;
        e.preventDefault();
        void jalankan(e.shiftKey ? "langkah" : "jalan");
        return;
      }
      if (e.key === "Escape" && layarPenuh) {
        setLayarPenuh(false);
        return;
      }
      if (!langkahMode || (t && t.closest("input, textarea, select, [contenteditable='true']"))) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        keLangkah(ke + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        keLangkah(ke - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        keLangkah(0);
      } else if (e.key === "End") {
        e.preventDefault();
        keLangkah(Number.MAX_SAFE_INTEGER);
      }
    };
  });
  useEffect(() => {
    if (!aktif) return;
    const dengar = (e: KeyboardEvent) => tombolRef.current(e);
    window.addEventListener("keydown", dengar);
    return () => window.removeEventListener("keydown", dengar);
  }, [aktif]);

  // ── Tampilan ───────────────────────────────────────────────────────
  const sedangMemuat = mesin.status === "memuat";
  const labelJalan = berjalan === "jalan" ? "Berjalan…" : sedangMemuat && berjalan ? (mesin.pesan ?? "Menyiapkan…") : "Jalankan";

  const bilah = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-0.5 bg-paper-card p-1">
        <button type="button" className={TOMBOL_UTAMA} onClick={() => jalankan("jalan")} disabled={berjalan !== null} title="Jalankan (Ctrl+Enter)">
          <Ikon d={IKON.putar} />
          {labelJalan}
        </button>
        <button type="button" className={TOMBOL} onClick={() => jalankan("langkah")} disabled={berjalan !== null} title="Langkah demi langkah (Ctrl+Shift+Enter)">
          <Ikon d={IKON.langkah} />
          <span>{berjalan === "langkah" ? "Merekam…" : "Langkah demi langkah"}</span>
        </button>
        {berjalan !== null && mesin.status === "siap" && bahasa === "python" && (
          <button type="button" className={cn(TOMBOL, "text-error-text")} onClick={henti} title="Hentikan program">
            <Ikon d={IKON.henti} />
            Stop
          </button>
        )}
      </div>

      <Kelompok label="Contoh & berkas">
        <Menu label="Contoh" ikon={IKON.buku}>
          {contoh.map((c) => (
            <button
              key={c.id}
              type="button"
              className={ITEM_MENU}
              disabled={langkahMode}
              onClick={() => {
                muat({ kode: c.kode, masukan: c.masukan });
                if (draf && draf.kode !== c.kode && draf.kode.trim()) beriPesan("Kode sebelumnya masih tersimpan sebagai draf.", true);
              }}
            >
              {c.nama}
              <span className="block text-[11px] text-ink-muted">{c.ket}</span>
            </button>
          ))}
        </Menu>
        <Menu label="Berkas" ikon={IKON.berkas}>
          <button type="button" className={ITEM_MENU} onClick={() => unduh(`program${ekstensi}`, new Blob([kode], { type: "text/plain;charset=utf-8" }))}>
            Simpan {ekstensi}
          </button>
          <button type="button" className={ITEM_MENU} disabled={langkahMode} onClick={() => berkasRef.current?.click()}>
            Buka {ekstensi === ".txt" ? ".txt" : `${ekstensi} / .txt`}…
          </button>
        </Menu>
        <input
          ref={berkasRef}
          type="file"
          accept={ekstensi === ".txt" ? ".txt,text/plain" : `${ekstensi},.txt,text/plain`}
          className="hidden"
          onChange={(e) => {
            bukaBerkas(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </Kelompok>

      <div className="ml-auto flex items-center gap-2">
        <button type="button" className={cn(TOMBOL, "bg-paper-card")} onClick={() => setLayarPenuh((x) => !x)} title="Layar penuh (Esc untuk keluar)">
          <Ikon d={IKON.layar} />
          <span className="hidden sm:inline">{layarPenuh ? "Keluar" : "Layar penuh"}</span>
        </button>
        <span className="relative">
          <button
            type="button"
            onClick={bagikan}
            className="inline-flex items-center gap-1.5 bg-blue-500/15 px-3 py-2 text-sm font-medium text-blue-200 transition-all duration-200 ease-out-soft hover:-translate-y-0.5 hover:bg-blue-100"
          >
            <Ikon d={IKON.tautan} />
            Bagikan
          </button>
          {pesan && (
            <span
              role="status"
              className={cn(
                "lab-fade-up absolute right-0 top-full z-40 mt-2 w-max max-w-[20rem] break-all px-3 py-1.5 text-xs shadow-lift",
                pesan.ok ? "bg-ink text-paper" : "bg-paper-card text-ink-body",
              )}
            >
              {pesan.teks}
            </span>
          )}
        </span>
      </div>
    </div>
  );

  const barisGalat =
    jejak?.galat && jejak.galat.baris !== null && !basi && (!langkahMode || diAkhir) ? jejak.galat.baris : null;

  const editor = (
    <div className={cn("relative flex min-w-0 flex-col", layarPenuh ? "min-h-0 flex-1" : "lg:min-h-0 lg:flex-1")}>
      {tawarkanDraf && !langkahMode && (
        <div className="lab-fade-up flex flex-wrap items-center gap-2 bg-blue-500/10 px-3 py-2 text-sm text-ink-body">
          <span>Ada draf {namaBahasa} terakhir di browser ini.</span>
          <button type="button" className="font-semibold text-blue-700 underline-offset-2 hover:underline" onClick={() => draf && muat(draf)}>
            Buka draf
          </button>
          <button type="button" className="text-ink-muted hover:text-ink" onClick={() => setAbaikanDraf(true)}>
            Abaikan
          </button>
        </div>
      )}
      {langkahMode && (
        <p className="bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">
          Mode langkah - editor dikunci. Tekan “Sunting” untuk mengubah kode.
        </p>
      )}
      <KodeEditor
        nilai={kode}
        onUbah={ubahKode}
        bahasa={bahasa}
        barisAktif={langkahMode ? (langkah?.baris ?? null) : null}
        barisLalu={langkahMode && ke > 0 ? (jejak?.langkah[ke - 1]?.baris ?? null) : null}
        barisGalat={barisGalat}
        hanyaBaca={langkahMode}
        label={`Kode ${namaBahasa}`}
        onJalankan={() => jalankan("jalan")}
      />
      {kode.length >= KODE_MAKS_KARAKTER && <p className="mt-1 text-xs text-warn-text">Batas {KODE_MAKS_KARAKTER.toLocaleString("id-ID")} karakter tercapai.</p>}
    </div>
  );

  const keluaran = jejak && langkah ? jejak.keluaran.slice(0, langkah.panjangKeluaran) : "";

  const panel = (
    <div className="flex flex-col gap-3">
      <div className="bg-paper-card p-4">
        <label htmlFor={`masukan-${bahasa}`} className={LABEL}>
          Masukan <span className="normal-case tracking-normal">- satu nilai per baris, dibaca {bahasa === "python" ? "input()" : "INPUT"} berurutan</span>
        </label>
        <textarea
          id={`masukan-${bahasa}`}
          value={masukan}
          onChange={(e) => ubahMasukan(e.target.value)}
          readOnly={langkahMode}
          maxLength={KODE_MAKS_MASUKAN}
          rows={3}
          spellCheck={false}
          placeholder="(kosong)"
          className="w-full resize-y bg-white/[0.06] px-3 py-2 font-mono text-[13px] leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none focus:shadow-[inset_0_-2px_0_var(--color-blue-500)] read-only:opacity-60"
        />
      </div>

      {sedangMemuat && mesin.pesan && (
        <p role="status" className="bg-paper-card px-4 py-3 text-sm text-ink-body">
          {mesin.pesan}
        </p>
      )}
      {mesin.status === "gagal" && mesin.pesan && (
        <p role="alert" className="kode-baris-galat px-4 py-3 text-sm text-ink">
          {mesin.pesan}
        </p>
      )}

      {langkahMode && jejak && (
        <PemutarKode
          ke={ke}
          jumlah={jejak.langkah.length}
          memutar={memutar}
          kecepatan={kecepatan}
          terpotong={jejak.terpotong}
          onKe={keLangkah}
          onPutar={putar}
          onJeda={hentikanPemutar}
          onKecepatan={setKecepatan}
          onSunting={sunting}
        />
      )}

      {jejak?.galat && (!langkahMode || diAkhir) && <KotakGalat galat={jejak.galat} basi={basi} />}
      {jejak?.galat && langkahMode && !diAkhir && (
        <p className="bg-paper-card px-4 py-2 text-xs text-ink-muted">
          Program ini berakhir dengan <span className="font-semibold text-error-text">{jejak.galat.jenis}</span>
          {jejak.galat.baris !== null ? ` di baris ${jejak.galat.baris}` : ""}.{" "}
          <button type="button" className="font-semibold text-blue-700 underline-offset-2 hover:underline" onClick={() => keLangkah(Number.MAX_SAFE_INTEGER)}>
            Lompat ke akhir
          </button>
        </p>
      )}

      {jejak && !jejak.galat && hasil?.mode === "jalan" && jejak.terpotong && (
        <p className="bg-paper-card px-4 py-2 text-xs text-ink-muted">Program panjang: hanya sebagian langkahnya yang bisa diputar ulang.</p>
      )}

      <KonsolKode
        teks={keluaran}
        kosong={
          !jejak
            ? `Tekan Jalankan untuk menjalankan ${namaBahasa}.`
            : diAkhir
              ? "(program tidak menampilkan apa-apa)"
              : "(belum ada keluaran pada langkah ini)"
        }
      />

      {jejak && langkah && (
        <PanelVariabel langkah={langkah} sebelumnya={langkahMode && ke > 0 ? jejak.langkah[ke - 1] : null} />
      )}

      <details className="group bg-paper-card">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white/[0.04]">
          <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
          Panduan {namaBahasa}
        </summary>
        <div className="px-4 pb-4">{panduan}</div>
      </details>
    </div>
  );

  if (layarPenuh) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col gap-3 bg-paper p-4">
        {bilah}
        <div className="flex min-h-0 flex-1 gap-4">
          <div className="flex min-w-0 flex-1 flex-col">{editor}</div>
          <aside className="lab-pane w-[360px] shrink-0 overflow-y-auto max-lg:hidden">{panel}</aside>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:h-full lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:grid-rows-[minmax(0,1fr)]">
      <section aria-label={`Editor ${namaBahasa}`} className="flex min-w-0 flex-col gap-4 lg:min-h-0">
        {judul}
        {bilah}
        {editor}
      </section>
      <aside aria-label={`Panel ${namaBahasa}`} className="lab-pane min-w-0 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
        {panel}
      </aside>
    </div>
  );
}
