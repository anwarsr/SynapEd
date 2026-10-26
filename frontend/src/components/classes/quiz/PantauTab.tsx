import Link from "next/link";
import UserAvatar from "@/components/ui/UserAvatar";
import BackLink from "@/components/ui/BackLink";
import {
  NilaiEsaiForm,
  ResetPercobaanButton,
  SegarkanOtomatis,
  TambahWaktuForm,
  TutupBukaQuizButton,
} from "@/components/classes/quiz/QuizAksi";
import { jamServer } from "@/lib/classAssignments";
import { listPercobaan, listQuizzes, selesaikanSemua } from "@/lib/classQuizzes";
import {
  LABEL_STATUS_QUIZ,
  durasiDetik,
  formatDurasi,
  hitungNilai,
  sisaDetik,
  statusQuizSiswa,
  type PercobaanQuiz,
  type StatusQuizSiswa,
} from "@/lib/classQuizRules";
import type { KelasMember } from "@/lib/classTypes";
import type { UserCard } from "@/lib/userCards";
import { cn } from "@/lib/cn";

/** Jam & tanggal pendek dalam WIB (zona tetap: server UTC). */
function jamWib(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

const URUTAN: Record<StatusQuizSiswa, number> = { berlangsung: 0, perlu_dinilai: 1, dinilai: 2, belum: 3 };
const WARNA_STATUS: Record<StatusQuizSiswa, string> = {
  belum: "text-ink-muted",
  berlangsung: "text-blue-300",
  perlu_dinilai: "text-blue-400",
  dinilai: "text-ink",
};

const SEGMEN: { s: StatusQuizSiswa; label: string; kelas: string }[] = [
  { s: "dinilai", label: "Selesai", kelas: "bg-blue-600" },
  { s: "perlu_dinilai", label: "Perlu dinilai", kelas: "bg-blue-400" },
  { s: "berlangsung", label: "Mengerjakan", kelas: "pantau-garis bg-blue-300" },
  { s: "belum", label: "Belum mulai", kelas: "bg-white/15" },
];

const ALASAN = { siswa: "mengumpulkan", waktu: "waktu habis, otomatis terkumpul", ditutup: "terkumpul karena quiz ditutup" } as const;

/**
 * Tab "Pantau" (pengelola saja): siapa yang belum/sedang/sudah mengerjakan,
 * kapan mulai & selesai, lama pengerjaan, nilai, ditambah umpan aktivitas.
 * Halaman memuat ulang dirinya tiap 15 dtk selama ada yang mengerjakan.
 *
 * Seluruh data ini HANYA untuk pengelola - pemanggil (ClassRoom) hanya
 * merendernya bila `isOwner`, dan siswa tak pernah menerima data siswa lain
 * kecuali tiga teratas di papan peringkat.
 */
export default async function PantauTab({
  classId,
  basePath,
  quizId,
  members,
  cards,
}: {
  classId: string;
  basePath: string;
  quizId: string | undefined;
  members: readonly KelasMember[];
  cards: ReadonlyMap<string, UserCard>;
}) {
  const terbit = (await listQuizzes(classId)).filter((q) => q.published);

  if (terbit.length === 0) {
    return (
      <div className="bg-white/5 px-8 py-14 text-center">
        <p className="text-[22px] font-medium text-ink">Belum ada quiz untuk dipantau</p>
        <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-[1.7] text-ink-muted">
          Terbitkan quiz di tab Quiz, lalu aktivitas siswa muncul di sini.
        </p>
      </div>
    );
  }

  const quiz = terbit.find((q) => q.id === quizId);
  if (!quiz) {
    return (
      <div className="bg-white/5 px-8 py-14 text-center">
        <p className="text-[22px] font-medium text-ink">Quiz tidak ditemukan</p>
        <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-[1.7] text-ink-muted">
          Buka pemantauan lewat tombol <strong>Pantau</strong> pada quiz yang diterbitkan.
        </p>
        <Link href={`${basePath}?tab=quiz`} className="mt-5 inline-block text-sm font-semibold text-blue-700 hover:underline underline-offset-4">
          ← Ke daftar quiz
        </Link>
      </div>
    );
  }
  const sekarang = jamServer();
  const percobaan = await selesaikanSemua(quiz, await listPercobaan(classId, quiz.id), sekarang);
  const peta = new Map<string, PercobaanQuiz>(percobaan.map((p) => [p.uid, p]));

  // Anggota saat ini + siswa yang sudah keluar tetapi pernah mengerjakan.
  const uidAnggota = new Set(members.map((m) => m.uid));
  const uids = [...members.map((m) => m.uid), ...percobaan.filter((p) => !uidAnggota.has(p.uid)).map((p) => p.uid)];

  const baris = uids
    .map((uid) => {
      const p = peta.get(uid) ?? null;
      return {
        uid,
        p,
        nama: cards.get(uid)?.name ?? "Peserta",
        foto: cards.get(uid)?.photoURL ?? null,
        status: statusQuizSiswa(quiz, p),
        keluar: !uidAnggota.has(uid),
      };
    })
    .sort((a, b) => URUTAN[a.status] - URUTAN[b.status] || a.nama.localeCompare(b.nama, "id"));

  const hitung = (s: StatusQuizSiswa) => baris.filter((b) => b.status === s).length;
  const selesai = baris.filter((b) => b.p?.submittedAt);
  const rata = selesai.length > 0 ? Math.round(selesai.reduce((n, b) => n + hitungNilai(quiz, b.p!).total, 0) / selesai.length) : null;
  const adaBerjalan = hitung("berlangsung") > 0 && !quiz.closed;

  const peristiwa = percobaan
    .flatMap((p) => {
      const nama = cards.get(p.uid)?.name ?? "Peserta";
      const out: { pada: string; teks: string; jenis: "mulai" | "kumpul" | "waktu" }[] = [{ pada: p.startedAt, teks: `${nama} mulai mengerjakan`, jenis: "mulai" }];
      if (p.submittedAt) out.push({ pada: p.submittedAt, teks: `${nama} ${ALASAN[p.finalizedBy ?? "siswa"]}`, jenis: p.finalizedBy === "waktu" ? "waktu" : "kumpul" });
      if (p.extraSec > 0) out.push({ pada: p.startedAt, teks: `${nama} mendapat tambahan waktu ${Math.round(p.extraSec / 60)} menit`, jenis: "waktu" });
      return out;
    })
    .sort((a, b) => b.pada.localeCompare(a.pada))
    .slice(0, 12);

  const nomorSoal = new Map(quiz.questions.map((s, i) => [s.id, i + 1]));

  const total = baris.length;
  const totalDetik = quiz.settings.durationMin !== null ? (quiz.settings.durationMin + quiz.extraMin) * 60 : null;

  return (
    <div>
      {adaBerjalan && <SegarkanOtomatis detik={15} />}

      <BackLink href={`${basePath}?tab=quiz`}>Daftar quiz</BackLink>

      {/* ── Ruang kendali: angka besar + batang sebaran status ── */}
      <section className="mt-9" aria-label="Ringkasan quiz">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div>
            <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.3em] text-ink-muted">
              Ruang pantau
              {adaBerjalan && (
                <span className="inline-flex items-center gap-1.5 text-blue-300">
                  <span className="pantau-titik h-1.5 w-1.5 rounded-full bg-blue-300" aria-hidden="true" />
                  langsung
                </span>
              )}
              {quiz.closed && <span className="text-blue-300">ditutup</span>}
            </p>
            <p className="mt-3 flex items-baseline gap-3">
              <span className="text-[76px] font-extralight leading-none tabular-nums text-ink">{selesai.length}</span>
              <span className="text-[26px] font-extralight tabular-nums text-ink-muted">/ {total}</span>
              <span className="pb-2 text-sm text-ink-muted">sudah mengumpulkan</span>
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-ink-muted">Rata-rata nilai</p>
              <p className="mt-1 text-[40px] font-extralight leading-none tabular-nums text-ink">{rata ?? "-"}</p>
            </div>
            <div className="pb-1 text-[13px] leading-[1.9] text-ink-muted">
              <p>
                {quiz.settings.durationMin !== null
                  ? `${quiz.settings.durationMin + quiz.extraMin} menit per siswa${quiz.extraMin > 0 ? ` (+${quiz.extraMin} untuk semua)` : ""}`
                  : "Tanpa batas waktu"}
                {quiz.opensAt && ` · mulai ${jamWib(quiz.opensAt)} WIB`}
              </p>
              <p className="flex flex-wrap items-center gap-x-5">
                {quiz.settings.durationMin !== null && !quiz.closed && (
                  <TambahWaktuForm classId={classId} quizId={quiz.id} uid={null} label="+ Tambah waktu semua" />
                )}
                <TutupBukaQuizButton classId={classId} quizId={quiz.id} ditutup={quiz.closed} />
              </p>
            </div>
          </div>
        </div>

        {/* Batang sebaran status */}
        <div className="mt-7 flex h-2.5 w-full gap-[3px]" role="img" aria-label={`Sebaran status: ${SEGMEN.map((g) => `${g.label} ${hitung(g.s)}`).join(", ")}`}>
          {total === 0 ? (
            <span className="h-full flex-1 bg-white/10" />
          ) : (
            SEGMEN.filter((g) => hitung(g.s) > 0).map((g) => (
              <span key={g.s} className={cn("h-full transition-[flex-grow] duration-700", g.kelas)} style={{ flexGrow: hitung(g.s), flexBasis: 0 }} />
            ))
          )}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-muted">
          {SEGMEN.map((g) => (
            <li key={g.s} className="inline-flex items-center gap-2">
              <span className={cn("h-2 w-2", g.kelas)} aria-hidden="true" />
              {g.label} <strong className="tabular-nums text-ink">{hitung(g.s)}</strong>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-12 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_250px]">
        {/* ── Lintasan siswa: satu garis waktu per siswa ── */}
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.3em] text-ink-muted">Lintasan pengerjaan</p>
          <ul className="divide-y divide-white/10">
            {baris.map((b) => {
              const p = b.p;
              const nilai = p?.submittedAt ? hitungNilai(quiz, p) : null;
              const sisa = p && !p.submittedAt ? sisaDetik(quiz, p, sekarang) : null;
              const lama = p ? durasiDetik(p) : null;
              const berjalanDetik = p && !p.submittedAt ? Math.max(0, Math.floor((sekarang - Date.parse(p.startedAt)) / 1000)) : null;
              const totalSiswa = totalDetik !== null && p ? totalDetik + p.extraSec : null;
              const dipakai = lama ?? berjalanDetik;
              const frac = totalSiswa && dipakai !== null ? Math.min(1, dipakai / totalSiswa) : 0;
              const essay = quiz.questions.filter((q) => q.type === "essay");
              const bisaTambah = p && quiz.settings.durationMin !== null && !quiz.closed && (!p.submittedAt || p.finalizedBy === "waktu");
              const warna =
                b.status === "berlangsung" ? "pantau-garis bg-blue-300" : p?.finalizedBy === "waktu" ? "bg-blue-800" : p ? "bg-blue-600" : "bg-white/10";

              return (
                <li key={b.uid} className="py-5">
                  <div className="grid items-center gap-x-5 gap-y-3 sm:grid-cols-[200px_minmax(0,1fr)_72px]">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar name={b.nama} photoURL={b.foto} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {b.nama}
                          {b.keluar && <span className="ml-1.5 text-xs font-normal text-ink-muted">(keluar)</span>}
                        </p>
                        <p className={cn("flex items-center gap-1.5 text-xs", WARNA_STATUS[b.status])}>
                          {b.status === "berlangsung" && <span className="pantau-titik h-1.5 w-1.5 rounded-full bg-blue-300" aria-hidden="true" />}
                          {LABEL_STATUS_QUIZ[b.status]}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0">
                      {p ? (
                        <>
                          <div className="relative h-2 w-full bg-white/10" role="img" aria-label={totalSiswa ? `Memakai ${Math.round(frac * 100)}% dari waktu` : "Tanpa batas waktu"}>
                            {totalSiswa ? (
                              <span className={cn("absolute inset-y-0 left-0 transition-[width] duration-700", warna)} style={{ width: `${Math.max(2, frac * 100)}%` }} />
                            ) : (
                              <span className={cn("absolute inset-y-0 left-0 w-full opacity-40", warna)} />
                            )}
                          </div>
                          <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-ink-muted">
                            <span>{jamWib(p.startedAt).split(", ").pop()}</span>
                            <span aria-hidden="true">→</span>
                            <span>{p.submittedAt ? jamWib(p.submittedAt).split(", ").pop() : sisa !== null ? `sisa ${formatDurasi(sisa)}` : "berjalan"}</span>
                            {dipakai !== null && <span className="text-ink-body">· {formatDurasi(dipakai)}</span>}
                            {p.finalizedBy === "waktu" && <span className="text-blue-300">· waktu habis</span>}
                            {p.extraSec > 0 && <span>· +{Math.round(p.extraSec / 60)} mnt</span>}
                          </p>
                        </>
                      ) : (
                        <div className="h-2 w-full bg-white/[0.05]" aria-hidden="true" />
                      )}
                    </div>

                    <p className="text-right sm:order-none">
                      {nilai ? (
                        <>
                          <span className="block text-[30px] font-extralight leading-none tabular-nums text-ink">{nilai.total}</span>
                          {nilai.esaiBelumDinilai > 0 && <span className="text-[10px] uppercase tracking-[0.16em] text-blue-300">sementara</span>}
                        </>
                      ) : (
                        <span className="text-[22px] font-extralight text-ink-muted/50">-</span>
                      )}
                    </p>
                  </div>

                  {p && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 sm:pl-[220px]">
                      {bisaTambah && <TambahWaktuForm classId={classId} quizId={quiz.id} uid={b.uid} label="+ Tambah waktu" />}
                      <ResetPercobaanButton classId={classId} quizId={quiz.id} uid={b.uid} />
                    </div>
                  )}

                  {p?.submittedAt && essay.length > 0 && (
                    <details className="group mt-3 sm:ml-[220px]">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-3 bg-white/[0.07] px-4 py-2.5 text-[12.5px] font-semibold tracking-[0.02em] text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] transition-colors duration-300 hover:bg-white/[0.13] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.32)] group-open:bg-white/[0.12] group-open:shadow-[inset_0_-2px_0_var(--color-blue-500),inset_0_0_0_1px_rgba(255,255,255,0.2)] [&::-webkit-details-marker]:hidden">
                        <svg className="h-3.5 w-3.5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.86 4.49l1.69-1.69a1.88 1.88 0 112.65 2.65L10.58 16.07a4.5 4.5 0 01-1.9 1.13L6 18l.8-2.69a4.5 4.5 0 011.13-1.9l8.93-8.92z" />
                        </svg>
                        <span className="group-open:hidden">Lihat &amp; nilai jawaban esai</span>
                        <span className="hidden group-open:inline">Tutup jawaban esai</span>
                        <svg className="h-3 w-3 text-ink-muted transition-transform duration-300 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="mt-3">
                        <NilaiEsaiForm
                          classId={classId}
                          quizId={quiz.id}
                          uid={b.uid}
                          butir={essay.map((q) => ({
                            id: q.id,
                            nomor: nomorSoal.get(q.id) ?? 0,
                            pertanyaan: q.text,
                            jawaban: p.answers[q.id] ?? "",
                            poin: q.points,
                            nilai: typeof p.essayScores[q.id] === "number" ? p.essayScores[q.id] : null,
                          }))}
                        />
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
            {baris.length === 0 && <li className="py-10 text-center text-sm text-ink-muted">Belum ada peserta di kelas ini.</li>}
          </ul>
        </div>

        {/* ── Garis waktu aktivitas ── */}
        <aside aria-label="Aktivitas terbaru">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-ink-muted">Aktivitas</p>
          {peristiwa.length === 0 ? (
            <p className="text-sm leading-[1.7] text-ink-muted">Belum ada aktivitas.</p>
          ) : (
            <ol className="relative space-y-5 pl-5 before:absolute before:bottom-1 before:left-[3px] before:top-1 before:w-px before:bg-white/15">
              {peristiwa.map((e, i) => (
                <li key={i} className="relative">
                  <span
                    aria-hidden="true"
                    className={cn("absolute -left-5 top-[5px] h-[7px] w-[7px]", e.jenis === "mulai" ? "bg-blue-300" : e.jenis === "waktu" ? "bg-blue-400" : "bg-blue-600")}
                  />
                  <p className="text-[13px] leading-[1.5] text-ink-body">{e.teks}</p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-ink-muted">{jamWib(e.pada)}</p>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
}
