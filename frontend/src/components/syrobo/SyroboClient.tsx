"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import SyroboRobot, { type ReaksiRobot } from "./SyroboRobot";
import SyroboKamar from "./SyroboKamar";
import { Ikon, type IkonDok } from "./IkonSyrobo";
import { cn } from "@/lib/cn";
import {
  beliMakananSyrobo,
  beliPakaianSyrobo,
  beriMakanSyrobo,
  detakSyrobo,
  gantiNamaSyrobo,
  gosokSyrobo,
  klaimSyrobo,
  pasangPakaianSyrobo,
  ukuranPakaianSyrobo,
} from "@/lib/syroboActions";
import type { HasilSyrobo, TampilanSyrobo } from "@/lib/syrobo/syroboCore";
import {
  AMBANG_KOTOR,
  AMBANG_LAPAR,
  DETAK_KLIEN_MS,
  GOSOK_PX_PER_POIN,
  HADIAH,
  MAKANAN,
  NAMA_MAKS,
  PAKAIAN,
  UKURAN_MAKS,
  UKURAN_MIN,
  kondisiSaatIni,
  suasana as hitungSuasana,
  type MakananId,
  type PakaianId,
  type SlotPakaian,
} from "@/lib/syrobo/syroboRules";

/** Memberi tahu robot asisten (ChatRobot) bahwa suasana SyRobo mungkin berubah. */
function kabarkan() {
  window.dispatchEvent(new Event("synaped:syrobo"));
}

type Lembar = IkonDok | null;

const label = (menit: number) => (menit === 0 ? "Masuk hari ini" : menit >= 60 ? `${menit / 60} jam aktif` : `${menit} menit aktif`);

/*
 * Gaya "stiker": garis tinta tebal, bayangan keras (bukan blur), warna datar hangat, sedikit miring - supaya terasa
 * digambar tangan, bukan kaca-buram-gradien khas antarmuka buatan mesin.
 */
const STIKER = "border-[2.5px] border-[#2B2233] shadow-[3px_3px_0_#2B2233]";
const KERTAS = "bg-[#FBF1DA] text-[#2B2233]";
const TOMBOL_KECIL = cn(
  "rounded-lg border-[2.5px] border-[#2B2233] bg-[#F6E3C0] px-3 py-1.5 text-sm font-extrabold text-[#2B2233] shadow-[2px_2px_0_#2B2233]",
  "transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-45",
);
const TOMBOL_UTAMA = cn(
  "rounded-lg border-[2.5px] border-[#2B2233] bg-[#6BA7D8] px-4 py-2 text-sm font-extrabold text-[#2B2233] shadow-[3px_3px_0_#2B2233]",
  "transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-45",
);
const NAMA_SLOT: Record<SlotPakaian, string> = { kepala: "Kepala", badan: "Badan" };

/** Bilah status: ikon + batang bergaris tinta, memerah saat rendah. */
function Status({ ikon, nama, nilai, rendahDi }: { ikon: "makan" | "mandi"; nama: string; nilai: number; rendahDi: number }) {
  const rendah = nilai < rendahDi;
  return (
    <div className="flex items-center gap-2" title={`${nama} ${Math.round(nilai)}%`}>
      <Ikon nama={ikon} className={cn("h-7 w-7 shrink-0", rendah && "syrobo-kedip")} />
      <div
        className="h-4 w-24 overflow-hidden rounded-md border-[2.5px] border-[#2B2233] bg-[#FBF1DA] sm:w-32"
        role="progressbar"
        aria-label={nama}
        aria-valuenow={Math.round(nilai)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn("h-full border-r-[2.5px] border-[#2B2233] transition-[width] duration-500 ease-out", rendah ? "bg-[#E0833B]" : "bg-[#6BA7D8]")} style={{ width: `${Math.max(6, nilai)}%` }} />
      </div>
    </div>
  );
}

