"use client";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  addQuizTime,
  deleteQuiz,
  gradeQuizEssay,
  gradeQuizRubric,
  ikutiQuiz,
  resetQuizAttempt,
  setQuizClosed,
  startQuiz,
  warnQuizStudents,
} from "@/lib/classQuizActions";
import QuizIkon from "@/components/classes/quiz/QuizIkon";
import {
  ANGGOTA_MAKS_BAWAAN,
  ANGGOTA_MIN_BAWAAN,
  MAX_NAMA_KELOMPOK,
  MAX_TAMBAH_MENIT,
  MIN_NAMA_KELOMPOK,
  SKALA_RUBRIK,
  bersihkanNamaAnggota,
  ringkasRubrik,
  type RubrikQuiz,
} from "@/lib/classQuizRules";
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
 * peringatan + alarm 2 detik. Dikonfirmasi dulu karena tak bisa ditarik kembali.
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
        description="Siswa yang belum memulai quiz akan melihat peringatan selebar layar disertai bunyi alarm 2 detik di perangkat mereka."
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

/**
 * Siswa menekan Mulai: percobaan dibuat di server (waktu mulai = saat ini), lalu halaman dimuat ulang.
 * Quiz KELOMPOK meminta nama kelompok + anggotanya dulu, dengan DUA cara memilih anggota: mengetik nama sendiri,
 * atau memilih dari peserta kelas yang sudah bergabung. Server memeriksa ulang semuanya (kolom ini hanya kemudahan;
 * nama anggota yang dipilih dibaca server dari akunnya, bukan dari kiriman ini).
 */
