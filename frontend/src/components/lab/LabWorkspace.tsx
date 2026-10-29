"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import LabControls from "./LabControls";
import LabToolbar from "./LabToolbar";
import ShareLabButton from "./ShareLabButton";
import StepTimeline, { LangkahSekarang } from "./StepTimeline";
import type { LabKit } from "./labKit";
import { useLabSession } from "@/lib/useLabSession";
import { useLabPlayer } from "@/lib/useLabPlayer";

/**
 * Ruang kerja satu lab: papan, langkah, pemutar, riwayat, dan mode presentasi.
 *
 * Generik — lab mana pun yang memenuhi `LabKit` mendapat ruang kerja yang
 * sama persis. Yang berbeda antar lab hanya kanvas, katalog operasi, dan cara
 * tombol panah memilih sel.
 *
 * Di layar lebar, ruang kerjanya dua panel yang menggulir SENDIRI-SENDIRI:
 * papan + langkah di kiri, operasi di kanan. Dengan satu guliran halaman,
 * menggulir ke operasi di bawah mendorong papan keluar layar — pengguna
 * menjalankan operasi tanpa bisa melihat akibatnya. Di layar sempit keduanya
 * kembali menumpuk dalam aliran halaman biasa, karena panel bergulir di dalam
 * panel bergulir di ponsel hanya membuat jempol tersangkut.
 */