export default function SyroboClient({ awal }: { awal: TampilanSyrobo }) {
  const [robot, setRobot] = useState<TampilanSyrobo>(awal);
  const [pesan, setPesan] = useState<{ teks: string; galat: boolean } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [nama, setNama] = useState(awal.nama);
  const [ubahNama, setUbahNama] = useState(false);
  const [lembar, setLembar] = useState<Lembar>(null);
  const [tokoTab, setTokoTab] = useState<"makanan" | "pakaian">("makanan");
  const [reaksi, setReaksi] = useState<ReaksiRobot | null>(null);
  const [suap, setSuap] = useState<{ n: number; id: MakananId } | null>(null);
  const [gelap, setGelap] = useState(false);
  const [ucapan, setUcapan] = useState<{ teks: string; n: number } | null>(null);
  /** Mode menggosok: spons mengikuti penunjuk; menggosok robot menambah bar Bersih. */
  const [gosok, setGosok] = useState(false);
  /** Poin kebersihan dari gosokan yang belum/baru dikirim (ditambahkan ke bar secara lokal supaya bar bergerak mulus). */
  const [tambahLokal, setTambahLokal] = useState(0);
  /** Ukuran pakaian yang sedang digeser (sebelum disimpan). */
  const [ukuranEdit, setUkuranEdit] = useState<Partial<Record<SlotPakaian, number>>>({});
  /** Selisih jam server ↔ klien, saat data terakhir tiba, dan "sekarang" klien (maju tiap detik). Semuanya state
   *  supaya render murni; kondisi & penghitung waktu dihitung dari sini. */
  const [jam, setJam] = useState(() => {
    const now = Date.now();
    return { selisih: Date.parse(awal.sekarang) - now, tiba: now, now };
  });
  const timerPesan = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const timerUkuran = useRef<Partial<Record<SlotPakaian, ReturnType<typeof setTimeout>>>>({});
  const nReaksi = useRef(0);
  const sponsEl = useRef<HTMLDivElement>(null);
  const akum = useRef({ jarak: 0, diberi: 0, belum: 0, inflight: 0, jalan: false, last: null as { x: number; y: number } | null, picuT: 0 });
  const bersihRef = useRef(100);
  const gosokAktif = useRef(false);

  const tampilPesan = useCallback((teks: string, galat = false) => {
    setPesan({ teks, galat });
    clearTimeout(timerPesan.current);
    timerPesan.current = setTimeout(() => setPesan(null), 3200);
  }, []);

  const terima = useCallback(
    (h: HasilSyrobo, sukses?: string) => {
      if (h.ok) {
        const now = Date.now();
        setJam({ selisih: Date.parse(h.robot.sekarang) - now, tiba: now, now });
        setRobot(h.robot);
        setNama(h.robot.nama);
        kabarkan();
      }
      const teks = h.ok ? sukses : h.error;
      if (teks) tampilPesan(teks, !h.ok);
    },
    [tampilPesan],
  );

  // Detak waktu aktif + jam lokal 1 dtk (hanya selagi tab terlihat). Server yang berwenang; jam lokal hanya
  // agar penghitung terus berjalan di antara dua detak.
  useEffect(() => {
    let mati = false;
    const kirim = () => {
      if (document.visibilityState !== "visible") return;
      detakSyrobo().then((h) => {
        if (!mati && h.ok) terima(h);
      });
    };
    kirim();
    const idDetak = setInterval(kirim, DETAK_KLIEN_MS);
    const idJam = setInterval(() => {
      if (document.visibilityState === "visible") setJam((j) => ({ ...j, now: Date.now() }));
    }, 1000);
    const ukuran = timerUkuran.current;
    return () => {
      mati = true;
      clearInterval(idDetak);
      clearInterval(idJam);
      clearTimeout(timerPesan.current);
      for (const k of Object.values(ukuran)) clearTimeout(k);
    };
  }, [terima]);

  const sekarang = new Date(jam.now + jam.selisih);
  const kondisiAsli = kondisiSaatIni(robot, sekarang);
  // Bar Bersih memasukkan gosokan yang belum kembali dari server, jadi naik mulus selagi digosok.
  const kondisi = { kenyang: kondisiAsli.kenyang, bersih: Math.min(100, kondisiAsli.bersih + tambahLokal) };
  const suasana = hitungSuasana(kondisi);
  // Waktu aktif tampil = nilai server + waktu sejak data tiba (maks satu selang detak, supaya tak melampaui server).
  const aktif = robot.aktifDetik + Math.min(DETAK_KLIEN_MS / 1000, Math.floor((jam.now - jam.tiba) / 1000));
  const adaKlaim = HADIAH.some((h) => !robot.diklaim.includes(h.menit) && aktif >= h.menit * 60);

  useEffect(() => {
    bersihRef.current = kondisiAsli.bersih;
  });

  async function jalan(fn: () => Promise<HasilSyrobo>, sukses?: string) {
    if (sibuk) return;
    setSibuk(true);
    try {
      terima(await fn(), sukses);
    } catch {
      tampilPesan("Tidak bisa menghubungi server. Coba lagi.", true);
    } finally {
      setSibuk(false);
    }
  }

  function picu(jenis: ReaksiRobot["jenis"]) {
    nReaksi.current += 1;
    setReaksi({ jenis, n: nReaksi.current });
  }

  function makan(id: MakananId) {
    if (sibuk) return;
    picu("makan");
    nReaksi.current += 1;
    setSuap({ n: nReaksi.current, id });
    setTimeout(() => setSuap(null), 1000);
    void jalan(() => beriMakanSyrobo(id), "Nyam nyam!");
  }

  // ── Menggosok dengan spons ────────────────────────────────────────────
  /**
   * Mengirim gosokan yang menumpuk ke server. Hanya SATU panggilan berjalan sekaligus; gosokan yang terkumpul selama menunggu
   * digabung ke panggilan berikutnya (maks 50 poin per panggilan), jadi server tak dibanjiri dan bar tak tertinggal jauh.
   */
  function kirimGosokan() {
    const a = akum.current;
    if (a.jalan || a.belum < 1) return;
    const n = Math.min(50, Math.floor(a.belum));
    a.belum -= n;
    a.inflight += n;
    a.jalan = true;
    gosokSyrobo(n)
      .then((h) => {
        terima(h);
        // Bar bisa penuh karena balasan server (bukan karena gosokan baru): akhiri di sini juga.
        if (h.ok && gosokAktif.current && h.robot.bersihSekarang + a.belum + a.inflight - n >= 100) akhiriGosok(true);
      })
      .catch(() => undefined)
      .finally(() => {
        a.inflight -= n;
        a.jalan = false;
        setTambahLokal(a.belum + a.inflight);
        if (a.belum >= 1) kirimGosokan();
      });
  }

  /** Mengakhiri mode gosok. `penuh` = bar sudah penuh: tambah cadangan besar agar server (yang menjepit di 100) menyimpan PENUH. */
  function akhiriGosok(penuh: boolean) {
    if (!gosokAktif.current) return;
    gosokAktif.current = false;
    if (penuh) {
      akum.current.belum += 50;
      tampilPesan("Segar dan wangi!");
    }
    kirimGosokan();
    setGosok(false);
    setLembar(null);
  }

  function ambilSpons(e: React.PointerEvent) {
    e.preventDefault();
    if (kondisiAsli.bersih >= 100) return tampilPesan(`${robot.nama} sudah bersih.`);
    akum.current = { jarak: 0, diberi: 0, belum: 0, inflight: 0, jalan: false, last: { x: e.clientX, y: e.clientY }, picuT: 0 };
    setTambahLokal(0);
    gosokAktif.current = true;
    setGosok(true);
    if (sponsEl.current) sponsEl.current.style.transform = `translate3d(${e.clientX - 30}px, ${e.clientY - 30}px, 0) rotate(-12deg)`;
  }

  // Selama mode gosok: spons mengikuti penunjuk; gerakan di atas robot dihitung sebagai gosokan.
  useEffect(() => {
    if (!gosok) return;
    const a = akum.current;
    const selesai = () => akhiriGosok(false);
    const gerak = (e: PointerEvent) => {
      if (sponsEl.current) sponsEl.current.style.transform = `translate3d(${e.clientX - 30}px, ${e.clientY - 30}px, 0) rotate(${(e.clientX % 24) - 12}deg)`;
      const svg = document.querySelector("svg[aria-label^='Robot SyRobo']");
      const r = svg?.getBoundingClientRect();
      const di = r && e.clientX >= r.left - 8 && e.clientX <= r.right + 8 && e.clientY >= r.top - 8 && e.clientY <= r.bottom + 8;
      if (di && a.last) {
        const d = Math.hypot(e.clientX - a.last.x, e.clientY - a.last.y);
        if (d > 1 && d < 120) {
          a.jarak += d;
          const bulat = Math.floor(a.jarak / GOSOK_PX_PER_POIN);
          const baru = bulat - a.diberi;
          if (baru > 0) {
            a.diberi = bulat;
            a.belum += baru;
            setTambahLokal(a.belum + a.inflight);
            if (e.timeStamp - a.picuT > 1400) {
              a.picuT = e.timeStamp;
              nReaksi.current += 1;
              setReaksi({ jenis: "mandi", n: nReaksi.current });
            }
            if (a.belum >= 5) kirimGosokan();
            if (bersihRef.current + a.belum + a.inflight >= 100) akhiriGosok(true);
          }
        }
      }
      a.last = { x: e.clientX, y: e.clientY };
    };
    const lepas = () => selesai();
    window.addEventListener("pointermove", gerak);
    window.addEventListener("pointerup", lepas);
    window.addEventListener("pointercancel", lepas);
    return () => {
      window.removeEventListener("pointermove", gerak);
      window.removeEventListener("pointerup", lepas);
      window.removeEventListener("pointercancel", lepas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gosok]);

  // ── Pakaian ────────────────────────────────────────────────────────────
  function pasang(slot: SlotPakaian, id: PakaianId | null) {
    void jalan(() => pasangPakaianSyrobo(slot, id));
  }

  /** Geser ukuran: tampil langsung, disimpan ke server setelah berhenti menggeser sebentar. */
  function geserUkuran(slot: SlotPakaian, persen: number) {
    setUkuranEdit((u) => ({ ...u, [slot]: persen }));
    clearTimeout(timerUkuran.current[slot]);
    timerUkuran.current[slot] = setTimeout(() => {
      ukuranPakaianSyrobo(slot, persen)
        .then((h) => terima(h))
        .finally(() => setUkuranEdit((u) => ({ ...u, [slot]: undefined })));
    }, 450);
  }

  // Progres: tiap hadiah satu ruas sama lebar; terisi sebagian pada ruas yang sedang ditempuh.
  const ruas = HADIAH.length - 1;
  let isi = 0;
  for (let i = 0; i < ruas; i++) {
    const dari = HADIAH[i].menit * 60;
    const ke = HADIAH[i + 1].menit * 60;
    if (aktif >= ke) isi += 1;
    else {
      isi += Math.max(0, (aktif - dari) / (ke - dari));
      break;
    }
  }
  const persen = Math.min(100, (isi / ruas) * 100);
  const mm = String(Math.floor(aktif / 60)).padStart(2, "0");
  const ss = String(aktif % 60).padStart(2, "0");

  const dok: { id: IkonDok; nama: string; titik?: boolean }[] = [
    { id: "makan", nama: "Makan", titik: suasana === "lapar" || suasana === "lapar-kotor" },
    { id: "mandi", nama: "Mandi", titik: suasana === "kotor" || suasana === "lapar-kotor" },
    { id: "baju", nama: "Baju" },
    { id: "toko", nama: "Toko" },
    { id: "hadiah", nama: "Hadiah", titik: adaKlaim },
  ];

  return (
    // `keep-white`: adegan ini punya warnanya sendiri, `text-white` tak boleh terbalik di tema terang.
    <div className={cn("keep-white relative h-dvh w-full overflow-hidden overscroll-none bg-[#538589]", gosok && "cursor-none")}>
      <SyroboKamar gelap={gelap} ubahGelap={setGelap} bisik={(teks) => setUcapan({ teks, n: Date.now() })} />

      {/* ── HUD ─────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-[88px] z-30 flex flex-wrap items-start justify-between gap-3 px-4 sm:px-6">
        <div className={cn("pointer-events-auto -rotate-1 space-y-1.5 rounded-xl bg-[#FBF1DA] px-3.5 py-2.5", STIKER)}>
          <Status ikon="makan" nama="Kenyang" nilai={kondisi.kenyang} rendahDi={AMBANG_LAPAR} />
          <Status ikon="mandi" nama="Bersih" nilai={kondisi.bersih} rendahDi={AMBANG_KOTOR} />
        </div>

        <div className="pointer-events-auto order-3 flex w-full justify-center sm:order-none sm:w-auto">
          {ubahNama ? (
            <form
              className={cn("flex gap-2 rounded-xl bg-[#FBF1DA] p-1.5", STIKER)}
              onSubmit={(e) => {
                e.preventDefault();
                setUbahNama(false);
                if (nama.trim() !== robot.nama) void jalan(() => gantiNamaSyrobo(nama), "Nama diganti.");
              }}
            >
              <label className="sr-only" htmlFor="syrobo-nama">
                Nama robot
              </label>
              <input
                id="syrobo-nama"
                autoFocus
                value={nama}
                maxLength={NAMA_MAKS}
                onChange={(e) => setNama(e.target.value)}
                className="w-40 rounded-md border-2 border-[#2B2233] bg-white px-3 py-1 text-center text-sm font-extrabold text-[#2B2233] outline-none"
              />
              <button type="submit" className={TOMBOL_KECIL}>
                Simpan
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setUbahNama(true)}
              aria-label={`Ganti nama ${robot.nama}`}
              className={cn("rotate-1 rounded-xl bg-[#F2C14E] px-5 py-1.5 text-xl font-extrabold text-[#2B2233] transition-transform duration-200 hover:-rotate-1 hover:scale-105 active:scale-95", STIKER)}
            >
              {robot.nama}
            </button>
          )}
        </div>

        <div className={cn("pointer-events-auto flex rotate-1 items-center gap-2 rounded-xl bg-[#FBF1DA] py-1.5 pl-2 pr-4", STIKER)} aria-label={`Poin ${robot.poin}`}>
          <Ikon nama="bintang" className="h-9 w-9" />
          <span className="text-2xl font-extrabold tabular-nums text-[#2B2233]">{robot.poin}</span>
        </div>
      </div>

      {/* Pesan singkat (selama menggosok: petunjuk singkat) */}
      <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 top-[168px] z-30 flex justify-center px-4 sm:top-[160px]">
        {gosok ? (
          <span className={cn("rounded-[14px_16px_14px_6px] bg-[#FFF8E6] px-4 py-1.5 text-sm font-bold text-[#2B2233]", STIKER)}>Gosokkan spons ke {robot.nama} sampai bar Bersih penuh</span>
        ) : (
          pesan && (
            <span className={cn("syrobo-ucap rounded-[14px_16px_14px_6px] px-4 py-1.5 text-sm font-bold", STIKER, pesan.galat ? "bg-[#FFD9CE] text-[#7A2410]" : "bg-[#FFF8E6] text-[#2B2233]")}>{pesan.teks}</span>
          )
        )}
      </div>

      {/* ── Robot: posisi dasarnya TETAP; lembar menu hanya menutupinya (tidak mengangkatnya) supaya ia bebas berkeliling ───── */}
      <div className="pointer-events-none absolute left-0 z-10 flex w-full justify-center bottom-[calc(176px+2dvh)] sm:bottom-[24dvh]">
        <SyroboRobot
          pakaianKepala={robot.kepala}
          pakaianBadan={robot.badan}
          ukuranKepala={ukuranEdit.kepala ?? robot.ukuran.kepala}
          ukuranBadan={ukuranEdit.badan ?? robot.ukuran.badan}
          suasana={suasana}
          reaksi={reaksi}
          gelap={gelap}
          jeda={lembar !== null || gosok}
          ucapan={ucapan}
        />
        {suap && <Ikon key={suap.n} nama={suap.id} className="syrobo-suap absolute bottom-[4%] left-1/2 z-20 -ml-6 h-12 w-12" />}
      </div>

      {/* ── Lembar (kertas) ─────────────────────────────────────── */}
      {lembar && (
        <section
          key={lembar}
          aria-label={lembar}
          className={cn(
            "syrobo-lembar absolute inset-x-3 bottom-[176px] z-[35] max-h-[min(26dvh,220px)] overflow-y-auto rounded-xl p-4 sm:inset-x-auto sm:bottom-[100px] sm:left-1/2 sm:w-[min(580px,92%)] sm:max-h-[min(30dvh,260px)] sm:-translate-x-1/2 sm:p-5",
            KERTAS,
            STIKER,
            "shadow-[5px_5px_0_#2B2233]",
            // Selama menggosok lembar disembunyikan TANPA dilepas dari DOM, supaya sentuhan yang berawal dari spons terus terkirim.
            gosok && "pointer-events-none opacity-0",
          )}
        >
          <button
            type="button"
            onClick={() => setLembar(null)}
            aria-label="Tutup"
            className={cn(TOMBOL_KECIL, "absolute right-2.5 top-2.5 flex h-11 w-11 items-center justify-center p-0 leading-none")}
          >
            <svg viewBox="0 0 16 16" className="block h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
            </svg>
          </button>

          {lembar === "makan" && (
            <>
              <h2 className="text-lg font-extrabold">Beri makan</h2>
              <ul className="mt-3 grid grid-cols-4 gap-2">
                {MAKANAN.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      disabled={sibuk || robot.stok[m.id] < 1 || kondisi.kenyang >= 98}
                      onClick={() => makan(m.id)}
                      className={cn("relative flex w-full flex-col items-center gap-0.5 rounded-lg bg-[#F6E3C0] py-2 transition-transform duration-150 hover:-translate-y-0.5 active:scale-95 disabled:opacity-45", STIKER)}
                    >
                      <Ikon nama={m.id} className="h-10 w-10" />
                      <span className="text-xs font-extrabold">{m.nama}</span>
                      <span className="absolute -right-1.5 -top-2 min-w-6 rounded-full border-2 border-[#2B2233] bg-[#6BA7D8] px-1.5 text-center text-xs font-extrabold">{robot.stok[m.id]}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs font-semibold text-[#2B2233]/70">Stok habis? Beli makanan di Toko dengan poin.</p>
            </>
          )}

          {lembar === "mandi" && (
            <>
              <h2 className="text-lg font-extrabold">Mandikan</h2>
              <p className="mt-1 text-sm font-semibold text-[#2B2233]/75">
                {kondisi.bersih >= 100 ? `${robot.nama} sudah bersih dan wangi.` : `${robot.nama} ${Math.round(kondisi.bersih)}% bersih. Tekan spons, lalu gosokkan ke robot sampai bar Bersih penuh.`}
              </p>
              <button
                type="button"
                onPointerDown={ambilSpons}
                disabled={kondisi.bersih >= 100}
                aria-label="Ambil spons lalu gosokkan ke robot"
                className={cn("mt-3 flex touch-none select-none items-center gap-3 rounded-lg bg-[#F6E3C0] px-4 py-2 transition-transform duration-150 hover:-translate-y-0.5 active:scale-95 disabled:opacity-45", STIKER)}
              >
                <Ikon nama="spons" className="h-12 w-12" />
                <span className="text-sm font-extrabold">Spons</span>
              </button>
            </>
          )}

          {lembar === "baju" && (
            <>
              <h2 className="text-lg font-extrabold">Baju</h2>
              <div className="mt-3 space-y-4">
                {(["kepala", "badan"] as const).map((slot) => {
                  const milik = PAKAIAN.filter((p) => p.slot === slot && robot.punya.includes(p.id));
                  const pakai = robot[slot];
                  const uk = ukuranEdit[slot] ?? robot.ukuran[slot];
                  return (
                    <div key={slot}>
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#2B2233]/60">Slot {NAMA_SLOT[slot]}</p>
                      {milik.length === 0 ? (
                        <p className="mt-1 text-xs font-semibold text-[#2B2233]/65">Belum punya pakaian untuk {NAMA_SLOT[slot].toLowerCase()}. Beli di Toko.</p>
                      ) : (
                        <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                          <li>
                            <button
                              type="button"
                              aria-pressed={pakai === null}
                              disabled={sibuk}
                              onClick={() => pasang(slot, null)}
                              className={cn("flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-extrabold transition-transform duration-150 active:scale-95", STIKER, pakai === null ? "bg-[#6BA7D8]" : "bg-[#F6E3C0] hover:-translate-y-0.5")}
                            >
                              Lepas
                            </button>
                          </li>
                          {milik.map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                aria-pressed={pakai === p.id}
                                disabled={sibuk}
                                onClick={() => pasang(slot, p.id)}
                                className={cn("flex w-full flex-col items-center gap-1 rounded-lg py-2 transition-transform duration-150 active:scale-95", STIKER, pakai === p.id ? "bg-[#6BA7D8]" : "bg-[#F6E3C0] hover:-translate-y-0.5")}
                              >
                                <Ikon nama={p.id} className="h-9 w-9" />
                                <span className="px-1 text-center text-[11px] font-extrabold leading-tight">{p.nama}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {pakai && (
                        <label className="mt-2 flex items-center gap-3 text-xs font-extrabold">
                          <span className="w-20 shrink-0">Ukuran {uk}%</span>
                          <input
                            type="range"
                            min={UKURAN_MIN}
                            max={UKURAN_MAKS}
                            step={5}
                            value={uk}
                            onChange={(e) => geserUkuran(slot, Number(e.target.value))}
                            aria-label={`Ukuran pakaian ${NAMA_SLOT[slot].toLowerCase()}`}
                            className="h-2 min-w-0 flex-1 accent-[#2F6FED]"
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {lembar === "toko" && (
            <>
              <div className="flex items-center gap-2 pr-10">
                <h2 className="mr-2 text-lg font-extrabold">Toko</h2>
                {(["makanan", "pakaian"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tokoTab === t}
                    onClick={() => setTokoTab(t)}
                    className={cn(TOMBOL_KECIL, "py-1", tokoTab === t && "bg-[#6BA7D8]")}
                  >
                    {t === "makanan" ? "Makanan" : "Pakaian"}
                  </button>
                ))}
              </div>
              {tokoTab === "makanan" ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {MAKANAN.map((m) => (
                    <li key={m.id} className={cn("flex items-center gap-3 rounded-lg bg-[#F6E3C0] px-3 py-2", STIKER)}>
                      <Ikon nama={m.id} className="h-10 w-10 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold">{m.nama}</span>
                        <span className="block text-xs font-semibold text-[#2B2233]/65">kenyang +{m.isi}</span>
                      </span>
                      <button type="button" disabled={sibuk || robot.poin < m.harga} onClick={() => void jalan(() => beliMakananSyrobo(m.id), `${m.nama} dibeli.`)} className={cn(TOMBOL_KECIL, "flex items-center gap-1")}>
                        <Ikon nama="bintang" className="h-4 w-4" /> {m.harga}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {PAKAIAN.map((p) => {
                    const punya = robot.punya.includes(p.id);
                    return (
                      <li key={p.id} className={cn("flex items-center gap-3 rounded-lg bg-[#F6E3C0] px-3 py-2", STIKER)}>
                        <Ikon nama={p.id} className="h-10 w-10 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-extrabold">{p.nama}</span>
                          <span className="block text-xs font-semibold text-[#2B2233]/65">untuk {NAMA_SLOT[p.slot].toLowerCase()}</span>
                        </span>
                        {punya ? (
                          <span className="text-xs font-extrabold text-[#2F6F4A]">Dimiliki</span>
                        ) : (
                          <button type="button" disabled={sibuk || robot.poin < p.harga} onClick={() => void jalan(() => beliPakaianSyrobo(p.id), `${p.nama} dibeli. Pasang di menu Baju.`)} className={cn(TOMBOL_KECIL, "flex items-center gap-1")}>
                            <Ikon nama="bintang" className="h-4 w-4" /> {p.harga}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {lembar === "hadiah" && (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2 pr-10">
                <h2 className="text-lg font-extrabold">Poin harian</h2>
                <p className="text-sm font-bold tabular-nums text-[#2B2233]/70">
                  Aktif hari ini {mm}:{ss}
                </p>
              </div>
              <div
                className="mt-3 h-4 overflow-hidden rounded-md border-[2.5px] border-[#2B2233] bg-[#FBF1DA]"
                role="progressbar"
                aria-label="Waktu aktif hari ini"
                aria-valuenow={Math.round(persen)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full border-r-[2.5px] border-[#2B2233] bg-[#F2C14E] transition-[width] duration-1000 ease-linear" style={{ width: `${Math.max(4, persen)}%` }} />
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {HADIAH.map((h) => {
                  const sudah = robot.diklaim.includes(h.menit);
                  const bisa = !sudah && aktif >= h.menit * 60;
                  return (
                    <li key={h.menit} className={cn("flex items-center gap-3 rounded-lg px-3 py-2", STIKER, bisa ? "bg-[#FFE7A8]" : "bg-[#F6E3C0]")}>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold">{label(h.menit)}</span>
                        <span className="flex items-center gap-1 text-xs font-bold text-[#2B2233]/70">
                          <Ikon nama="bintang" className="h-3.5 w-3.5" /> +{h.poin}
                        </span>
                      </span>
                      {sudah ? (
                        <span className="text-xs font-extrabold text-[#2F6F4A]">Diklaim</span>
                      ) : (
                        <button type="button" disabled={sibuk || !bisa} onClick={() => void jalan(() => klaimSyrobo(h.menit), `+${h.poin} poin!`)} className={TOMBOL_UTAMA}>
                          Klaim
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs font-semibold text-[#2B2233]/65">Waktu dihitung selama halaman ini terbuka dan terlihat; mulai dari nol tiap hari (WIB).</p>
            </>
          )}
        </section>
      )}

      {/* ── Dok ─────────────────────────────────────────────────── */}
      <nav aria-label="Menu SyRobo" className="absolute inset-x-0 bottom-[92px] z-[40] flex justify-center gap-2 px-3 sm:bottom-4 sm:gap-3">
        {dok.map((d, i) => {
          const aktifTombol = lembar === d.id;
          return (
            <button
              key={d.id}
              type="button"
              aria-pressed={aktifTombol}
              onClick={() => setLembar(aktifTombol ? null : d.id)}
              className={cn(
                "relative flex h-[68px] w-[60px] flex-col items-center justify-center gap-0.5 rounded-xl text-[#2B2233] transition-[transform,box-shadow,background-color] duration-200 sm:w-[74px]",
                STIKER,
                i % 2 ? "rotate-1" : "-rotate-1",
                aktifTombol ? "-translate-y-2 rotate-0 bg-[#6BA7D8]" : "bg-[#FBF1DA] hover:-translate-y-1 hover:rotate-0 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
              )}
            >
              <Ikon nama={d.id} className="h-8 w-8" />
              <span className="text-[11px] font-extrabold">{d.nama}</span>
              {d.titik && <span aria-hidden="true" className="syrobo-kedip absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full border-2 border-[#2B2233] bg-[#E0833B]" />}
            </button>
          );
        })}
      </nav>

      {/* Spons yang mengikuti penunjuk selama menggosok */}
      <div
        ref={sponsEl}
        aria-hidden="true"
        className={cn("pointer-events-none fixed left-0 top-0 z-[90] h-[60px] w-[60px] drop-shadow-[2px_3px_0_rgba(43,34,51,0.35)]", gosok ? "block" : "hidden")}
      >
        <Ikon nama="spons" className="h-full w-full" />
      </div>
    </div>
  );
}
