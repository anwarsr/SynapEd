"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  addQuizTime,
  deleteQuiz,
  gradeQuizEssay,
  resetQuizAttempt,
  setQuizClosed,
  startQuiz,
  warnQuizStudents,
} from "@/lib/classQuizActions";
import QuizIkon from "@/components/classes/quiz/QuizIkon";
import { MAX_TAMBAH_MENIT } from "@/lib/classQuizRules";
import { TOMBOL_KOTAK, TOMBOL_KOTAK_BAHAYA } from "@/lib/quizUi";
import { cn } from "@/lib/cn";

/**
 * Tombol-tombol kecil quiz. Semuanya hanya membungkus Server Action - penjaga
 * peran & kepemilikan ada di action-nya, bukan di sini.
 */

function useAksi() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function jalankan(fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, sesudah?: () => void) {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error);
      setInfo(res.message);
      sesudah?.();
      router.refresh();
    });
  }
  return { pending, error, info, jalankan };
}

function Pesan({ error, info }: { error: string | null; info?: string | null }) {
  if (!error && !info) return null;
  return (
    <p role={error ? "alert" : "status"} className={cn("mt-1 text-xs", error ? "text-rust-700" : "text-blue-700")}>
      {error ?? info}
    </p>
  );
}

export function TutupBukaQuizButton({ classId, quizId, ditutup }: { classId: string; quizId: string; ditutup: boolean }) {
  const { pending, error, jalankan } = useAksi();
  return (
    <>
      <button type="button" disabled={pending} onClick={() => jalankan(() => setQuizClosed(classId, quizId, !ditutup))} className={TOMBOL_KOTAK}>
        <QuizIkon nama={ditutup ? "buka" : "kunci"} />
        {pending ? "Memproses…" : ditutup ? "Buka kembali" : "Tutup quiz"}
      </button>
      <Pesan error={error} />
    </>
  );
}

export function HapusQuizButton({ classId, quizId }: { classId: string; quizId: string }) {
  const { pending, error, jalankan } = useAksi();
  const [buka, setBuka] = useState(false);
  return (
    <>
      <button type="button" disabled={pending} onClick={() => setBuka(true)} className={TOMBOL_KOTAK_BAHAYA}>
        <QuizIkon nama="hapus" />
        {pending ? "Menghapus…" : "Hapus"}
      </button>
      <ConfirmDialog
        open={buka}
        title="Hapus quiz ini?"
        description="Soal beserta SELURUH jawaban dan nilai siswa ikut terhapus. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Hapus quiz"
        onConfirm={() => {
          setBuka(false);
          jalankan(() => deleteQuiz(classId, quizId));
        }}
        onCancel={() => setBuka(false)}
      />
      <Pesan error={error} />
    </>
  );
}

/**
 * Pengelola memperingatkan siswa yang belum memulai: layar mereka ditutupi
 * peringatan + sirene 2 detik. Dikonfirmasi dulu karena tak bisa ditarik kembali.
 */
export function PeringatkanMuridButton({ classId, quizId, jumlah }: { classId: string; quizId: string; jumlah: number }) {
  const { pending, error, info, jalankan } = useAksi();
  const [buka, setBuka] = useState(false);
  return (
    <>
      <button type="button" disabled={pending || jumlah === 0} onClick={() => setBuka(true)} className={TOMBOL_KOTAK} title={jumlah === 0 ? "Semua siswa sudah memulai quiz ini" : undefined}>
        <QuizIkon nama="lonceng" />
        {pending ? "Mengirim…" : "Peringatkan murid"}
        {jumlah > 0 && <span className="text-ink-muted">· {jumlah}</span>}
      </button>
      <ConfirmDialog
        open={buka}
        title={`Peringatkan ${jumlah} siswa?`}
        description="Siswa yang belum memulai quiz akan melihat peringatan selebar layar disertai bunyi sirene 2 detik di perangkat mereka."
        confirmLabel="Kirim peringatan"
        onConfirm={() => {
          setBuka(false);
          jalankan(() => warnQuizStudents(classId, quizId));
        }}
        onCancel={() => setBuka(false)}
      />
      <Pesan error={error} info={info} />
    </>
  );
}

/** Siswa menekan Mulai: percobaan dibuat di server (waktu mulai = saat ini), lalu halaman dimuat ulang. */
export function MulaiQuizButton({ classId, quizId }: { classId: string; quizId: string }) {
  const { pending, error, jalankan } = useAksi();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => jalankan(() => startQuiz(classId, quizId))}
        className="group inline-flex items-center gap-3 bg-blue-600 px-9 py-4 text-[14px] font-semibold tracking-[0.04em] text-[#fff] transition-colors hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Memulai…" : "Mulai mengerjakan"}
        <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
        </svg>
      </button>
      <Pesan error={error} />
    </div>
  );
}