export default function LabWorkspace<S, Op extends { kind: string }, P>({
  kit,
  awal,
  judul,
  aktif,
  onJalan,
}: {
  kit: LabKit<S, Op, P>;
  awal: S;
  /** Kepala halaman, dirender di puncak panel kiri. */
  judul: React.ReactNode;
  /**
   * Ruang kerja lab lain tetap terpasang (tersembunyi) supaya riwayatnya tidak
   * hilang saat berpindah dimensi; hanya yang aktif yang mendengar keyboard.
   */
  aktif: boolean;
  /** Dipanggil setiap kali sebuah operasi dicoba. */
  onJalan?: () => void;
}) {
  const sesi = useLabSession(awal, kit.terapkan, kit.namaOperasi, kit.kosong);
  const pemutar = useLabPlayer(sesi.steps);
  const [terpilih, setTerpilih] = useState<P | null>(null);
  const [presentasi, setPresentasi] = useState(false);

  const papanRef = useRef<HTMLDivElement>(null);
  const pembukaRef = useRef<HTMLElement | null>(null);

  // Papan yang tampil: keadaan langkah yang sedang diputar, atau keadaan
  // sekarang kalau tidak ada animasi berjalan.
  const tampil = sesi.steps[pemutar.frame]?.state ?? sesi.state;
  const langkahIni = sesi.steps[pemutar.frame];
  const fokus = langkahIni?.fokus ?? [];
  const pilihanSah = kit.sahkanPilihan(tampil, terpilih);

  const jalankan = useCallback(
    (op: Op): boolean => {
      const langkah = sesi.jalankan(op);
      if (langkah) pemutar.mulai(langkah.length);
      onJalan?.();
      return langkah !== null;
    },
    [sesi, pemutar, onJalan],
  );

  // Membatalkan/mengulangi/mereset membuang rangkaian langkah, jadi pemutarnya
  // ikut dikembalikan ke keadaan diam — kalau tidak, bilah alat masih mengaku
  // sedang memutar sesuatu yang sudah tidak ada.
  const undo = useCallback(() => {
    sesi.undo();
    pemutar.mulai(0);
  }, [sesi, pemutar]);

  const redo = useCallback(() => {
    sesi.redo();
    pemutar.mulai(0);
  }, [sesi, pemutar]);

  const reset = useCallback(() => {
    sesi.reset();
    pemutar.mulai(0);
    setTerpilih(null);
  }, [sesi, pemutar]);

  const keluarPresentasi = useCallback(() => {
    setPresentasi(false);
    // Fokus dikembalikan ke tombol pembukanya. Tanpa ini, pengguna keyboard
    // terlempar ke awal halaman setiap kali menutup mode presentasi.
    pembukaRef.current?.focus();
  }, []);

  const togglePresentasi = useCallback(() => {
    setPresentasi((p) => {
      if (p) {
        pembukaRef.current?.focus();
        return false;
      }
      pembukaRef.current = document.activeElement as HTMLElement | null;
      return true;
    });
  }, []);

  // Fokus dipindahkan ke papan saat masuk mode presentasi supaya tombol pintas
  // langsung bekerja tanpa pengguna harus mengklik dulu.
  useEffect(() => {
    if (presentasi) papanRef.current?.focus();
  }, [presentasi]);

  // Tombol pintas papan. Diabaikan saat sedang mengetik di kolom isian —
  // tanpa penjaga itu, mengetik "r" di kolom nilai akan mengulang operasi.
  useEffect(() => {
    if (!aktif) return;

    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const mengetik =
        t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "Escape" && presentasi) {
        e.preventDefault();
        keluarPresentasi();
        return;
      }
      if (mengetik) return;

      switch (e.key) {
        case " ":
          // Spasi di atas tombol harus tetap menekan tombol itu.
          if (t instanceof HTMLButtonElement) return;
          e.preventDefault();
          if (pemutar.memutar) pemutar.jeda();
          else pemutar.putar();
          return;
        case ",":
          pemutar.mundur();
          return;
        case ".":
          pemutar.maju();
          return;
        case "u":
          undo();
          return;
        case "r":
          redo();
          return;
        default:
          break;
      }

      // Panah hanya memilih sel kalau fokus ada di papan (atau tidak di mana
      // pun). Di tempat lain panah tetap menggulir panel — kisi 2D memakai
      // ↑/↓, dan merebutnya dari seluruh halaman akan mematikan guliran
      // keyboard di panel operasi.
      const diPapan = t === document.body || (t !== null && papanRef.current?.contains(t)) || presentasi;
      if (!diPapan) return;
      const baru = kit.navigasi(tampil, pilihanSah, e.key);
      if (baru === undefined) return;
      e.preventDefault();
      setTerpilih(baru);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aktif, undo, redo, pemutar, presentasi, keluarPresentasi, kit, tampil, pilihanSah]);

  const Papan = kit.Papan;
  // Lama sel meluncur mengikuti kecepatan pemutar: di 0,5× geraknya juga
  // dua kali lebih pelan, bukan cuma jedanya yang memanjang.
  const gerakMs = Math.round(1000 / Math.max(pemutar.kecepatan, 0.25));
  const papan = (
    <div
      ref={papanRef}
      tabIndex={-1}
      className="focus:outline-none"
      style={{ "--lab-gerak": `${gerakMs}ms` } as React.CSSProperties}
    >
      <Papan
        state={tampil}
        fokus={fokus}
        kelompok={langkahIni?.kelompok}
        jalur={langkahIni?.jalur}
        peran={langkahIni?.peran}
        labelSel={langkahIni?.labelSel}
        variabel={langkahIni?.variabel}
        posisiSimpul={langkahIni?.posisiSimpul}
        terpilih={pilihanSah}
        onPilih={setTerpilih}
        onMulai={jalankan}
        presentasi={presentasi}
      />
    </div>
  );

  const bilah = (
    <LabToolbar
      bisaUndo={sesi.bisaUndo}
      bisaRedo={sesi.bisaRedo}
      onUndo={undo}
      onRedo={redo}
      onReset={reset}
      memutar={pemutar.memutar}
      adaLangkah={sesi.steps.length > 1}
      onPutar={pemutar.putar}
      onJeda={pemutar.jeda}
      onMundur={pemutar.mundur}
      onMaju={pemutar.maju}
      kecepatan={pemutar.kecepatan}
      onKecepatan={pemutar.setKecepatan}
      presentasi={presentasi}
      onPresentasi={togglePresentasi}
      anak={<ShareLabButton kode={() => kit.encode(sesi.state)} />}
    />
  );

  const garisLangkah = (
    <StepTimeline steps={sesi.steps} frame={pemutar.frame} label={sesi.label} onPilihLangkah={pemutar.keLangkah} />
  );
  const narasi = <LangkahSekarang steps={sesi.steps} frame={pemutar.frame} memutar={pemutar.memutar} />;

  if (presentasi) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col gap-4 overflow-y-auto bg-paper px-6 py-5">
        {bilah}
        {narasi}
        {papan}
        {garisLangkah}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:h-full lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:grid-rows-[minmax(0,1fr)]">
      {/* ── Panel kiri: papan & langkah ─────────────────────────── */}
      <section aria-label="Papan lab" className="lab-pane flex min-w-0 flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:pr-3">
        {judul}

        {/* Bilah alat DAN narasi langkah menempel di puncak panel saat papan
            yang tinggi digulir - tombol putar selalu terjangkau, dan kalimat
            yang menjelaskan gerakan tidak pernah keluar layar. */}
        <div className="z-30 -mx-1 flex flex-col gap-2 bg-paper/90 px-1 py-1 backdrop-blur-md lg:sticky lg:top-0">
          {bilah}
          {narasi}
        </div>

        {sesi.error && (
          <p
            key={sesi.error}
            role="status"
            className="lab-fade-up bg-[#E0795A]/15 px-4 py-3 text-sm text-error-text"
          >
            {sesi.error}
          </p>
        )}

        {papan}

        {garisLangkah}

        <details className="group bg-paper-card px-5 py-3 text-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between text-ink-body">
            Tombol pintas keyboard
            <span aria-hidden="true" className="text-ink-faint transition-transform duration-200 group-open:rotate-180">
              ▾
            </span>
          </summary>
          <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-xs text-ink-muted sm:grid-cols-2">
            {[
              ...kit.tombolPilih,
              ["Spasi", "putar atau jeda"],
              [", dan .", "langkah mundur / maju"],
              ["u / r", "batalkan / ulangi"],
              ["Esc", "keluar mode presentasi"],
            ].map(([tombol, arti]) => (
              <li key={tombol} className="flex items-center gap-2">
                <kbd className="bg-white/10 px-1.5 py-0.5 font-sans text-[11px] text-white">{tombol}</kbd>
                {arti}
              </li>
            ))}
          </ul>
        </details>
      </section>

      {/* ── Panel kanan: operasi ─────────────────────────────────── */}
      <aside aria-label={`Operasi array ${kit.nama}`} className="lab-pane min-w-0 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
        <LabControls
          katalog={kit.katalog}
          grup={kit.grup}
          bangun={kit.bangun}
          onJalan={jalankan}
          isianSel={kit.isianSel}
          pilihan={
            pilihanSah === null
              ? null
              : { isian: (nama) => kit.isianDariPilihan(pilihanSah, nama), label: kit.labelPilihan(pilihanSah) }
          }
        />
      </aside>
    </div>
  );
}