export function MulaiQuizButton({
  classId,
  quizId,
  kelompok = false,
  anggotaKelas = [],
  batas = { min: ANGGOTA_MIN_BAWAAN, maks: ANGGOTA_MAKS_BAWAAN },
}: {
  classId: string;
  quizId: string;
  kelompok?: boolean;
  /** Peserta kelas yang sudah bergabung (tanpa diri sendiri & pengajar). */
  anggotaKelas?: { uid: string; nama: string }[];
  /** Batas jumlah anggota kelompok (termasuk pembuat) dari pengaturan quiz. */
  batas?: { min: number; maks: number };
}) {
  const { pending, error, jalankan } = useAksi();
  const [nama, setNama] = useState("");
  const [mode, setMode] = useState<"ketik" | "pilih">("ketik");
  const [ketik, setKetik] = useState("");
  const [daftarKetik, setDaftarKetik] = useState<string[]>([]);
  const [dipilih, setDipilih] = useState<string[]>([]);
  const [galatLokal, setGalatLokal] = useState<string | null>(null);

  const jumlahLain = mode === "ketik" ? daftarKetik.length : dipilih.length;
  const kurang = kelompok && (nama.trim().length < MIN_NAMA_KELOMPOK || jumlahLain + 1 < batas.min || jumlahLain + 1 > batas.maks);

  function tambahNama() {
    const n = bersihkanNamaAnggota(ketik);
    if (!n) return setGalatLokal("Nama anggota harus 2-40 karakter.");
    if (daftarKetik.some((x) => x.toLowerCase() === n.toLowerCase())) return setGalatLokal("Nama itu sudah ada di daftar.");
    if (daftarKetik.length + 1 >= batas.maks) return setGalatLokal(`Anggota kelompok maksimal ${batas.maks} orang (termasuk Anda).`);
    setGalatLokal(null);
    setDaftarKetik((d) => [...d, n]);
    setKetik("");
  }

  function pilih(uid: string) {
    setGalatLokal(null);
    setDipilih((d) => {
      if (d.includes(uid)) return d.filter((x) => x !== uid);
      if (d.length + 1 >= batas.maks) {
        setGalatLokal(`Anggota kelompok maksimal ${batas.maks} orang (termasuk Anda).`);
        return d;
      }
      return [...d, uid];
    });
  }

  function mulai() {
    if (pending || kurang) return;
    jalankan(() => startQuiz(classId, quizId, kelompok ? nama : undefined, kelompok ? (mode === "pilih" ? { uids: dipilih } : { names: daftarKetik }) : undefined));
  }

  const KOLOM =
    "block w-full bg-white/[0.06] px-4 py-3.5 text-[16px] text-ink outline-none placeholder:text-ink-muted shadow-[inset_0_-2px_0_transparent] focus:shadow-[inset_0_-2px_0_var(--color-blue-500)] disabled:opacity-60";

  return (
    <div>
      {kelompok && (
        <div className="mb-6 max-w-[520px] space-y-6">
          <div>
            <label htmlFor="nama-kelompok" className="text-[11px] font-bold uppercase tracking-[0.3em] text-ink-muted">
              Nama kelompok
            </label>
            <input
              id="nama-kelompok"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              maxLength={MAX_NAMA_KELOMPOK}
              disabled={pending}
              autoComplete="off"
              placeholder="Contoh: Kelompok 3"
              className={cn(KOLOM, "mt-2")}
            />
            <p className="mt-2 text-[13px] leading-[1.7] text-ink-muted">
              Isi sebelum mulai (minimal {MIN_NAMA_KELOMPOK} karakter). Nama dan anggota tidak bisa diubah setelah quiz dimulai. Teman yang Anda pilih dari anggota kelas akan mendapat tombol &quot;Ikuti Quiz&quot; dan menjawab bersama Anda secara langsung.
            </p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-ink-muted">Anggota kelompok</p>
            <p className="mt-2 text-[13px] leading-[1.7] text-ink-muted">Anda otomatis termasuk. Tambahkan anggota lain dengan salah satu cara:</p>
            <div className="mt-3 grid grid-cols-2 gap-px bg-white/10" role="group" aria-label="Cara menambah anggota">
              {(
                [
                  ["ketik", "Isi sendiri"],
                  ["pilih", "Pilih anggota kelas"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={mode === k}
                  disabled={pending}
                  onClick={() => {
                    setMode(k);
                    setGalatLokal(null);
                  }}
                  className={cn("px-4 py-3 text-sm font-semibold transition-colors", mode === k ? "bg-blue-600 text-[#fff]" : "bg-paper-card text-ink hover:bg-white/[0.1]")}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "ketik" ? (
              <div className="mt-4">
                <div className="flex gap-2">
                  <label htmlFor="anggota-ketik" className="sr-only">
                    Nama anggota
                  </label>
                  <input
                    id="anggota-ketik"
                    value={ketik}
                    onChange={(e) => setKetik(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        tambahNama();
                      }
                    }}
                    maxLength={MAX_NAMA_KELOMPOK}
                    disabled={pending}
                    autoComplete="off"
                    placeholder="Nama teman satu kelompok"
                    className={cn(KOLOM, "py-3 text-[15px]")}
                  />
                  <button type="button" onClick={tambahNama} disabled={pending} className="shrink-0 bg-white/[0.1] px-5 text-sm font-semibold text-ink hover:bg-white/[0.18] disabled:opacity-50">
                    Tambah
                  </button>
                </div>
                {daftarKetik.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {daftarKetik.map((n) => (
                      <li key={n} className="flex items-center gap-2 bg-white/[0.08] py-1.5 pl-3 pr-1.5 text-sm text-ink">
                        {n}
                        <button
                          type="button"
                          aria-label={`Hapus ${n}`}
                          onClick={() => setDaftarKetik((d) => d.filter((x) => x !== n))}
                          className="h-6 w-6 bg-white/[0.08] text-xs text-ink-muted hover:bg-white/[0.18] hover:text-ink"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="mt-4">
                {anggotaKelas.length === 0 ? (
                  <p className="bg-white/[0.05] px-4 py-3 text-[13px] leading-[1.7] text-ink-muted">Belum ada peserta lain yang bergabung di kelas ini. Gunakan &quot;Isi sendiri&quot;.</p>
                ) : (
                  <ul className="max-h-[260px] divide-y divide-white/[0.06] overflow-y-auto bg-white/[0.04]">
                    {anggotaKelas.map((a) => {
                      const aktif = dipilih.includes(a.uid);
                      return (
                        <li key={a.uid}>
                          <label className={cn("flex cursor-pointer items-center gap-3 px-4 py-3 text-sm text-ink transition-colors hover:bg-white/[0.06]", aktif && "bg-blue-600/15")}>
                            <input type="checkbox" checked={aktif} disabled={pending} onChange={() => pilih(a.uid)} className="h-4 w-4 accent-[#2F6FED]" />
                            <span className="min-w-0 truncate">{a.nama}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
            <p className="mt-2 text-[13px] text-ink-muted">
              {jumlahLain} anggota lain dipilih (total {jumlahLain + 1} dengan Anda). Kelompok harus {batas.min === batas.maks ? `${batas.min} orang` : `${batas.min}-${batas.maks} orang`}.
            </p>
            {galatLokal && (
              <p role="alert" className="mt-1 text-xs text-rust-700">
                {galatLokal}
              </p>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        disabled={pending || kurang}
        onClick={mulai}
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

/**
 * Anggota yang diajak ke sebuah kelompok melihat tombol ini: sekali tekan langsung bergabung dan mengerjakan
 * bersama (jawaban tampil langsung di antara anggota yang sudah ikut).
 */
export function IkutiQuizButton({ classId, quizId, namaKelompok }: { classId: string; quizId: string; namaKelompok: string }) {
  const { pending, error, jalankan } = useAksi();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => jalankan(() => ikutiQuiz(classId, quizId))}
        className="group inline-flex items-center gap-3 bg-blue-600 px-9 py-4 text-[14px] font-semibold tracking-[0.04em] text-[#fff] transition-colors hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Bergabung…" : `Ikuti Quiz “${namaKelompok}”`}
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
  /** Soal TABEL: tampilan jawaban (tanpa kunci; pengajar yang memeriksa dan memberi poin). */
  tampilan?: ReactNode;
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
          {b.tampilan ?? (
            <p className="mt-3 whitespace-pre-line break-words bg-white/[0.04] px-3 py-2.5 text-sm leading-[1.7] text-ink-body">
              {b.jawaban || <span className="text-ink-muted">(tidak dijawab)</span>}
            </p>
          )}
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
        {pending ? "Menyimpan…" : "Simpan nilai"}
      </button>
      <Pesan error={error} info={info} />
    </form>
  );
}

/**
 * Pengajar menilai rubrik seorang ANGGOTA kelompok: tiap poin penilaian dari semua tabel diberi skor 1-4. Menyimpan boleh
 * sebagian (yang terisi saja); nilai akhir baru final setelah SEMUA poin diberi skor. Pratinjau memakai rumus yang
 * sama dengan server (`ringkasRubrik` + bobot), tetapi yang berlaku tetap hitungan server.
 */
export function NilaiRubrikForm({
  classId,
  quizId,
  uid,
  kunci,
  rubrik,
  skorAwal,
}: {
  classId: string;
  quizId: string;
  /** Siapa saja di kelompok itu (untuk menemukan percobaannya). */
  uid: string;
  /** Kunci anggota yang dinilai. */
  kunci: string;
  rubrik: RubrikQuiz;
  skorAwal: Record<string, number>;
}) {
  const { pending, error, info, jalankan } = useAksi();
  const [skor, setSkor] = useState<Record<string, number>>(skorAwal);
  const r = ringkasRubrik(rubrik, skor);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        jalankan(() => gradeQuizRubric(classId, quizId, uid, kunci, skor));
      }}
    >
      {rubrik.tables.map((tb, i) => (
        <div key={tb.id} className="bg-white/[0.05] p-4">
          <p className="text-xs font-bold tracking-[0.2em] text-blue-700">RUBRIK {i + 1}</p>
          <p className="mt-1 text-sm font-semibold text-ink">{tb.title || `Rubrik ${i + 1}`}</p>
          {/* Tiap poin: teks di atas, empat pilihan skor sebaris di bawahnya (muat di kolom sempit tanpa menggulir mendatar). */}
          <ul className="mt-3 divide-y divide-white/[0.06]">
            {tb.criteria.map((k) => (
              <li key={k.id} className="py-3">
                <p className="text-sm font-medium text-ink-body">{k.text}</p>
                <div className="mt-2 grid grid-cols-4 gap-1" role="radiogroup" aria-label={k.text}>
                  {SKALA_RUBRIK.map((s) => (
                    <label
                      key={s.n}
                      className={cn(
                        "flex cursor-pointer flex-col items-center gap-1 px-1 py-2 text-center transition-colors hover:bg-white/[0.1]",
                        skor[k.id] === s.n ? "bg-blue-600/30 shadow-[inset_0_-2px_0_var(--color-blue-500)]" : "bg-white/[0.05]",
                      )}
                    >
                      <input
                        type="radio"
                        name={`rb-${kunci}-${k.id}`}
                        checked={skor[k.id] === s.n}
                        onChange={() => setSkor((x) => ({ ...x, [k.id]: s.n }))}
                        aria-label={`${k.text}: ${s.n} ${s.label}`}
                        className="h-4 w-4 accent-[#2F6FED]"
                      />
                      <span className="text-sm font-semibold text-ink">{s.n}</span>
                      <span className="text-[10px] leading-tight text-ink-muted">{s.label}</span>
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="text-[13px] leading-[1.7] text-ink-muted">
        {r.belum > 0
          ? `${r.belum} dari ${r.jumlah} poin penilaian belum diberi skor. Nilai individu menyusul setelah semuanya terisi.`
          : `Nilai individu ${r.persen}% (jumlah skor ${r.skor} dari maksimal ${r.jumlah * 4}). Berdiri sendiri, terpisah dari nilai kelompok.`}
      </p>
      <button type="submit" disabled={pending} className="bg-blue-600 px-5 py-2 text-sm font-semibold text-[#fff] disabled:opacity-60">
        {pending ? "Menyimpan…" : "Simpan skor rubrik"}
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
