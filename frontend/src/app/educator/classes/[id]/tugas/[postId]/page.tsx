import { notFound } from "next/navigation";
import EducatorShell from "@/components/educator/EducatorShell";
import AssignmentDetail from "@/components/classes/AssignmentDetail";
import EditPost from "@/components/classes/EditPost";
import AiGradingSettings from "@/components/classes/AiGradingSettings";
import ClassGradeForm from "@/components/classes/ClassGradeForm";
import DeleteButton from "@/components/classes/DeleteButton";
import Lampiran, { hrefJawaban } from "@/components/classes/Lampiran";
import Tag from "@/components/ui/Tag";
import UserAvatar from "@/components/ui/UserAvatar";
import { getPost, listClassMembers } from "@/lib/classes";
import { requireOwnedClass } from "@/lib/classGuards";
import { getPengaturanAi, jamServer, listPostSubmissions } from "@/lib/classAssignments";
import {
  LABEL_STATUS,
  formatWib,
  statusTugas,
  type KelasSubmission,
  type StatusTugas,
} from "@/lib/classAssignmentRules";
import { getUserCards } from "@/lib/userCards";
import { requireUser } from "@/lib/firebase/session";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string; postId: string }>;
}

export const metadata: Metadata = { title: "Tugas – SynapEd" };

export const dynamic = "force-dynamic";

/** Urutan baris: yang perlu dinilai paling atas, yang belum mengumpulkan paling bawah. */
const URUTAN: Record<StatusTugas, number> = {
  terlambat: 0,
  dikumpulkan: 0,
  dinilai: 1,
  terlewat: 2,
  belum: 2,
};

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

  const baris = uids
    .map((uid) => {
      const sub = perUid.get(uid) ?? null;
      return {
        uid,
        sub,
        nama: kartu.get(uid)?.name ?? "Peserta",
        foto: kartu.get(uid)?.photoURL ?? null,
        status: statusTugas(sub, p, saat),
        keluar: !uidAnggota.has(uid),
      };
    })
    .sort((a, b) => URUTAN[a.status] - URUTAN[b.status] || a.nama.localeCompare(b.nama, "id"));

  const terkumpul = subs.length;
  const dinilai = subs.filter((s) => s.status === "graded").length;

  return (
    <EducatorShell user={user}>
      <AssignmentDetail
        post={post}
        namaKelas={kelas.name}
        pengajar={kartu.get(post.authorUid)}
        kembali={`/educator/classes/${id}?tab=tugas`}
        saat={saat}
        aksi={<EditPost classId={id} post={post} />}
        samping={
          <>
            <div className="rounded-2xl border border-rule bg-paper-card p-6">
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
        bawah={
          <section>
            <h2 className="t-h3 mb-4">Pengumpulan siswa</h2>

            {baris.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-rule-strong bg-paper-card/55 px-6 py-10 text-center text-sm text-ink-muted">
                Belum ada anggota di kelas ini.
              </p>
            ) : (
              <ul className="space-y-3">
                {baris.map((b) => {
                  const label = LABEL_STATUS[b.status];
                  return (
                    <li key={b.uid} className="rounded-2xl border border-rule bg-paper-card">
                      {/* <details> tanpa JavaScript: pengajar membuka satu per
                          satu tanpa seluruh jawaban membanjiri halaman. Yang
                          perlu dinilai terbuka sejak awal. */}
                      <details open={b.status === "dikumpulkan" || b.status === "terlambat"} className="group">
                        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
                          <UserAvatar name={b.nama} photoURL={b.foto} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">
                              {b.nama}
                              {b.keluar && <span className="ml-2 text-xs font-normal text-ink-muted">(sudah keluar)</span>}
                            </span>
                            {b.sub && (
                              <span className="block text-xs text-ink-muted">Dikirim {formatWib(b.sub.submittedAt)}</span>
                            )}
                          </span>
                          {b.sub?.status === "graded" && b.sub.grade !== null && (
                            <span className="text-sm font-semibold tabular-nums text-ink">
                              {b.sub.grade}/{p.maxPoints}
                            </span>
                          )}
                          <Tag tone={label.tone}>{label.label}</Tag>
                          {b.sub && (
                            <svg
                              aria-hidden="true"
                              className="h-4 w-4 text-ink-muted transition-transform duration-200 group-open:rotate-180"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          )}
                        </summary>

                        {b.sub && (
                          <div className="border-t border-rule px-5 pb-5 pt-4">
                            {b.sub.text && (
                              <p className="max-h-96 overflow-y-auto whitespace-pre-line break-words rounded-xl border border-rule bg-paper px-4 py-3 text-sm leading-[1.7] text-ink-body">
                                {b.sub.text}
                              </p>
                            )}
                            <Lampiran
                              files={b.sub.files}
                              hrefs={b.sub.files.map((_, i) => hrefJawaban(b.sub!.id, i))}
                              className={b.sub.text ? "mt-3" : ""}
                            />
                            <ClassGradeForm
                              classId={id}
                              postId={postId}
                              studentUid={b.uid}
                              maxPoints={p.maxPoints}
                              grade={b.sub.grade}
                              feedback={b.sub.feedback}
                              aiIsiKomentar={ai.fillComment}
                            />
                          </div>
                        )}
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        }
      />
    </EducatorShell>
  );
}
