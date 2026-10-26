"use client";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveQuiz } from "@/lib/classQuizActions";
import { inputWibKeIso, isoKeInputWib } from "@/lib/classAssignmentRules";
import {
  MAX_DESKRIPSI_QUIZ,
  MAX_DURASI_MENIT,
  MAX_JUDUL_QUIZ,
  MAX_OPSI,
  MAX_SOAL,
  MAX_TEKS_OPSI,
  MAX_TEKS_SOAL,
  MIN_OPSI,
  TOTAL_POIN,
  bagiRataPoin,
  idBaru,
  jumlahPoin,
  type JenisSoal,
  type Quiz,
  type SetelanQuiz,
  type SoalQuiz,
} from "@/lib/classQuizRules";
import { cn } from "@/lib/cn";

const KOLOM =
  "block w-full bg-white/[0.06] px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted outline-none " +
  "shadow-[inset_0_-2px_0_transparent] focus:shadow-[inset_0_-2px_0_var(--color-blue-500)] disabled:opacity-60";

const TOMBOL_IKON =
  "flex h-8 w-8 shrink-0 items-center justify-center text-ink-muted transition-colors hover:bg-white/10 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

function soalBaru(ada: readonly SoalQuiz[], type: JenisSoal): SoalQuiz {
  const id = idBaru(ada.map((s) => s.id));
  if (type === "essay") return { id, type, text: "", points: 0, options: [], correct: null };
  const o1 = idBaru([]);
  const o2 = idBaru([o1]);
  return {
    id,
    type,
    text: "",
    points: 0,
    options: [
      { id: o1, text: "" },
      { id: o2, text: "" },
    ],
    correct: o1,
  };
}

/**
 * Pembuat quiz ala Google Form: tiap nomor punya jenis (pilihan ganda / esai),
 * poin sendiri, dan - untuk pilihan ganda - kunci jawaban. Total poin dijaga
 * tepat 100 saat diterbitkan ("Bagi rata poin" membantu).
 *
 * `terkunci` (sudah ada yang mengerjakan): hanya poin, judul, deskripsi, dan
 * setelan yang bisa diubah; server menolak perubahan soal sekalipun tombolnya
 * dibuka lewat devtools.
 */
