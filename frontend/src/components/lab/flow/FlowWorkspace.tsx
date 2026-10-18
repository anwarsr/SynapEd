"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import FlowCanvas, { ZOOM_MAKS, ZOOM_MIN, type Penyuntingan, type Pilihan, type Viewport } from "./FlowCanvas";
import FlowPanel, { PanelJalan, type AksiPanel, type TabPanel } from "./FlowPanel";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { batasDiagram } from "@/lib/lab/flowGeometri";
import { periksaDiagram } from "@/lib/lab/flowPeriksa";
import { berikanMasukan, jalankanSampaiBerhenti, langkahJalan, mulaiJalan, type KeadaanJalan } from "@/lib/lab/flowJalan";
import {
  balikGaris,
  duplikat,
  hapus,
  pindahkan,
  sambung,
  tambahSimpul,
  ubahGaris,
  ubahJenis,
  ubahKotak,
  ubahTeks,
} from "@/lib/lab/flowEdit";
import { berkasKeDiagram, diagramKeBerkas, encodeFlow, FLOW_URL_PARAM } from "@/lib/lab/flowUrl";
import { diagramKeSvg } from "@/lib/lab/flowSvg";
import { CONTOH_FLOW } from "@/lib/lab/flowContoh";
import { diagramKosong, JENIS_SIMPUL, type Diagram, type JenisSimpul } from "@/lib/lab/flowTypes";
import { LAB_URL_PARAM } from "@/lib/lab/labUrl";
import { canRedo, canUndo, currentState, initHistory, pushHistory, redoHistory, undoHistory, type LabHistory } from "@/lib/lab/labHistory";
import { cn } from "@/lib/cn";
import { IKON, ITEM_MENU, Ikon, Kelompok, Menu, TOMBOL, unduh } from "../LabAlat";

const KUNCI_DRAF = "synaplab-flowchart-draf";
const TANPA_PILIHAN: Pilihan = { simpul: new Set(), garis: new Set() };
/** Jeda per langkah di kecepatan 1× — sama pelannya dengan lab lain, untuk siswa yang baru belajar. */
const JEDA_LANGKAH_MS = 1400;

