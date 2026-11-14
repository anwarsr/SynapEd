import { notFound } from "next/navigation";
import EducatorShell from "@/components/educator/EducatorShell";
import AssignmentDetail from "@/components/classes/AssignmentDetail";
import EditPost from "@/components/classes/EditPost";
import AiGradingSettings from "@/components/classes/AiGradingSettings";
import ClassGradeForm from "@/components/classes/ClassGradeForm";
import DeleteButton from "@/components/classes/DeleteButton";
import Lampiran, { hrefJawaban } from "@/components/classes/Lampiran";
import DaftarPengumpulan from "@/components/classes/DaftarPengumpulan";
import { getPost, listClassMembers } from "@/lib/classes";
import { requireOwnedClass } from "@/lib/classGuards";
import { getPengaturanAi, jamServer, listPostSubmissions } from "@/lib/classAssignments";
import { formatWib, formatWibPendek, statusTugas, type KelasSubmission } from "@/lib/classAssignmentRules";
import { statistikNilai, type BarisPengumpulan } from "@/lib/pengumpulanTugas";
import { getUserCards } from "@/lib/userCards";
import { requireUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string; postId: string }>;
}

export const metadata: Metadata = { title: "Tugas – SynapEd" };

export const dynamic = "force-dynamic";

/**
 * Halaman satu tugas dari sisi pengelola: instruksi, pengaturan tenggat, dan
 * daftar seluruh siswa beserta pengiriman & penilaiannya.
 *
 * Penjaganya requireUser + requireOwnedClass (bukan requireEducator) supaya
 * admin tetap bisa memoderasi — alasan yang sama dengan halaman kelasnya.
 */