export default function QuizBuilder({
  classId,
  awal,
  terkunci = false,
}: {
  classId: string;
  /** Quiz yang disunting; tanpa ini = quiz baru. */
  awal?: Quiz;
  terkunci?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [judul, setJudul] = useState(awal?.title ?? "");
  const [deskripsi, setDeskripsi] = useState(awal?.description ?? "");
  const [soal, setSoal] = useState<SoalQuiz[]>(awal?.questions ?? []);
  const [setelan, setSetelan] = useState<SetelanQuiz>(
    awal?.settings ?? { shuffleQuestions: false, shuffleOptions: false, durationMin: null },
  );
  const [batasWaktu, setBatasWaktu] = useState(awal?.settings.durationMin !== null && awal !== undefined);
  const [menitText, setMenitText] = useState(String(awal?.settings.durationMin ?? 30));

  const [terjadwal, setTerjadwal] = useState(awal?.opensAt != null);
  const [mulaiText, setMulaiText] = useState(isoKeInputWib(awal?.opensAt ?? null));

  const total = useMemo(() => jumlahPoin(soal), [soal]);
  const terbit = awal?.published === true;

  function ubahSoal(id: string, patch: Partial<SoalQuiz>) {
    setSoal((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function ubahJenis(q: SoalQuiz, type: JenisSoal) {
    if (type === q.type) return;
    const dasar = soalBaru([], type);
    ubahSoal(q.id, { type, options: dasar.options, correct: dasar.correct });
  }

  function ubahOpsi(q: SoalQuiz, oid: string, text: string) {
    ubahSoal(q.id, { options: q.options.map((o) => (o.id === oid ? { ...o, text } : o)) });
  }

  function tambahOpsi(q: SoalQuiz) {
    if (q.options.length >= MAX_OPSI) return;
    ubahSoal(q.id, { options: [...q.options, { id: idBaru(q.options.map((o) => o.id)), text: "" }] });
  }

  function hapusOpsi(q: SoalQuiz, oid: string) {
    if (q.options.length <= MIN_OPSI) return;
    const sisa = q.options.filter((o) => o.id !== oid);
    ubahSoal(q.id, { options: sisa, correct: q.correct === oid ? (sisa[0]?.id ?? null) : q.correct });
  }

  function geser(i: number, arah: -1 | 1) {
    setSoal((s) => {
      const j = i + arah;
      if (j < 0 || j >= s.length) return s;
      const n = [...s];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }

  function gandakan(q: SoalQuiz) {
    setSoal((s) => {
      if (s.length >= MAX_SOAL) return s;
      const id = idBaru(s.map((x) => x.id));
      const opsi = q.options.map((o) => ({ id: idBaru([]), text: o.text }));
      const idx = q.options.findIndex((o) => o.id === q.correct);
      const salinan: SoalQuiz = { ...q, id, options: opsi, correct: idx >= 0 ? opsi[idx].id : null };
      const pos = s.findIndex((x) => x.id === q.id);
      return [...s.slice(0, pos + 1), salinan, ...s.slice(pos + 1)];
    });
  }

  function simpan(terbitkan: boolean) {
    setError(null);
    setInfo(null);

    const menit = batasWaktu ? Number(menitText) : null;
    let opensAt: string | null = null;
    if (terjadwal) {
      opensAt = inputWibKeIso(mulaiText);
      if (!opensAt) return setError("Isi tanggal dan jam mulai quiz.");
    }
    startTransition(async () => {
      const res = await saveQuiz(
        classId,
        awal?.id ?? null,
        { title: judul, description: deskripsi, opensAt, questions: soal, settings: { ...setelan, durationMin: menit } },
        terbitkan,
      );
      if (!res.ok) return setError(res.error);
      if (!awal && res.quizId) return router.replace(`/educator/classes/${classId}/quiz/${res.quizId}`);
      setInfo(res.message);
      router.refresh();
    });
  }

  const totalSah = total === TOTAL_POIN;
  const sibuk = pending;

  return (
    <div className="mx-auto max-w-[760px] pb-28">
      {terkunci && (
        <p className="mb-4 bg-white/[0.06] px-5 py-4 text-sm leading-[1.7] text-ink-body shadow-[inset_3px_0_0_var(--color-blue-500)]">
          Quiz ini sudah dikerjakan siswa, jadi soal dan pilihannya dikunci. Anda masih bisa mengubah <strong>poin tiap
          soal</strong> (nilai siswa dihitung ulang otomatis), judul, deskripsi, dan setelan.
        </p>
      )}

      {/* Judul */}
      <div className="bg-paper-card p-6 shadow-[inset_0_3px_0_var(--color-blue-500)]">
        <label htmlFor="quiz-judul" className="sr-only">
          Judul quiz
        </label>
        <input
          id="quiz-judul"
          value={judul}
          onChange={(e) => setJudul(e.target.value)}
          maxLength={MAX_JUDUL_QUIZ}
          disabled={sibuk}
          placeholder="Judul quiz"
          className={cn(KOLOM, "text-[22px] font-semibold")}
        />
        <label htmlFor="quiz-deskripsi" className="sr-only">
          Deskripsi quiz
        </label>
        <textarea
          id="quiz-deskripsi"
          value={deskripsi}
          onChange={(e) => setDeskripsi(e.target.value)}
          maxLength={MAX_DESKRIPSI_QUIZ}
          rows={2}
          disabled={sibuk}
          placeholder="Petunjuk pengerjaan (opsional)"
          className={cn(KOLOM, "mt-2 resize-y leading-[1.6]")}
        />
      </div>

      {/* Setelan */}
      <section className="mt-4 bg-paper-card p-6" aria-labelledby="quiz-setelan">
        <p id="quiz-setelan" className="t-label mb-4 text-ink-muted">
          Setelan quiz
        </p>
        <div className="space-y-4">
          <div>
            <Sakelar
              label="Jadwalkan waktu mulai"
              ket="Matikan agar quiz langsung bisa dikerjakan begitu diterbitkan. Nyalakan untuk menentukan hari, tanggal, dan jam mulai; sebelum itu siswa melihat quiz tetapi belum bisa memulai."
              nilai={terjadwal}
              ubah={setTerjadwal}
              disabled={sibuk}
            />
            {terjadwal && (
              <div className="mt-3 pl-[52px]">
                <label htmlFor="quiz-mulai" className="sr-only">
                  Tanggal dan jam mulai (WIB)
                </label>
                <input
                  id="quiz-mulai"
                  type="datetime-local"
                  value={mulaiText}
                  onChange={(e) => setMulaiText(e.target.value)}
                  disabled={sibuk}
                  className={cn(KOLOM, "w-64")}
                />
                <p className="mt-1.5 text-xs text-ink-muted">Zona waktu WIB. Jam server yang dipakai, bukan jam perangkat siswa.</p>
              </div>
            )}
          </div>
          <Sakelar
            label="Acak urutan soal untuk tiap siswa"
            ket="Tiap siswa mendapat urutan nomor berbeda, sehingga sulit mencontek teman."
            nilai={setelan.shuffleQuestions}
            ubah={(v) => setSetelan((s) => ({ ...s, shuffleQuestions: v }))}
            disabled={sibuk}
          />
          <Sakelar
            label="Acak urutan pilihan jawaban"
            ket="Urutan A-B-C-D pilihan ganda juga berbeda untuk tiap siswa."
            nilai={setelan.shuffleOptions}
            ubah={(v) => setSetelan((s) => ({ ...s, shuffleOptions: v }))}
            disabled={sibuk}
          />
          <div>
            <Sakelar
              label="Batasi waktu pengerjaan"
              ket="Dihitung sejak siswa menekan Mulai. Habis waktu, quiz otomatis dikumpulkan. Tambahan waktu bisa diberikan lewat tombol Pantau pada quiz."
              nilai={batasWaktu}
              ubah={setBatasWaktu}
              disabled={sibuk}
            />
            {batasWaktu && (
              <div className="mt-3 flex items-center gap-3 pl-[52px]">
                <label htmlFor="quiz-menit" className="sr-only">
                  Waktu pengerjaan dalam menit
                </label>
                <input
                  id="quiz-menit"
                  type="number"
                  min={1}
                  max={MAX_DURASI_MENIT}
                  value={menitText}
                  onChange={(e) => setMenitText(e.target.value)}
                  disabled={sibuk}
                  className={cn(KOLOM, "w-28")}
                />
                <span className="text-sm text-ink-muted">menit</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Soal */}
      <ol className="mt-4 space-y-4">
        {soal.map((q, i) => {
          const kunci = terkunci;
          return (
            <li key={q.id} className="bg-paper-card p-6">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="text-[13px] font-bold tracking-[0.2em] text-blue-700">
                  SOAL {String(i + 1).padStart(2, "0")}
                </span>

                <PilihJenis
                  label={`Jenis soal ${i + 1}`}
                  nilai={q.type}
                  ubah={(t) => ubahJenis(q, t)}
                  disabled={sibuk || kunci}
                />

                <span className="ml-auto flex items-center gap-2">
                  <label htmlFor={`poin-${q.id}`} className="text-xs text-ink-muted">
                    Poin
                  </label>
                  <InputPoin
                    id={`poin-${q.id}`}
                    nilai={q.points}
                    ubah={(n) => ubahSoal(q.id, { points: n })}
                    disabled={sibuk}
                    className={cn(KOLOM, "w-20 text-center font-semibold")}
                  />
                </span>
              </div>

              <label className="sr-only" htmlFor={`teks-${q.id}`}>
                Pertanyaan {i + 1}
              </label>
              <textarea
                id={`teks-${q.id}`}
                value={q.text}
                onChange={(e) => ubahSoal(q.id, { text: e.target.value })}
                maxLength={MAX_TEKS_SOAL}
                rows={2}
                disabled={sibuk || kunci}
                placeholder="Tulis pertanyaan"
                className={cn(KOLOM, "resize-y leading-[1.6]")}
              />

              {q.type === "mcq" ? (
                <div className="mt-4 space-y-2" role="radiogroup" aria-label={`Pilihan soal ${i + 1}`}>
                  {q.options.map((o, j) => (
                    <div key={o.id} className="flex items-center gap-3">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={q.correct === o.id}
                        aria-label={`Jadikan pilihan ${j + 1} sebagai jawaban benar`}
                        title="Jawaban benar"
                        disabled={sibuk || kunci}
                        onClick={() => ubahSoal(q.id, { correct: o.id })}
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors",
                          q.correct === o.id ? "bg-blue-600" : "bg-white/10 hover:bg-white/20",
                        )}
                      >
                        {q.correct === o.id && <span className="h-1.5 w-1.5 rounded-full bg-[#fff]" />}
                      </button>
                      <input
                        aria-label={`Pilihan ${j + 1} soal ${i + 1}`}
                        value={o.text}
                        onChange={(e) => ubahOpsi(q, o.id, e.target.value)}
                        maxLength={MAX_TEKS_OPSI}
                        disabled={sibuk || kunci}
                        placeholder={`Pilihan ${j + 1}`}
                        className={KOLOM}
                      />
                      <button
                        type="button"
                        aria-label={`Hapus pilihan ${j + 1}`}
                        disabled={sibuk || kunci || q.options.length <= MIN_OPSI}
                        onClick={() => hapusOpsi(q, o.id)}
                        className={TOMBOL_IKON}
                      >
                        <Ikon d="M6 18L18 6M6 6l12 12" />
                      </button>
                    </div>
                  ))}
                  {q.options.length < MAX_OPSI && (
                    <button
                      type="button"
                      disabled={sibuk || kunci}
                      onClick={() => tambahOpsi(q)}
                      className="ml-8 text-sm font-medium text-blue-700 transition-colors hover:underline disabled:opacity-50"
                    >
                      + Tambah pilihan
                    </button>
                  )}
                  <p className="ml-8 text-xs text-ink-muted">Klik lingkaran untuk menandai jawaban yang benar.</p>
                </div>
              ) : (
                <p className="mt-4 bg-white/[0.04] px-4 py-3 text-sm text-ink-muted">
                  Siswa menjawab dengan teks bebas. Esai dinilai manual oleh pengajar (0 sampai poin soal) lewat tombol Pantau pada quiz.
                </p>
              )}

              <div className="mt-4 flex items-center justify-end gap-1">
                <button type="button" aria-label="Naikkan soal" disabled={sibuk || kunci || i === 0} onClick={() => geser(i, -1)} className={TOMBOL_IKON}>
                  <Ikon d="M5 15l7-7 7 7" />
                </button>
                <button type="button" aria-label="Turunkan soal" disabled={sibuk || kunci || i === soal.length - 1} onClick={() => geser(i, 1)} className={TOMBOL_IKON}>
                  <Ikon d="M19 9l-7 7-7-7" />
                </button>
                <button type="button" aria-label="Gandakan soal" title="Gandakan" disabled={sibuk || kunci || soal.length >= MAX_SOAL} onClick={() => gandakan(q)} className={TOMBOL_IKON}>
                  <Ikon d="M8 7h8a2 2 0 012 2v8M6 9h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2V9z" />
                </button>
                <button type="button" aria-label="Hapus soal" title="Hapus soal" disabled={sibuk || kunci} onClick={() => setSoal((s) => s.filter((x) => x.id !== q.id))} className={cn(TOMBOL_IKON, "hover:!text-rust-700")}>
                  <Ikon d="M6 7h12M9 7V5h6v2m-8 0l1 12h8l1-12" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {!terkunci && (
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              { t: "mcq", l: "+ Pilihan ganda" },
              { t: "essay", l: "+ Esai" },
            ] as const
          ).map((b) => (
            <button
              key={b.t}
              type="button"
              disabled={sibuk || soal.length >= MAX_SOAL}
              onClick={() => setSoal((s) => [...s, soalBaru(s, b.t)])}
              className="bg-white/[0.06] px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              {b.l}
            </button>
          ))}
          <span className="self-center text-xs text-ink-muted">
            {soal.length}/{MAX_SOAL} soal
          </span>
        </div>
      )}

      {/* Bilah aksi melekat di bawah */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-header/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[760px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <p className="text-sm" aria-live="polite">
            <span className="text-ink-muted">Total poin </span>
            <strong className={cn("text-[17px]", totalSah ? "text-blue-700" : "text-ink")}>{total}</strong>
            <span className="text-ink-muted"> / {TOTAL_POIN}</span>
          </p>
          <button
            type="button"
            disabled={sibuk || soal.length === 0}
            onClick={() => setSoal((s) => s.map((x, i) => ({ ...x, points: bagiRataPoin(s.length)[i] })))}
            className="text-sm font-medium text-blue-700 transition-colors hover:underline disabled:opacity-50"
          >
            Bagi rata poin
          </button>

          <span className="ml-auto flex flex-wrap items-center gap-2">
            {!terbit && (
              <button
                type="button"
                disabled={sibuk}
                onClick={() => simpan(false)}
                className="bg-white/10 px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-white/20 disabled:opacity-60"
              >
                {pending ? "Menyimpan…" : "Simpan draf"}
              </button>
            )}
            <button
              type="button"
              disabled={sibuk}
              onClick={() => simpan(true)}
              className="bg-blue-600 px-6 py-2.5 text-sm font-semibold text-[#fff] transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? "Menyimpan…" : terbit ? "Simpan perubahan" : "Terbitkan"}
            </button>
          </span>
        </div>
        {(error || info) && (
          <p role={error ? "alert" : "status"} className={cn("mx-auto max-w-[760px] px-4 pb-3 text-sm", error ? "text-rust-700" : "text-blue-700")}>
            {error ?? info}
          </p>
        )}
      </div>
    </div>
  );
}

const JENIS: { id: JenisSoal; label: string; ket: string; ikon: string }[] = [
  { id: "mcq", label: "Pilihan ganda", ket: "Dinilai otomatis", ikon: "M5 12h14M5 6h14M5 18h9" },
  { id: "essay", label: "Esai", ket: "Dinilai pengajar", ikon: "M4 6h16M4 12h16M4 18h10" },
];

/**
 * Pemilih jenis soal berupa daftar buatan sendiri (bukan <select>): daftar
 * bawaan peramban tak bisa diberi gaya dan tampil kaku di tema gelap. Memenuhi
 * pola listbox: panah atas/bawah, Enter/spasi memilih, Esc & klik di luar menutup.
 */
function PilihJenis({
  label,
  nilai,
  ubah,
  disabled,
}: {
  label: string;
  nilai: JenisSoal;
  ubah: (t: JenisSoal) => void;
  disabled?: boolean;
}) {
  const [buka, setBuka] = useState(false);
  const [sorot, setSorot] = useState(0);
  const akar = useRef<HTMLDivElement>(null);
  const idDaftar = useId();
  const aktif = JENIS.find((j) => j.id === nilai) ?? JENIS[0];

  useEffect(() => {
    if (!buka) return;
    const luar = (e: PointerEvent) => {
      if (!akar.current?.contains(e.target as Node)) setBuka(false);
    };
    document.addEventListener("pointerdown", luar);
    return () => document.removeEventListener("pointerdown", luar);
  }, [buka]);

  function pilih(t: JenisSoal) {
    setBuka(false);
    ubah(t);
  }

  function tombol(e: React.KeyboardEvent) {
    if (e.key === "Escape") return setBuka(false);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!buka) {
        setSorot(JENIS.findIndex((j) => j.id === nilai));
        return setBuka(true);
      }
      setSorot((n) => (n + (e.key === "ArrowDown" ? 1 : JENIS.length - 1)) % JENIS.length);
    } else if ((e.key === "Enter" || e.key === " ") && buka) {
      e.preventDefault();
      pilih(JENIS[sorot].id);
    }
  }

  return (
    <div ref={akar} className="relative">
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={buka}
        aria-controls={idDaftar}
        disabled={disabled}
        onClick={() => {
          setSorot(JENIS.findIndex((j) => j.id === nilai));
          setBuka((b) => !b);
        }}
        onKeyDown={tombol}
        className={cn(
          "flex min-w-[176px] items-center gap-3 bg-white/[0.06] px-3.5 py-2 text-left text-sm font-medium text-ink transition-colors",
          "hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60",
          buka && "bg-white/10 shadow-[inset_0_-2px_0_var(--color-blue-500)]",
        )}
      >
        <Ikon d={aktif.ikon} />
        <span className="flex-1">{aktif.label}</span>
        <svg
          className={cn("h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200", buka && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {buka && (
        <ul
          id={idDaftar}
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-full z-30 mt-1 min-w-full bg-paper-card py-1 shadow-[0_14px_36px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(255,255,255,0.1)]"
        >
          {JENIS.map((j, n) => (
            <li
              key={j.id}
              role="option"
              aria-selected={j.id === nilai}
              onPointerEnter={() => setSorot(n)}
              onClick={() => pilih(j.id)}
              className={cn(
                "flex cursor-pointer items-center gap-3 px-3.5 py-2.5 transition-colors",
                n === sorot ? "bg-white/10" : "",
              )}
            >
              <span className={cn("shrink-0", j.id === nilai ? "text-blue-700" : "text-ink-muted")}>
                <Ikon d={j.ikon} />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium text-ink">{j.label}</span>
                <span className="block text-[11px] text-ink-muted">{j.ket}</span>
              </span>
              {j.id === nilai && (
                <svg className="h-4 w-4 shrink-0 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Isian poin yang bisa diketik bebas: tanpa panah naik-turun, dan boleh
 * dikosongkan sementara (kosong dihitung 0). Hanya angka 0-100 yang diterima;
 * angka 0 di depan dibuang ("010" → 10). Saat tidak sedang diedit, tampilannya
 * mengikuti nilai induk (mis. setelah "Bagi rata poin").
 */
function InputPoin({
  id,
  nilai,
  ubah,
  disabled,
  className,
}: {
  id: string;
  nilai: number;
  ubah: (n: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [teks, setTeks] = useState<string | null>(null);

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={teks ?? String(nilai)}
      disabled={disabled}
      className={className}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const angka = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 3);
        const n = Math.min(TOTAL_POIN, Number(angka || 0));
        setTeks(angka === "" ? "" : String(n));
        ubah(n);
      }}
      onBlur={() => setTeks(null)}
    />
  );
}

function Ikon({ d }: { d: string }) {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

/** Sakelar dengan keterangan, gaya persegi situs ini. */
function Sakelar({
  label,
  ket,
  nilai,
  ubah,
  disabled,
}: {
  label: string;
  ket: string;
  nilai: boolean;
  ubah: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={nilai}
        aria-label={label}
        disabled={disabled}
        onClick={() => ubah(!nilai)}
        className={cn("relative mt-0.5 h-6 w-10 shrink-0 transition-colors disabled:opacity-60", nilai ? "bg-blue-600" : "bg-white/15")}
      >
        <span className={cn("absolute top-1 h-4 w-4 bg-[#fff] transition-all", nilai ? "left-5" : "left-1")} />
      </button>
      <div>
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="mt-0.5 text-[13px] leading-[1.6] text-ink-muted">{ket}</p>
      </div>
    </div>
  );
}
