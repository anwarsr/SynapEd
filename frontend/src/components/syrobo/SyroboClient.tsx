"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import SyroboRobot, { type ReaksiRobot } from "./SyroboRobot";
import SyroboKamar from "./SyroboKamar";
import SyroboRuangan, { type JenisRuangan } from "./SyroboRuangan";
import GameTanjakan from "./GameTanjakan";
import GameBola from "./GameBola";
import { Ikon, type IkonDok } from "./IkonSyrobo";
import { cn } from "@/lib/cn";
import {
  beliMakananSyrobo,
  beliPakaianSyrobo,
  beriMakanSyrobo,
  beriMakanDewaSyrobo,
  bangunkanSyrobo,
  tidurkanSyrobo,
  detakSyrobo,
  gantiNamaSyrobo,
  gosokSyrobo,
  klaimSyrobo,
  simpanKoinGameSyrobo,
  tukarKoinGameSyrobo,
  pasangPakaianSyrobo,
  ukuranPakaianSyrobo,
} from "@/lib/syroboActions";
import type { HasilSyrobo, TampilanSyrobo } from "@/lib/syrobo/syroboCore";
import {
  AMBANG_KOTOR,
  AMBANG_LAPAR,
  AMBANG_LELAH,
  AMBANG_TIDUR,
  energiSaatIni,
  DETAK_KLIEN_MS,
  GOSOK_PX_PER_POIN,
  HADIAH,
  poinHadiah,
  KOIN_PER_POIN,
  KOIN_SETOR_MAKS,
  MAKANAN,
  MAKANAN_DEWA,
  NAMA_MAKS,
  PAKAIAN,
  UKURAN_MAKS,
  UKURAN_MIN,
  kondisiSaatIni,
  sisaBekuMs,
  suasana as hitungSuasana,
  type MakananDewaId,
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
    <div className="flex items-center gap-1.5 sm:gap-2" title={`${nama} ${Math.round(nilai)}%`}>
      <Ikon nama={ikon} className={cn("h-5 w-5 shrink-0 sm:h-7 sm:w-7", rendah && "syrobo-kedip")} />
      <div
        className="h-3 w-[72px] overflow-hidden rounded-md border-2 border-[#2B2233] bg-[#FBF1DA] sm:h-4 sm:w-32 sm:border-[2.5px]"
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
  const [tokoTab, setTokoTab] = useState<"makanan" | "pakaian" | "koin">("makanan");
  const [makanTab, setMakanTab] = useState<"biasa" | "dewa">("biasa");
  /** Ruangan yang sedang dimasuki: tiap menu (Makan/Mandi/Baju/Toko) punya ruangannya sendiri; "Main Room" = kamar utama. */
  const [ruang, setRuang] = useState<"kamar" | JenisRuangan>("kamar");
  const [main, setMain] = useState<null | "tanjakan" | "bola">(null);
  const [reaksi, setReaksi] = useState<ReaksiRobot | null>(null);
  const [suap, setSuap] = useState<{ n: number; id: MakananId | MakananDewaId } | null>(null);
  // Lampu padam = robot tidur. Dimulai dari keadaan tersimpan: lampu yang dipadamkan sebelum pergi tetap padam saat kembali.
  const [gelap, setGelap] = useState(awal.tidur);
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
  const energi = energiSaatIni(robot, sekarang);
  const tidur = gelap && ruang === "kamar";
  const lelah = energi < AMBANG_LELAH;
  const butuhTidur = energi < AMBANG_TIDUR;
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

  /** Lampu Main Room: padam = tidur (energi pulih), menyala = bangun. Server yang menghitung energinya. */
  function ubahLampu(g: boolean) {
    setGelap(g);
    void (g ? tidurkanSyrobo() : bangunkanSyrobo()).then((h) => {
      if (h.ok) terima(h);
    }).catch(() => undefined);
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

  /** Koin hasil game dikirim ke akun (dipecah per KOIN_SETOR_MAKS). Server yang membatasi jatah harian. */
  async function setorKoin(n: number) {
    let sisa = n;
    while (sisa > 0) {
      const k = Math.min(sisa, KOIN_SETOR_MAKS);
      sisa -= k;
      const h = await simpanKoinGameSyrobo(k).catch(() => null);
      if (!h) return tampilPesan("Koin game belum tersimpan: server tak terjangkau.", true);
      terima(h, `${n} koin game disimpan. Tukar di menu Toko (tab Koin Game).`);
      if (!h.ok) return;
    }
  }

  function makanDewa(id: MakananDewaId) {
    if (sibuk) return;
    picu("makan");
    nReaksi.current += 1;
    setSuap({ n: nReaksi.current, id });
    setTimeout(() => setSuap(null), 1000);
    void jalan(() => beriMakanDewaSyrobo(id), "Kenyang penuh! Bar kenyang terkunci 24 jam.");
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
    { id: "ruang", nama: "Main Room" },
    { id: "makan", nama: "Makan", titik: suasana === "lapar" || suasana === "lapar-kotor" },
    { id: "mandi", nama: "Mandi", titik: suasana === "kotor" || suasana === "lapar-kotor" },
    { id: "baju", nama: "Baju" },
    { id: "toko", nama: "Toko" },
    { id: "game", nama: "Games" },
    { id: "hadiah", nama: "Hadiah", titik: adaKlaim },
  ];
  const RUANG_DARI_MENU: Partial<Record<IkonDok, JenisRuangan>> = { makan: "dapur", mandi: "mandi", baju: "ganti", toko: "toko" };

  /** Menu dok: tiap menu ruangan memindahkan robot ke ruangannya; menekan lagi menutup lembarnya (tetap di ruangan). */
  function tekanDok(id: IkonDok) {
    if (id === "ruang") {
      setRuang("kamar");
      setLembar(null);
      return;
    }
    const tujuan = RUANG_DARI_MENU[id];
    if (tujuan) setRuang(tujuan);
    setLembar(lembar === id ? null : id);
  }

  // Sisa masa beku kenyang (makanan dewa), untuk lencana di HUD.
  const sisaBeku = sisaBekuMs(robot, sekarang);
  const bekuTeks = `${Math.floor(sisaBeku / 3600_000)}j ${String(Math.floor((sisaBeku % 3600_000) / 60_000)).padStart(2, "0")}m`;

  return (
    // `keep-white`: adegan ini punya warnanya sendiri, `text-white` tak boleh terbalik di tema terang.
    <div data-adegan-syrobo="" className={cn("keep-white relative h-dvh w-full overflow-hidden overscroll-none bg-[#538589]", gosok && "cursor-none")}>
      {ruang === "kamar" ? (
        <SyroboKamar gelap={gelap} ubahGelap={ubahLampu} bisik={(teks) => setUcapan({ teks, n: Date.now() })} />
      ) : (
        <SyroboRuangan key={`ruang-${ruang}`} jenis={ruang} bisik={(teks) => setUcapan({ teks, n: Date.now() })} />
      )}

      {/* ── HUD ─────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-[88px] z-30 flex items-start justify-between gap-2 px-2.5 sm:flex-wrap sm:gap-3 sm:px-6">
        <div className={cn("pointer-events-auto -rotate-1 space-y-1 rounded-lg bg-[#FBF1DA] px-2 py-1.5 sm:space-y-1.5 sm:rounded-xl sm:px-3.5 sm:py-2.5", STIKER)}>
          <Status ikon="makan" nama="Kenyang" nilai={kondisi.kenyang} rendahDi={AMBANG_LAPAR} />
          {sisaBeku > 0 && (
            <p className="-mt-0.5 flex items-center gap-1.5 text-[11px] font-extrabold text-[#8A5F00]">
              <Ikon nama="ambrosia" className="h-5 w-5" /> Terkunci kenyang · {bekuTeks}
            </p>
          )}
          <Status ikon="mandi" nama="Bersih" nilai={kondisi.bersih} rendahDi={AMBANG_KOTOR} />
          {(lelah || tidur) && (
            <p role="status" className={cn("text-[11px] font-extrabold sm:text-xs", tidur ? "text-[#3B4E8F]" : butuhTidur ? "text-[#B23A26]" : "text-[#8A5F00]")}>
              {tidur
                ? `${robot.nama} tidur... energi ${Math.round(energi)}%`
                : butuhTidur
                  ? `${robot.nama} kelelahan, butuh tidur`
                  : `${robot.nama} kelelahan`}
            </p>
          )}
          {lelah && !tidur && <p className="max-w-[11.5rem] text-[10px] font-semibold leading-snug text-[#2B2233]/70 sm:max-w-[15rem] sm:text-[11px]">Matikan lampu di Main Room supaya {robot.nama} bisa tidur.</p>}
        </div>

        <div className="pointer-events-auto flex min-w-0 justify-center sm:w-auto">
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
              className={cn("max-w-[34vw] truncate rotate-1 rounded-lg bg-[#F2C14E] px-2.5 py-0.5 text-[13px] font-extrabold sm:max-w-none sm:rounded-xl sm:px-5 sm:py-1.5 sm:text-xl text-[#2B2233] transition-transform duration-200 hover:-rotate-1 hover:scale-105 active:scale-95", STIKER)}
            >
              {robot.nama}
            </button>
          )}
        </div>

        <div className={cn("pointer-events-auto flex rotate-1 items-center gap-1 rounded-lg bg-[#FBF1DA] py-0.5 pl-1.5 pr-2 sm:gap-2 sm:rounded-xl sm:py-1.5 sm:pl-2 sm:pr-4", STIKER)} aria-label={`Poin ${robot.poin}`}>
          <Ikon nama="bintang" className="h-5 w-5 sm:h-9 sm:w-9" />
          <span className="text-base font-extrabold tabular-nums text-[#2B2233] sm:text-2xl">{robot.poin}</span>
        </div>
      </div>

      {/* Pesan singkat (selama menggosok: petunjuk singkat) */}
      <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 top-[134px] z-30 flex justify-center px-4 sm:top-[160px]">
        {gosok ? (
          <span className={cn("rounded-[14px_16px_14px_6px] bg-[#FFF8E6] px-4 py-1.5 text-sm font-bold text-[#2B2233]", STIKER)}>Gosokkan spons ke {robot.nama} sampai bar Bersih penuh</span>
        ) : (
          pesan && (
            <span className={cn("syrobo-ucap rounded-[14px_16px_14px_6px] px-4 py-1.5 text-sm font-bold", STIKER, pesan.galat ? "bg-[#FFD9CE] text-[#7A2410]" : "bg-[#FFF8E6] text-[#2B2233]")}>{pesan.teks}</span>
          )
        )}
      </div>

      {/* ── Robot: posisi dasarnya TETAP; lembar menu hanya menutupinya (tidak mengangkatnya) supaya ia bebas berkeliling ───── */}
      <div className="pointer-events-none absolute left-0 z-10 flex w-full justify-center bottom-[calc(158px+1dvh)] sm:bottom-[24dvh]">
        <SyroboRobot
          pakaianKepala={robot.kepala}
          pakaianBadan={robot.badan}
          ukuranKepala={ukuranEdit.kepala ?? robot.ukuran.kepala}
          ukuranBadan={ukuranEdit.badan ?? robot.ukuran.badan}
          suasana={suasana}
          reaksi={reaksi}
          gelap={tidur}
          energi={energi}
          jeda={lembar !== null || gosok}
          lantaiMin={ruang === "kamar" ? 0.66 : 0.72}
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
            "syrobo-lembar absolute inset-x-3 bottom-[170px] z-[35] max-h-[min(24dvh,200px)] overflow-y-auto rounded-xl p-4 max-sm:inset-x-2 max-sm:bottom-[164px] max-sm:max-h-[22dvh] max-sm:p-2.5 max-sm:text-[12px] max-sm:shadow-[3px_3px_0_#2B2233] max-sm:[&_h2]:text-sm max-sm:[&_p]:text-[11px] max-sm:[&_ul]:mt-1.5 max-sm:[&_ul]:gap-1 max-sm:[&_li_svg]:h-7 max-sm:[&_li_svg]:w-7 max-sm:[&_li_span]:text-[10px] sm:inset-x-auto sm:bottom-[100px] sm:left-1/2 sm:w-[min(580px,92%)] sm:max-h-[min(30dvh,260px)] sm:-translate-x-1/2 sm:p-5",
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
            className={cn(TOMBOL_KECIL, "absolute right-2.5 top-2.5 flex h-11 w-11 items-center justify-center p-0 leading-none max-sm:right-1.5 max-sm:top-1.5 max-sm:h-8 max-sm:w-8")}
          >
            <svg viewBox="0 0 16 16" className="block h-6 w-6 max-sm:h-4 max-sm:w-4" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
            </svg>
          </button>

          {lembar === "makan" && (
            <>
              <div className="flex items-center gap-2 pr-12">
                <h2 className="mr-2 text-lg font-extrabold">Dapur</h2>
                {(["biasa", "dewa"] as const).map((k) => (
                  <button key={k} type="button" aria-pressed={makanTab === k} onClick={() => setMakanTab(k)} className={cn(TOMBOL_KECIL, "py-1", makanTab === k && "bg-[#6BA7D8]")}>
                    {k === "biasa" ? "Makanan" : "Makanan Dewa"}
                  </button>
                ))}
              </div>
              {makanTab === "biasa" ? (
                <>
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
                  <p className="mt-3 text-xs font-semibold text-[#2B2233]/70">Stok habis? Beli makanan di Toko dengan poin. Sentuh benda-benda di dapur ini juga!</p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-xs font-semibold text-[#2B2233]/75">
                    {robot.premium
                      ? sisaBeku > 0
                        ? `${robot.nama} masih kenyang oleh makanan dewa. Bar kenyang tidak turun selama ${bekuTeks} lagi.`
                        : "Gratis selama SynapEd Premium aktif. Satu santapan dewa membuat bar kenyang penuh dan TIDAK turun selama 24 jam."
                      : "Khusus pemilik SynapEd Premium. Satu santapan dewa membuat bar kenyang penuh dan tidak turun selama 24 jam."}
                  </p>
                  <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {MAKANAN_DEWA.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          title={m.cerita}
                          disabled={sibuk || !robot.premium || sisaBeku > 0}
                          onClick={() => makanDewa(m.id)}
                          className={cn("relative flex w-full flex-col items-center gap-0.5 rounded-lg bg-[#FFE7A8] py-2 transition-transform duration-150 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50", STIKER)}
                        >
                          <Ikon nama={m.id} className="h-10 w-10" />
                          <span className="px-1 text-center text-[11px] font-extrabold leading-tight">{m.nama}</span>
                          {!robot.premium && (
                            <svg viewBox="0 0 16 16" className="absolute -right-1.5 -top-2 h-6 w-6 rounded-full border-2 border-[#2B2233] bg-[#F6E3C0] p-1" fill="none" stroke={"#2B2233"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Terkunci">
                              <rect x="3.500" y="7" width="9" height="6.500" rx="1.500" fill="#F2C14E" />
                              <path d="M5.500 7V5a2.500 2.500 0 015 0v2" />
                            </svg>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {!robot.premium && (
                    <Link href="/premium" className={cn(TOMBOL_UTAMA, "mt-3 inline-block")}>
                      Buka dengan SynapEd Premium
                    </Link>
                  )}
                </>
              )}
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
                {(["makanan", "pakaian", "koin"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tokoTab === t}
                    onClick={() => setTokoTab(t)}
                    className={cn(TOMBOL_KECIL, "py-1", tokoTab === t && "bg-[#6BA7D8]")}
                  >
                    {t === "makanan" ? "Makanan" : t === "pakaian" ? "Pakaian" : "Koin Game"}
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
              ) : tokoTab === "pakaian" ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {PAKAIAN.map((p) => {
                    const punya = robot.punya.includes(p.id);
                    return (
                      <li key={p.id} className={cn("flex items-center gap-3 rounded-lg bg-[#F6E3C0] px-3 py-2", STIKER)}>
                        <Ikon nama={p.id} className="h-10 w-10 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-extrabold">{p.nama}</span>
                          <span className="block text-xs font-semibold text-[#2B2233]/65">
                            untuk {NAMA_SLOT[p.slot].toLowerCase()}
                            {p.premium && " · khusus Premium"}
                          </span>
                        </span>
                        {p.premium ? (
                          robot.premium ? (
                            <span className="text-xs font-extrabold text-[#2F6F4A]">Terbuka (Premium)</span>
                          ) : (
                            <Link href="/premium" className={cn(TOMBOL_KECIL, "flex items-center gap-1 bg-[#FFE7A8]")}>
                              Premium
                            </Link>
                          )
                        ) : punya ? (
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
              ) : (
                <div className={cn("mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-[#FFE7A8] px-3 py-2.5", STIKER)}>
                  <Ikon nama="game" className="h-10 w-10 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold">Tukar koin game jadi bintang</span>
                    <span className="block text-xs font-semibold text-[#2B2233]/70">
                      Saldo {robot.koinGame} koin · {KOIN_PER_POIN} koin = 1 <Ikon nama="bintang" className="inline h-3.5 w-3.5 align-[-2px]" /> · maksimal 1.500 koin disetor per hari
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={sibuk || robot.koinGame < KOIN_PER_POIN}
                    onClick={() => void jalan(() => tukarKoinGameSyrobo(), `Koin ditukar jadi ${Math.floor(robot.koinGame / KOIN_PER_POIN)} poin!`)}
                    className={TOMBOL_UTAMA}
                  >
                    Tukar {Math.floor(robot.koinGame / KOIN_PER_POIN)}
                  </button>
                </div>
              )}
            </>
          )}

          {lembar === "game" && (
            <>
              <h2 className="text-lg font-extrabold">Games</h2>
              <ul className="mt-3 grid gap-2">
                <li className={cn("flex items-center gap-3 rounded-lg bg-[#F6E3C0] px-3 py-2.5", STIKER)}>
                  <Ikon nama="game" className="h-12 w-12 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold">Tanjakan Robo</span>
                    <span className="block text-xs font-semibold text-[#2B2233]/70">Kendarai mobil menanjak bukit tanpa ujung. Kumpulkan koin & bensin. Ponsel: dua pedal; desktop: panah / A D.</span>
                  </span>
                  <button type="button" onClick={() => setMain("tanjakan")} className={TOMBOL_UTAMA}>
                    Main
                  </button>
                </li>
                <li className={cn("flex items-center gap-3 rounded-lg bg-[#F6E3C0] px-3 py-2.5", STIKER)}>
                  <svg viewBox="0 0 48 48" className="h-12 w-12 shrink-0" aria-hidden="true">
                    <circle cx="17" cy="30" r="12" fill="#F0903A" stroke="#2B2233" strokeWidth="2.6" />
                    <circle cx="33" cy="30" r="12" fill="#F0903A" stroke="#2B2233" strokeWidth="2.6" />
                    <circle cx="24" cy="14" r="9" fill="#E0584D" stroke="#2B2233" strokeWidth="2.6" />
                    <ellipse cx="13" cy="25" rx="3.600" ry="2" transform="rotate(-40 13 25)" fill="#fff" opacity=".6" />
                  </svg>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold">Bola Gabung</span>
                    <span className="block text-xs font-semibold text-[#2B2233]/70">Jatuhkan bola; dua bola sama besar lebur jadi lebih besar. Ponsel: geser lalu lepas; desktop: mouse + klik / spasi.</span>
                  </span>
                  <button type="button" onClick={() => setMain("bola")} className={TOMBOL_UTAMA}>
                    Main
                  </button>
                </li>
              </ul>
              <p className="mt-3 text-xs font-semibold text-[#2B2233]/65">Koin yang kamu kumpulkan di game masuk ke akun dan bisa ditukar poin bintang di menu Toko, tab Koin Game (100 koin = 1 bintang, maksimal 1.500 koin per hari). Di Bola Gabung, tiap 10 skor = 1 koin (1.000 skor = 1 bintang).</p>
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
                  const dapat = poinHadiah(h.poin, robot.premium);
                  return (
                    <li key={h.menit} className={cn("flex items-center gap-3 rounded-lg px-3 py-2", STIKER, bisa ? "bg-[#FFE7A8]" : "bg-[#F6E3C0]")}>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-extrabold">{label(h.menit)}</span>
                        <span className="flex items-center gap-1 text-xs font-bold text-[#2B2233]/70">
                          <Ikon nama="bintang" className="h-3.5 w-3.5" /> +{dapat}
                          {robot.premium && <span className="text-[#8A5A00]">(Premium)</span>}
                        </span>
                      </span>
                      {sudah ? (
                        <span className="text-xs font-extrabold text-[#2F6F4A]">Diklaim</span>
                      ) : (
                        <button type="button" disabled={sibuk || !bisa} onClick={() => void jalan(() => klaimSyrobo(h.menit), `+${dapat} poin!`)} className={TOMBOL_UTAMA}>
                          Klaim
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs font-semibold text-[#2B2233]/65">Waktu dihitung selama halaman ini terbuka dan terlihat; mulai dari nol tiap hari (WIB). {robot.premium ? "Bonus Premium: poin hadiah +50%." : "Pemilik SynapEd Premium mendapat poin hadiah +50%."}</p>
            </>
          )}
        </section>
      )}

      {/* ── Dok ─────────────────────────────────────────────────── */}
      <nav aria-label="Menu SyRobo" className="absolute inset-x-0 bottom-[92px] z-[40] flex justify-center gap-1.5 px-2 sm:bottom-4 sm:gap-2.5 sm:px-3">
        {dok.map((d, i) => {
          const aktifTombol = d.id === "ruang" ? ruang === "kamar" && lembar === null : lembar === d.id;
          return (
            <button
              key={d.id}
              type="button"
              aria-pressed={aktifTombol}
              aria-label={d.nama}
              onClick={() => tekanDok(d.id)}
              className={cn(
                "relative flex h-[62px] w-[48px] flex-col items-center justify-center gap-0.5 rounded-xl text-[#2B2233] transition-[transform,box-shadow,background-color] duration-200 sm:h-[68px] sm:w-[72px]",
                STIKER,
                i % 2 ? "rotate-1" : "-rotate-1",
                aktifTombol ? "-translate-y-2 rotate-0 bg-[#6BA7D8]" : "bg-[#FBF1DA] hover:-translate-y-1 hover:rotate-0 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
              )}
            >
              <Ikon nama={d.id} className="h-7 w-7 sm:h-8 sm:w-8" />
              <span className="text-[8.500px] font-extrabold leading-none sm:text-[11px]">{d.nama}</span>
              {d.titik && <span aria-hidden="true" className="syrobo-kedip absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full border-2 border-[#2B2233] bg-[#E0833B]" />}
            </button>
          );
        })}
      </nav>

      {main === "tanjakan" && <GameTanjakan onKeluar={() => setMain(null)} onSetor={(n) => void setorKoin(n)} />}
      {main === "bola" && <GameBola onKeluar={() => setMain(null)} onSetor={(n) => void setorKoin(n)} />}

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
