import Link from "next/link";
import Tag from "@/components/ui/Tag";
import {
  LABEL_STATUS,
  formatWib,
  lewatTenggat,
  statusTugas,
  type KelasSubmission,
} from "@/lib/classAssignmentRules";
import type { KelasPost } from "@/lib/classTypes";

export type SudutTugas =
  | { peran: "siswa"; milikku: ReadonlyMap<string, Pick<KelasSubmission, "status" | "late" | "grade">> }
  | { peran: "pengajar"; hitungan: ReadonlyMap<string, { kumpul: number; dinilai: number }>; anggota: number };

/**
 * Daftar tugas satu kelas (tab "Tugas").
 *
 * Siswa melihat status MILIKNYA sendiri; pengajar melihat hitungan
 * terkumpul/dinilai. Keduanya dihitung di server oleh halaman pemanggil —
 * daftar ini tidak pernah menerima pengumpulan siswa lain di sisi siswa.
 */
export default function AssignmentList({
  posts,
  basePath,
  sudut,
  saat,
}: {
  posts: readonly KelasPost[];
  basePath: string;
  sudut: SudutTugas;
  /** Jam server saat halaman dirender — satu nilai untuk seluruh daftar. */
  saat: number;
}) {
  const tugas = posts.filter((p) => p.kind === "assignment" && p.assignment);

  if (tugas.length === 0) {
    return (
      <div className="bg-paper-card/55 px-8 py-14 text-center">
        <p className="text-[22px] font-medium text-ink">Belum ada tugas</p>
        <p className="mx-auto mt-3 max-w-[44ch] text-sm leading-[1.7] text-ink-muted">
          {sudut.peran === "pengajar"
            ? "Pilih “Tugas” di kotak tulis pada tab Pengumuman untuk menerbitkan tugas pertama."
            : "Tugas dari pengajar akan muncul di sini."}
        </p>
      </div>
    );
  }

  return (
    <ul className="overflow-hidden bg-paper-card divide-y divide-rule">
      {tugas.map((post) => {
        const p = post.assignment!;
        const lewat = lewatTenggat(p.dueAt, saat);

        let kanan: React.ReactNode;
        if (sudut.peran === "siswa") {
          const sub = sudut.milikku.get(post.id) ?? null;
          const status = statusTugas(sub, p, saat);
          kanan = (
            <span className="flex flex-col items-end gap-1">
              <Tag tone={LABEL_STATUS[status].tone}>{LABEL_STATUS[status].label}</Tag>
              {sub?.status === "graded" && sub.grade !== null && (
                <span className="text-sm font-semibold tabular-nums text-ink">
                  {sub.grade}/{p.maxPoints}
                </span>
              )}
            </span>
          );
        } else {
          const h = sudut.hitungan.get(post.id) ?? { kumpul: 0, dinilai: 0 };
          kanan = (
            <span className="text-right text-xs text-ink-muted">
              <span className="block text-[17px] font-medium tabular-nums text-ink">
                {h.kumpul}/{sudut.anggota}
              </span>
              terkumpul · {h.dinilai} dinilai
            </span>
          );
        }

        return (
          <li key={post.id}>
            <Link
              href={`${basePath}/tugas/${post.id}`}
              className="flex items-center gap-4 px-6 py-4 transition-colors duration-200 hover:bg-white/[0.06]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-ink">{post.title}</span>
                <span className={lewat ? "block text-xs text-rust-700" : "block text-xs text-ink-muted"}>
                  {p.dueAt ? `Tenggat ${formatWib(p.dueAt)}` : "Tanpa tenggat"}
                  {lewat && (p.acceptLate ? " · masih menerima terlambat" : " · ditutup")}
                </span>
              </span>
              <span className="shrink-0">{kanan}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