// Draf otomatis di browser — kenyamanan per pengguna, bukan penyimpanan andal.
function bacaDraf(): string | null {
  try {
    return localStorage.getItem(KUNCI_DRAF);
  } catch {
    return null;
  }
}
function langgananDraf(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

/** Viewport awal tanpa mengukur DOM: diagram dirapatkan ke kiri-atas. Deterministik di server & browser. */
function viewportAwal(d: Diagram): Viewport {
  const b = batasDiagram(d);
  return b ? { x: 40 - b.x, y: 30 - b.y, z: 1 } : { x: 0, y: 0, z: 1 };
}

/**
 * Ruang kerja flowchart SynapLab: editor ala draw.io + mode Jalankan.
 *
 * Tidak memakai `LabWorkspace`/`LabKit` lab lain: lab itu bekerja dengan
 * operasi dari formulir yang menghasilkan langkah animasi, sedangkan
 * flowchart disunting langsung di kanvas dan "langkah"-nya adalah eksekusi
 * program. Yang dipakai bersama hanya riwayat (`labHistory`) dan gaya.
 *
 * Mode Jalankan MENGUNCI penyuntingan: mengubah diagram di tengah eksekusi
 * membuat keadaan jalan (simbol aktif, cabang) menunjuk diagram yang sudah
 * tidak ada. Tombol "Sunting" keluar dari mode jalan.
 */
export default function FlowWorkspace({ awal, judul, aktif }: { awal: Diagram | null; judul: React.ReactNode; aktif: boolean }) {
  const [riwayat, setRiwayat] = useState<LabHistory<Diagram>>(() => initHistory(awal ?? diagramKosong(), "Awal"));
  const diagram = currentState(riwayat);
  const [pilihan, setPilihan] = useState<Pilihan>(TANPA_PILIHAN);
  const [viewport, setViewport] = useState<Viewport>(() => viewportAwal(awal ?? diagramKosong()));
  const [tampilGrid, setTampilGrid] = useState(true);
  const [menyunting, setMenyunting] = useState<Penyuntingan>(null);
  const [tab, setTab] = useState<TabPanel>("simbol");
  const [pesan, setPesan] = useState<{ teks: string; ok: boolean } | null>(null);
  const [layarPenuh, setLayarPenuh] = useState(false);
  const [tanyaBaru, setTanyaBaru] = useState(false);

  // ── Mode jalan ─────────────────────────────────────────────────────
  const [jalan, setJalan] = useState<{ jejak: KeadaanJalan[]; masukan: string } | null>(null);
  const [memutar, setMemutar] = useState(false);
  const [kecepatan, setKecepatan] = useState(1);
  const timer = useRef<number | null>(null);
  const keadaan = jalan?.jejak.at(-1) ?? null;
  const bisaSunting = jalan === null;

  const wadahRef = useRef<HTMLDivElement>(null);
  const berkasRef = useRef<HTMLInputElement>(null);

  const temuan = useMemo(() => periksaDiagram(diagram), [diagram]);
  const sorot = useMemo(() => {
    if (tab !== "periksa") return { simpul: new Set<number>(), garis: new Set<number>() };
    return { simpul: new Set(temuan.flatMap((t) => t.simpul)), garis: new Set(temuan.flatMap((t) => t.garis)) };
  }, [temuan, tab]);

  const draf = useSyncExternalStore(langgananDraf, bacaDraf, () => null);
  const diagramDraf = useMemo(() => (draf ? berkasKeDiagram(draf) : null), [draf]);

  // ── Riwayat ────────────────────────────────────────────────────────
  const terapkan = useCallback((baru: Diagram, label: string) => {
    setRiwayat((h) => (baru === currentState(h) ? h : pushHistory(h, baru, label)));
  }, []);

  function beriPesan(teks: string, ok: boolean) {
    setPesan({ teks, ok });
    window.setTimeout(() => setPesan((p) => (p?.teks === teks ? null : p)), 3200);
  }

  // Simpan draf setiap diagram berubah (dan tidak kosong).
  useEffect(() => {
    if (diagram.simpul.length === 0) return;
    try {
      localStorage.setItem(KUNCI_DRAF, diagramKeBerkas(diagram));
    } catch {
      // Penyimpanan diblokir (mode privat) — draf memang hanya kenyamanan.
    }
  }, [diagram]);

  // Penghitung waktu pemutar dibersihkan saat ruang kerja dilepas.
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  // ── Ukuran & tampilan ──────────────────────────────────────────────
  function tengahLayar(): { x: number; y: number } {
    const r = wadahRef.current?.getBoundingClientRect();
    const w = r?.width ?? 800;
    const h = r?.height ?? 500;
    return { x: (w / 2 - viewport.x) / viewport.z, y: (h / 2 - viewport.y) / viewport.z };
  }

  function paskan(d: Diagram = diagram) {
    const b = batasDiagram(d);
    const r = wadahRef.current?.getBoundingClientRect();
    if (!b || !r) return setViewport(viewportAwal(d));
    const z = Math.min(1.2, Math.max(ZOOM_MIN, Math.min((r.width - 60) / Math.max(b.w, 1), (r.height - 60) / Math.max(b.h, 1))));
    setViewport({ z, x: r.width / 2 - (b.x + b.w / 2) * z, y: r.height / 2 - (b.y + b.h / 2) * z });
  }

  function zoom(faktor: number) {
    const r = wadahRef.current?.getBoundingClientRect();
    const px = (r?.width ?? 800) / 2;
    const py = (r?.height ?? 500) / 2;
    setViewport((v) => {
      const z = Math.min(ZOOM_MAKS, Math.max(ZOOM_MIN, v.z * faktor));
      return { z, x: px - ((px - v.x) / v.z) * z, y: py - ((py - v.y) / v.z) * z };
    });
  }

  function muat(d: Diagram, label: string) {
    hentikanJalan();
    setRiwayat((h) => pushHistory(h, d, label));
    setPilihan(TANPA_PILIHAN);
    setMenyunting(null);
    // Paskan setelah kanvas menggambar diagram baru — ukuran wadah tidak berubah, jadi bisa langsung.
    paskan(d);
  }

  // ── Aksi sunting ───────────────────────────────────────────────────
  function tambah(jenis: JenisSimpul, titik?: { x: number; y: number }) {
    if (!bisaSunting) return;
    const t = titik ?? tengahLayar();
    // Simbol yang ditaruh di tengah bergeser sedikit bila sudah ada simbol di sana.
    const geser = titik ? 0 : (diagram.simpul.filter((s) => Math.abs(s.x + s.w / 2 - t.x) < 20 && Math.abs(s.y + s.h / 2 - t.y) < 20).length * 30);
    const h = tambahSimpul(diagram, jenis, t.x + geser, t.y + geser);
    if (!h.ok) return beriPesan(h.pesan, false);
    terapkan(h.diagram, "Tambah simbol");
    setPilihan({ simpul: new Set(h.baru), garis: new Set() });
  }

  function hapusPilihan() {
    if (!bisaSunting) return;
    const baru = hapus(diagram, pilihan.simpul, pilihan.garis);
    terapkan(baru, "Hapus");
    setPilihan(TANPA_PILIHAN);
  }

  function gandakan() {
    if (!bisaSunting) return;
    const h = duplikat(diagram, pilihan.simpul);
    if (!h.ok) return beriPesan(h.pesan, false);
    terapkan(h.diagram, "Gandakan");
    setPilihan({ simpul: new Set(h.baru), garis: new Set() });
  }

  const undo = () => bisaSunting && setRiwayat((h) => undoHistory(h));
  const redo = () => bisaSunting && setRiwayat((h) => redoHistory(h));

  const aksi: AksiPanel = {
    onTambah: (j) => tambah(j),
    onUbahTeks: (id, t) => terapkan(ubahTeks(diagram, id, t), "Ubah teks"),
    onUbahJenis: (id, j) => terapkan(ubahJenis(diagram, id, j), "Ganti jenis"),
    onUbahUkuran: (id, w, h) => {
      const s = diagram.simpul.find((x) => x.id === id);
      if (s) terapkan(ubahKotak(diagram, id, { x: s.x, y: s.y, w, h }), "Ubah ukuran");
    },
    onUbahGaris: (id, u) => terapkan(ubahGaris(diagram, id, u), "Ubah garis"),
    onBalikGaris: (id) => terapkan(balikGaris(diagram, id), "Balik garis"),
    onHapus: hapusPilihan,
    onDuplikat: gandakan,
    onPilih: setPilihan,
    onMulaiJalan: mulai,
  };

  // ── Jalankan ───────────────────────────────────────────────────────
  const jalanRef = useRef(jalan);
  const diagramRef = useRef(diagram);
  const kecepatanRef = useRef(kecepatan);
  useLayoutEffect(() => {
    jalanRef.current = jalan;
    diagramRef.current = diagram;
    kecepatanRef.current = kecepatan;
  });

  function hentikanPemutar() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setMemutar(false);
  }

  function hentikanJalan() {
    hentikanPemutar();
    setJalan(null);
  }

  function mulai(masukan: string) {
    hentikanPemutar();
    setMenyunting(null);
    setPilihan(TANPA_PILIHAN);
    setJalan({ jejak: [mulaiJalan(diagram, masukan)], masukan });
    setTab("jalankan");
  }

  /** Satu langkah; mengembalikan keadaan baru (null bila tidak sedang jalan). */
  function satuLangkah(): KeadaanJalan | null {
    const j = jalanRef.current;
    const k = j?.jejak.at(-1);
    if (!j || !k || k.status !== "jalan") return null;
    const baru = langkahJalan(diagramRef.current, k);
    // Jejak dibatasi supaya perulangan ribuan langkah tidak menumpuk memori.
    const jejak = [...j.jejak.slice(-400), baru];
    jalanRef.current = { ...j, jejak };
    setJalan({ ...j, jejak });
    return baru;
  }

  function tik() {
    timer.current = null;
    const baru = satuLangkah();
    if (baru && baru.status === "jalan") timer.current = window.setTimeout(tik, JEDA_LANGKAH_MS / kecepatanRef.current);
    else setMemutar(false);
  }

  function putar() {
    if (keadaan?.status !== "jalan") return;
    setMemutar(true);
    if (timer.current === null) tik();
  }

  function sampaiAkhir() {
    hentikanPemutar();
    const j = jalanRef.current;
    const k = j?.jejak.at(-1);
    if (!j || !k) return;
    const akhir = jalankanSampaiBerhenti(diagram, k);
    setJalan({ ...j, jejak: [...j.jejak.slice(-400), akhir] });
  }

  function masukan(teks: string) {
    const j = jalan;
    const k = j?.jejak.at(-1);
    if (!j || !k) return;
    const baru = berikanMasukan(k, teks);
    jalanRef.current = { ...j, jejak: [...j.jejak, baru] };
    setJalan({ ...j, jejak: [...j.jejak, baru] });
    if (memutar && baru.status === "jalan" && timer.current === null) timer.current = window.setTimeout(tik, JEDA_LANGKAH_MS / kecepatan);
  }

  // ── Berkas, ekspor, tautan ─────────────────────────────────────────
  async function bagikan() {
    if (diagram.simpul.length === 0) return beriPesan("Flowchart masih kosong.", false);
    const kode = await encodeFlow(diagram);
    if (!kode) return beriPesan("Terlalu besar untuk tautan — pakai Berkas → Simpan .json.", false);
    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.delete(LAB_URL_PARAM);
    url.searchParams.set(FLOW_URL_PARAM, kode);
    try {
      await navigator.clipboard.writeText(url.toString());
      beriPesan("Tautan disalin", true);
    } catch {
      beriPesan(url.toString(), false);
    }
  }

  function simpanBerkas() {
    unduh("flowchart.json", new Blob([diagramKeBerkas(diagram)], { type: "application/json" }));
  }

  function bukaBerkas(file: File | undefined) {
    if (!file) return;
    if (file.size > 1024 * 1024) return beriPesan("Berkas terlalu besar (maks 1 MB).", false);
    file.text().then((isi) => {
      const d = berkasKeDiagram(isi);
      if (!d) return beriPesan("Berkas bukan flowchart SynapLab yang sah.", false);
      muat(d, "Buka berkas");
      beriPesan("Berkas dibuka", true);
    });
  }

  function eksporSvg() {
    const svg = diagramKeSvg(diagram);
    if (!svg) return beriPesan("Flowchart masih kosong.", false);
    unduh("flowchart.svg", new Blob([svg], { type: "image/svg+xml" }));
  }

  function eksporPng() {
    const svg = diagramKeSvg(diagram);
    if (!svg) return beriPesan("Flowchart masih kosong.", false);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    img.onload = () => {
      // 2× supaya tajam saat ditempel ke slide.
      const kanvas = document.createElement("canvas");
      kanvas.width = img.width * 2;
      kanvas.height = img.height * 2;
      const ctx = kanvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      kanvas.toBlob((b) => b && unduh("flowchart.png", b), "image/png");
    };
    img.onerror = () => beriPesan("Gagal membuat gambar.", false);
    img.src = url;
  }

  // ── Keyboard ───────────────────────────────────────────────────────
  const tombolRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useLayoutEffect(() => {
    tombolRef.current = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable='true']") || menyunting)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === "Escape") {
        if (layarPenuh) setLayarPenuh(false);
        else setPilihan(TANPA_PILIHAN);
        return;
      }
      if (!bisaSunting) return;
      if (ctrl && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (ctrl && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (ctrl && e.key.toLowerCase() === "d") {
        e.preventDefault();
        gandakan();
      } else if (ctrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setPilihan({ simpul: new Set(diagram.simpul.map((s) => s.id)), garis: new Set(diagram.garis.map((g) => g.id)) });
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (pilihan.simpul.size + pilihan.garis.size === 0) return;
        e.preventDefault();
        hapusPilihan();
      } else if (e.key === "F2" && pilihan.simpul.size === 1) {
        e.preventDefault();
        setMenyunting({ jenis: "simpul", id: [...pilihan.simpul][0] });
      } else if (e.key.startsWith("Arrow") && pilihan.simpul.size > 0) {
        e.preventDefault();
        const l = e.shiftKey ? 50 : 10;
        const [dx, dy] = { ArrowLeft: [-l, 0], ArrowRight: [l, 0], ArrowUp: [0, -l], ArrowDown: [0, l] }[e.key] ?? [0, 0];
        terapkan(pindahkan(diagram, pilihan.simpul, dx, dy), "Geser");
      } else if (e.key === "+" || e.key === "=") zoom(1.2);
      else if (e.key === "-") zoom(1 / 1.2);
    };
  });
  useEffect(() => {
    if (!aktif) return;
    const dengar = (e: KeyboardEvent) => tombolRef.current(e);
    window.addEventListener("keydown", dengar);
    return () => window.removeEventListener("keydown", dengar);
  }, [aktif]);

  // ── Tampilan ───────────────────────────────────────────────────────
  const adaPilihan = pilihan.simpul.size + pilihan.garis.size > 0;
  const kosong = diagram.simpul.length === 0;

  const bilah = (
    <div className="flex flex-wrap items-center gap-2">
      <Kelompok label="Riwayat">
        <button type="button" className={TOMBOL} onClick={undo} disabled={!bisaSunting || !canUndo(riwayat)} title="Batalkan (Ctrl+Z)">
          <Ikon d={IKON.undo} />
        </button>
        <button type="button" className={TOMBOL} onClick={redo} disabled={!bisaSunting || !canRedo(riwayat)} title="Ulangi (Ctrl+Y)">
          <Ikon d={IKON.redo} />
        </button>
        <button type="button" className={TOMBOL} onClick={gandakan} disabled={!bisaSunting || pilihan.simpul.size === 0} title="Gandakan (Ctrl+D)">
          <Ikon d={IKON.salin} />
        </button>
        <button type="button" className={TOMBOL} onClick={hapusPilihan} disabled={!bisaSunting || !adaPilihan} title="Hapus (Del)">
          <Ikon d={IKON.hapus} />
        </button>
      </Kelompok>

      <Kelompok label="Tampilan">
        <button type="button" className={TOMBOL} onClick={() => zoom(1 / 1.2)} title="Perkecil (-)">
          <Ikon d={IKON.kurang} />
        </button>
        <button type="button" className={cn(TOMBOL, "w-14 justify-center tabular-nums")} onClick={() => setViewport((v) => ({ ...v, z: 1 }))} title="Kembali ke 100%">
          {Math.round(viewport.z * 100)}%
        </button>
        <button type="button" className={TOMBOL} onClick={() => zoom(1.2)} title="Perbesar (+)">
          <Ikon d={IKON.tambah} />
        </button>
        <button type="button" className={TOMBOL} onClick={() => paskan()} title="Paskan ke layar">
          <Ikon d={IKON.paskan} />
        </button>
        <button type="button" className={cn(TOMBOL, tampilGrid && "text-blue-200")} onClick={() => setTampilGrid((g) => !g)} aria-pressed={tampilGrid} title="Grid">
          <Ikon d={IKON.grid} />
        </button>
      </Kelompok>

      <Kelompok label="Berkas">
        <Menu label="Berkas" ikon={IKON.berkas}>
            <>
              <button type="button" className={ITEM_MENU} disabled={!bisaSunting} onClick={() => { if (kosong) muat(diagramKosong(), "Baru"); else setTanyaBaru(true); }}>
                Flowchart baru
              </button>
              <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Contoh</p>
              {CONTOH_FLOW.map((c) => (
                <button key={c.id} type="button" className={ITEM_MENU} disabled={!bisaSunting} onClick={() => { muat(c.diagram, `Contoh: ${c.nama}`); }}>
                  {c.nama}
                  <span className="block text-[11px] text-ink-muted">{c.ket}</span>
                </button>
              ))}
              <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Simpan & buka</p>
              <button type="button" className={ITEM_MENU} onClick={() => { simpanBerkas(); }}>
                Simpan .json
              </button>
              <button type="button" className={ITEM_MENU} disabled={!bisaSunting} onClick={() => { berkasRef.current?.click(); }}>
                Buka .json…
              </button>
              <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Ekspor gambar</p>
              <button type="button" className={ITEM_MENU} onClick={() => { eksporPng(); }}>
                PNG
              </button>
              <button type="button" className={ITEM_MENU} onClick={() => { eksporSvg(); }}>
                SVG
              </button>
            </>
        </Menu>
        <input ref={berkasRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { bukaBerkas(e.target.files?.[0]); e.target.value = ""; }} />
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

  const kanvas = (
    <div
      ref={wadahRef}
      className={cn(
        "relative min-h-[60vh] overflow-hidden bg-white/[0.03] outline outline-1 outline-white/10",
        layarPenuh ? "flex-1" : "lg:min-h-0 lg:flex-1",
      )}
    >
      <FlowCanvas
        diagram={diagram}
        pilihan={pilihan}
        viewport={viewport}
        bisaSunting={bisaSunting}
        tampilGrid={tampilGrid}
        sorot={sorot}
        aktif={keadaan?.aktif ?? null}
        garisAktif={keadaan?.garisTerakhir ?? null}
        menyunting={menyunting}
        onViewport={setViewport}
        onPilih={(p) => {
          setPilihan(p);
          if (p.simpul.size + p.garis.size > 0 && tab === "simbol") setTab("properti");
        }}
        onPindah={(ids, dx, dy) => terapkan(pindahkan(diagram, ids, dx, dy), "Pindah")}
        onUbahKotak={(id, k) => terapkan(ubahKotak(diagram, id, k), "Ubah ukuran")}
        onSambung={(a, sa, b, sb) => {
          const h = sambung(diagram, a, b, sa, sb);
          if (!h.ok) return beriPesan(h.pesan, false);
          terapkan(h.diagram, "Sambung");
          setPilihan({ simpul: new Set(), garis: new Set(h.baru) });
        }}
        onMulaiSunting={setMenyunting}
        onSelesaiSunting={(nilai) => {
          const m = menyunting;
          setMenyunting(null);
          if (nilai === null || !m) return;
          if (m.jenis === "simpul") terapkan(ubahTeks(diagram, m.id, nilai), "Ubah teks");
          else terapkan(ubahGaris(diagram, m.id, { label: nilai }), "Ubah label");
        }}
        onJatuhkan={(data, titik) => {
          if ((JENIS_SIMPUL as readonly string[]).includes(data)) tambah(data as JenisSimpul, titik);
        }}
      />

      {kosong && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="pointer-events-auto max-w-sm bg-paper-card/95 p-5 text-center shadow-lift">
            <p className="text-base font-semibold text-ink">Kanvas masih kosong</p>
            <p className="mt-1 text-sm text-ink-muted">Seret simbol dari panel Simbol, atau mulai dari contoh.</p>
            <div className="mt-4 flex flex-col gap-1.5">
              {CONTOH_FLOW.map((c) => (
                <button key={c.id} type="button" className="bg-white/[0.06] px-3 py-2 text-sm text-ink-body transition-colors hover:bg-white/10 hover:text-white" onClick={() => muat(c.diagram, `Contoh: ${c.nama}`)}>
                  {c.nama}
                </button>
              ))}
              {diagramDraf && diagramDraf.simpul.length > 0 && (
                <button type="button" className="mt-1 bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={() => muat(diagramDraf, "Buka draf")}>
                  Lanjutkan draf terakhir ({diagramDraf.simpul.length} simbol)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {!bisaSunting && (
        <p className="pointer-events-none absolute left-3 top-3 bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">Mode Jalankan — tekan “Sunting” untuk mengubah</p>
      )}
    </div>
  );

  const panelJalan =
    jalan && keadaan ? (
      <PanelJalan
        k={keadaan}
        sebelumnya={jalan.jejak.at(-2) ?? null}
        memutar={memutar}
        kecepatan={kecepatan}
        bisaMundur={jalan.jejak.length > 1}
        onPutar={putar}
        onJeda={hentikanPemutar}
        onLangkah={() => {
          hentikanPemutar();
          satuLangkah();
        }}
        onMundur={() => {
          hentikanPemutar();
          setJalan((j) => (j && j.jejak.length > 1 ? { ...j, jejak: j.jejak.slice(0, -1) } : j));
        }}
        onAkhir={sampaiAkhir}
        onUlang={() => mulai(jalan.masukan)}
        onHenti={hentikanJalan}
        onKecepatan={setKecepatan}
        onMasukan={masukan}
      />
    ) : null;

  const dialogBaru = (
    <ConfirmDialog
      open={tanyaBaru}
      title="Mulai flowchart baru?"
      description="Kanvas dikosongkan. Flowchart yang sekarang masih bisa dikembalikan dengan tombol Batalkan."
      confirmLabel="Mulai baru"
      onConfirm={() => {
        setTanyaBaru(false);
        muat(diagramKosong(), "Baru");
      }}
      onCancel={() => setTanyaBaru(false)}
    />
  );

  const panel = (
    <FlowPanel tab={tab} onTab={setTab} diagram={diagram} pilihan={pilihan} temuan={temuan} bisaSunting={bisaSunting} aksi={aksi} jalanan={panelJalan} />
  );

  if (layarPenuh) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col gap-3 bg-paper p-4">
        {dialogBaru}
        {bilah}
        <div className="flex min-h-0 flex-1 gap-4">
          <div className="flex min-w-0 flex-1 flex-col">{kanvas}</div>
          <aside className="lab-pane w-[340px] shrink-0 overflow-y-auto max-lg:hidden">{panel}</aside>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:h-full lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:grid-rows-[minmax(0,1fr)]">
      <section aria-label="Kanvas flowchart" className="flex min-w-0 flex-col gap-4 lg:min-h-0">
        {dialogBaru}
        {judul}
        {bilah}
        {kanvas}
      </section>
      <aside aria-label="Panel flowchart" className="lab-pane min-w-0 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
        {panel}
      </aside>
    </div>
  );
}