/** `uid` null = tambah waktu untuk SEMUA siswa. */
export function TambahWaktuForm({ classId, quizId, uid, label }: { classId: string; quizId: string; uid: string | null; label: string }) {
  const { pending, error, info, jalankan } = useAksi();
  const [buka, setBuka] = useState(false);
  const [menit, setMenit] = useState("5");

  if (!buka) {
    return (
      <button type="button" onClick={() => setBuka(true)} className={TOMBOL_KOTAK}>
        <QuizIkon nama="waktu" />
        {label}
      </button>
    );
  }

  return (
    <form
      className="inline-flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        jalankan(() => addQuizTime(classId, quizId, Number(menit), uid), () => setBuka(false));
      }}
    >
      <label className="sr-only" htmlFor={`tw-${uid ?? "semua"}`}>
        Menit tambahan
      </label>
      <input
        id={`tw-${uid ?? "semua"}`}
        type="number"
        min={1}
        max={MAX_TAMBAH_MENIT}
        value={menit}
        onChange={(e) => setMenit(e.target.value)}
        className="w-16 bg-white/[0.08] px-2 py-1 text-xs text-ink outline-none"
      />
      <span className="text-xs text-ink-muted">menit</span>
      <button type="submit" disabled={pending} className="bg-blue-600 px-4 py-2.5 text-[12.5px] font-semibold text-[#fff] transition-colors hover:bg-blue-700 disabled:opacity-60">
        {pending ? "…" : "Tambah"}
      </button>
      <button type="button" onClick={() => setBuka(false)} className={TOMBOL_KOTAK}>
        Batal
      </button>
      <Pesan error={error} info={info} />
    </form>
  );
}

export function ResetPercobaanButton({ classId, quizId, uid }: { classId: string; quizId: string; uid: string }) {
  const { pending, error, jalankan } = useAksi();
  const [buka, setBuka] = useState(false);
  return (
    <>
      <button type="button" disabled={pending} onClick={() => setBuka(true)} className={TOMBOL_KOTAK}>
        <QuizIkon nama="ulang" />
        Izinkan mengulang
      </button>
      <ConfirmDialog
        open={buka}
        title="Hapus percobaan siswa ini?"
        description="Jawaban dan nilainya dihapus, dan ia bisa mengerjakan quiz dari awal. Tidak bisa dibatalkan."
        confirmLabel="Hapus percobaan"
        onConfirm={() => {
          setBuka(false);
          jalankan(() => resetQuizAttempt(classId, quizId, uid));
        }}
        onCancel={() => setBuka(false)}
      />
      <Pesan error={error} />
    </>
  );
}

export interface ButirEsai {
  id: string;
  nomor: number;
  pertanyaan: string;
  jawaban: string;
  poin: number;
  nilai: number | null;
}

/** Jawaban esai satu siswa + isian poin per soal. */
export function NilaiEsaiForm({ classId, quizId, uid, butir }: { classId: string; quizId: string; uid: string; butir: ButirEsai[] }) {
  const { pending, error, info, jalankan } = useAksi();
  const [nilai, setNilai] = useState<Record<string, string>>(() =>
    Object.fromEntries(butir.map((b) => [b.id, b.nilai === null ? "" : String(b.nilai)])),
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const kirim: Record<string, number> = {};
        for (const b of butir) if (nilai[b.id] !== "") kirim[b.id] = Number(nilai[b.id]);
        jalankan(() => gradeQuizEssay(classId, quizId, uid, kirim));
      }}
    >
      {butir.map((b) => (
        <div key={b.id} className="bg-white/[0.05] p-4">
          <p className="text-xs font-bold tracking-[0.2em] text-blue-700">SOAL {String(b.nomor).padStart(2, "0")}</p>
          <p className="mt-1 whitespace-pre-line break-words text-sm font-medium text-ink">{b.pertanyaan}</p>
          <p className="mt-3 whitespace-pre-line break-words bg-white/[0.04] px-3 py-2.5 text-sm leading-[1.7] text-ink-body">
            {b.jawaban || <span className="text-ink-muted">(tidak dijawab)</span>}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <label htmlFor={`es-${uid}-${b.id}`} className="text-xs text-ink-muted">
              Poin
            </label>
            <input
              id={`es-${uid}-${b.id}`}
              type="number"
              min={0}
              max={b.poin}
              value={nilai[b.id] ?? ""}
              onChange={(e) => setNilai((n) => ({ ...n, [b.id]: e.target.value }))}
              className="w-20 bg-white/[0.08] px-2 py-1.5 text-center text-sm font-semibold text-ink outline-none"
            />
            <span className="text-xs text-ink-muted">/ {b.poin}</span>
          </div>
        </div>
      ))}
      <button type="submit" disabled={pending} className="bg-blue-600 px-5 py-2 text-sm font-semibold text-[#fff] disabled:opacity-60">
        {pending ? "Menyimpan…" : "Simpan nilai esai"}
      </button>
      <Pesan error={error} info={info} />
    </form>
  );
}

/** Memuat ulang data halaman berkala - memantau siswa yang sedang mengerjakan. */
export function SegarkanOtomatis({ detik = 15 }: { detik?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, detik * 1000);
    return () => clearInterval(id);
  }, [router, detik]);
  return null;
}