export default async function TugasPengajarPage({ params }: Props) {
  const { id, postId } = await params;
  const user = await requireUser(`/educator/classes/${id}/tugas/${postId}`);

  const kelas = await requireOwnedClass(user, id);
  if (!kelas) notFound();

  const post = await getPost(id, postId);
  if (!post || post.kind !== "assignment" || !post.assignment) notFound();
  const p = post.assignment;

  const [members, subs, ai] = await Promise.all([
    listClassMembers(id),
    listPostSubmissions(id, postId),
    // Hanya halaman pengelola yang membaca ini — berkasnya bisa kunci jawaban.
    getPengaturanAi(id, postId),
  ]);

  // Anggota saat ini, ditambah pengirim yang sudah keluar dari kelas —
  // jawabannya tetap milik catatan pengajar.
  const perUid = new Map<string, KelasSubmission>(subs.map((s) => [s.uid, s]));
  const uidAnggota = new Set(members.map((m) => m.uid));
  const uids = [...members.map((m) => m.uid), ...subs.filter((s) => !uidAnggota.has(s.uid)).map((s) => s.uid)];

  const kartu = await getUserCards([post.authorUid, ...uids]);
  const saat = jamServer();

  // Tanggal diformat DI SERVER (WIB): Intl Node vs peramban bisa berbeda tanda baca.
  const baris: BarisPengumpulan[] = uids.map((uid) => {
    const sub = perUid.get(uid) ?? null;
    return {
      uid,
      nama: kartu.get(uid)?.name ?? "Peserta",
      foto: kartu.get(uid)?.photoURL ?? null,
      status: statusTugas(sub, p, saat),
      keluar: !uidAnggota.has(uid),
      dikirimIso: sub?.submittedAt ?? null,
      dikirimTeks: sub ? formatWibPendek(sub.submittedAt) : null,
      dikirimLengkap: sub ? formatWib(sub.submittedAt) : null,
      terlambat: sub?.late === true,
      nilai: sub?.status === "graded" ? sub.grade : null,
    };
  });

  // Isi baris yang dibuka: jawaban + formulir nilai, dirender di server.
  const detail: Record<string, React.ReactNode> = {};
  for (const s of subs) {
    detail[s.uid] = (
      <>
        {s.text && (
          <p className="max-h-96 overflow-y-auto whitespace-pre-line break-words bg-white/[0.06] px-4 py-3 text-sm leading-[1.7] text-ink-body">
            {s.text}
          </p>
        )}
        <Lampiran files={s.files} hrefs={s.files.map((_, i) => hrefJawaban(s.id, i))} className={s.text ? "mt-3" : ""} />
        {!s.text && s.files.length === 0 && <p className="text-sm text-ink-muted">Kiriman kosong.</p>}
        <ClassGradeForm
          classId={id}
          postId={postId}
          studentUid={s.uid}
          maxPoints={p.maxPoints}
          grade={s.grade}
          feedback={s.feedback}
          aiIsiKomentar={ai.fillComment}
        />
      </>
    );
  }

  const terkumpul = subs.length;
  const dinilai = subs.filter((s) => s.status === "graded").length;
  const statistik = statistikNilai(
    subs.flatMap((s) => (s.status === "graded" && s.grade !== null ? [s.grade] : [])),
    p.maxPoints,
  );
  const sebaranMaks = Math.max(1, ...(statistik?.sebaran.map((x) => x.jumlah) ?? [0]));

  return (
    <EducatorShell user={user} duaPanel>
      <AssignmentDetail
        duaPanel
        post={post}
        namaKelas={kelas.name}
        pengajar={kartu.get(post.authorUid)}
        kembali={`/educator/classes/${id}?tab=tugas`}
        saat={saat}
        aksi={<EditPost classId={id} post={post} />}
        samping={
          <>
            <div className="bg-paper-card p-6">
              <p className="t-label mb-4 text-ink-muted">Ringkasan</p>
              <dl className="divide-y divide-rule">
                {[
                  { label: "Terkumpul", nilai: `${terkumpul}/${members.length}` },
                  { label: "Dinilai", nilai: String(dinilai) },
                  { label: "Perlu dinilai", nilai: String(terkumpul - dinilai) },
                ].map((b) => (
                  <div key={b.label} className="flex items-center justify-between py-2.5">
                    <dt className="text-sm text-ink-muted">{b.label}</dt>
                    <dd className="text-[17px] leading-none tabular-nums text-ink">{b.nilai}</dd>
                  </div>
                ))}
              </dl>

              {/* Statistik dari nilai yang SUDAH disimpan saja; yang belum dinilai tidak ikut. */}
              <div className="mt-6">
                <p className="t-label mb-3 text-ink-muted">Statistik nilai</p>
                {statistik ? (
                  <>
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[2.4rem] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-ink">
                          {statistik.rata.toLocaleString("id-ID")}
                        </p>
                        <p className="mt-1.5 text-xs text-ink-muted">rata-rata dari {statistik.jumlah} nilai</p>
                      </div>
                      <dl className="text-right text-xs text-ink-muted">
                        <div>
                          <dt className="inline">Tertinggi </dt>
                          <dd className="inline font-semibold tabular-nums text-ink">{statistik.tertinggi}</dd>
                        </div>
                        <div className="mt-1">
                          <dt className="inline">Terendah </dt>
                          <dd className="inline font-semibold tabular-nums text-ink">{statistik.terendah}</dd>
                        </div>
                      </dl>
                    </div>

                    <div
                      className="mt-5 grid grid-cols-5 items-end gap-1.5"
                      role="img"
                      aria-label={`Sebaran nilai: ${statistik.sebaran.map((x) => `${x.label}: ${x.jumlah}`).join(", ")}`}
                    >
                      {statistik.sebaran.map((x) => (
                        <div key={x.label} className="flex flex-col items-center gap-1">
                          <span className="text-[11px] tabular-nums text-ink-muted">{x.jumlah}</span>
                          <div className="flex h-16 w-full items-end bg-white/[0.04]">
                            <div
                              className="w-full bg-blue-500"
                              style={{ height: `${x.jumlah ? Math.max(6, (x.jumlah / sebaranMaks) * 100) : 0}%` }}
                            />
                          </div>
                          <span className="text-[10px] tabular-nums text-ink-faint">{x.label}</span>
                        </div>
                      ))}
                    </div>
                    {p.maxPoints !== 100 && (
                      <p className="mt-2 text-[11px] text-ink-faint">Kelompok dalam persen dari nilai maksimal {p.maxPoints}.</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-ink-muted">Muncul setelah ada nilai yang disimpan.</p>
                )}
              </div>
            </div>

            {/* Kunci = isi pengaturan tersimpan: setelah disimpan & disegarkan,
                kartu dipasang ulang dari data baru. Tanpa ini state lamanya
                bertahan, dan simpanan berikutnya membuang berkas yang baru
                diunggah karena tidak ada di daftar "dipertahankan". */}
            <AiGradingSettings
              key={JSON.stringify(ai)}
              classId={id}
              postId={postId}
              awal={ai}
              adaLampiranTugas={post.attachments.length > 0}
            />

            <div className="px-1">
              <DeleteButton
                target={{ kind: "post", classId: id, postId }}
                after={`/educator/classes/${id}?tab=tugas`}
              />
            </div>
          </>
        }
        bawah={<DaftarPengumpulan baris={baris} detail={detail} maxPoints={p.maxPoints} />}
      />
    </EducatorShell>
  );
}
