import Link from "next/link";
import Tag from "@/components/ui/Tag";
import CourseThumb from "@/components/ui/CourseThumb";
import { iconPaths, levelTone } from "@/lib/courseUi";
import { progressFromSnapshot, type Enrollment } from "@/lib/enrollments";
import type { EducatorCourseRow } from "@/lib/educatorCourses";
import { cn } from "@/lib/cn";
import type { KelasPublik } from "@/lib/classTypes";

export function Kosong({ pesan, aksi }: { pesan: string; aksi?: { href: string; label: string } }) {
  return (
    <div className="bg-paper-card px-6 py-10 text-center">
      <p className="text-sm text-ink-muted">{pesan}</p>
      {aksi && (
        <Link
          href={aksi.href}
          className="mt-5 inline-flex rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors duration-200 ease-out-soft hover:bg-blue-700"
        >
          {aksi.label}
        </Link>
      )}
    </div>
  );
}

function Ikon({ icon, tint }: { icon: string; tint: string }) {
  return (
    <span className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", tint)}>
      <svg className="w-5 h-5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[icon] ?? iconPaths.reading} />
      </svg>
    </span>
  );
}

/**
 * Kursus yang sedang diikuti, beserta kemajuannya.
 *
 * Dipindahkan apa adanya dari halaman dashboard lama — termasuk tautan
 * sertifikat, yang merupakan SATU-SATUNYA jalan menuju halaman sertifikat.
 * Menghapusnya di sini akan membuat `/dashboard/certificates/[id]` menjadi
 * halaman yatim yang hanya bisa dicapai dengan mengetik alamatnya.
 */
export function EnrolledCourses({
  enrollments,
  gambar,
  publik = false,
}: {
  enrollments: readonly Enrollment[];
  /** slug → gambar kursus (sama dengan kartu di katalog); kosong → ikon bawaan. */
  gambar?: Readonly<Record<string, string | null>>;
  /** Dilihat orang lain: tautan ke halaman detail kursus (bukan ruang belajar), tanpa sertifikat. */
  publik?: boolean;
}) {
  if (enrollments.length === 0) {
    return (
      <Kosong
        pesan="Belum mengikuti kursus. Pilih satu dari katalog untuk mulai belajar."
        aksi={{ href: "/courses", label: "Lihat Kursus" }}
      />
    );
  }

  return (
    <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
      {enrollments.map((e) => {
        const progress = progressFromSnapshot(e);

        return (
          <div
            key={e.courseSlug}
            className="group bg-paper-card px-[22px] py-5 transition-[transform,background-color] duration-200 ease-out-soft hover:bg-card-hover hover:-translate-y-0.5"
          >
            <Link
              href={publik ? `/courses/${e.courseSlug}` : `/courses/${e.courseSlug}/learn${e.lastLessonSlug ? `/${e.lastLessonSlug}` : ""}`}
              className="block"
            >
              <span className="flex items-center gap-4">
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-paper-alt">
                  <CourseThumb
                    thumbnail={gambar?.[e.courseSlug] ?? null}
                    className="absolute inset-0 h-full w-full"
                    fallback={
                      <span className={cn("flex h-full w-full items-center justify-center", e.courseTint)}>
                        <svg className="h-5 w-5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[e.courseIcon] ?? iconPaths.reading} />
                        </svg>
                      </span>
                    }
                  />
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-ink truncate">
                    {e.courseTitle}
                  </span>
                  <span className="block text-xs text-ink-muted mt-0.5">
                    {progress.done} dari {progress.total} pelajaran
                  </span>
                </span>

                <Tag tone={levelTone(e.courseLevelColor)}>{e.courseLevel}</Tag>
              </span>

              <span className="flex items-center gap-3 mt-4">
                <span className="flex-1 h-[5px] rounded-full bg-paper-alt overflow-hidden" role="presentation">
                  <span
                    className="block h-full rounded-full bg-blue-600 transition-all duration-500 ease-warm"
                    style={{ width: `${progress.percent}%` }}
                  />
                </span>
                <span className="t-numeral text-[12.5px] text-ink-muted tabular-nums shrink-0">
                  {progress.percent}%
                </span>
              </span>
            </Link>

            {!publik && e.certificateId && (
              <Link
                href={`/dashboard/certificates/${e.certificateId}`}
                className="mt-3 flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline underline-offset-4"
              >
                Lihat Sertifikat →
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

const SANS = { fontFamily: "var(--font-sans)" } as const;

/**
 * Kursus yang dibuat educator - versi DASHBOARD.
 *
 * Bentuknya "buku besar": tiap kursus satu baris dengan nomor urut tipis-besar,
 * judul, dan jumlah peserta sebagai angka utama di kanan. Barisnya bergeser
 * selang-seling (menjorok di layar lebar) supaya daftar tak terbaca sebagai
 * tumpukan kotak seragam; saat di-hover garis biru tumbuh di tepi kiri, nomor
 * berubah biru, dan judul bergeser sedikit. Tanpa ikon (permintaan pemilik).
 *
 * Kursus tersembunyi ikut ditampilkan di profil SENDIRI dan ditandai, supaya
 * pemiliknya tahu draftnya masih ada. Saat profil dibuka orang lain nanti,
 * yang tersembunyi harus disaring lebih dulu oleh pemanggilnya.
 */
export function CreatedCourses({
  courses,
  /** Profil sendiri? Menentukan ajakan saat kosong — pengunjung tidak bisa
   *  membuatkan kursus untuk orang lain. */
  own = false,
  /** Tautan ke halaman kelola (edit) kursus, bukan halaman publiknya. */
  kelola = false,
}: {
  courses: readonly EducatorCourseRow[];
  own?: boolean;
  kelola?: boolean;
}) {
  if (courses.length === 0) {
    return own ? (
      <Kosong
        pesan="Belum membuat kursus."
        aksi={{ href: "/educator/courses/new", label: "Buat Kursus" }}
      />
    ) : (
      <Kosong pesan="Belum ada kursus yang tayang." />
    );
  }

  return (
    <ol className="grid gap-1">
      {courses.map((c, i) => (
        <li key={c.slug} className={cn(i % 2 === 1 && "sm:ml-[clamp(0px,5vw,64px)]")}>
          <Link
            href={kelola ? `/educator/courses/${c.slug}/edit` : `/courses/${c.slug}`}
            className="group relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-5 overflow-hidden bg-paper-card px-5 py-6 transition-colors duration-300 ease-out-soft hover:bg-card-hover sm:gap-x-7 sm:px-7"
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 bg-blue-500 transition-transform duration-500 ease-warm group-hover:scale-y-100"
            />

            <span
              aria-hidden="true"
              className="select-none text-[2.4rem] font-extralight leading-none tracking-[-0.04em] tabular-nums text-white/20 transition-colors duration-300 group-hover:text-blue-300 sm:text-[3rem]"
              style={SANS}
            >
              {String(i + 1).padStart(2, "0")}
            </span>

            <span className="min-w-0 transition-transform duration-500 ease-warm group-hover:translate-x-1.5">
              <span className="block truncate text-[1.1rem] font-semibold tracking-[-0.02em] text-white" style={SANS}>
                {c.title}
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
                <span>{c.reviews > 0 ? `★ ${c.rating.toFixed(1)} · ${c.reviews} ulasan` : "Belum ada ulasan"}</span>
                {c.visibility === "private" && <Tag tone="amber">Tersembunyi</Tag>}
              </span>
            </span>

            <span className="text-right">
              <span className="block text-[1.7rem] font-extrabold leading-none tracking-[-0.03em] tabular-nums text-white" style={SANS}>
                {c.enrolledStudents.toLocaleString("id-ID")}
              </span>
              <span className="mt-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.2em] text-ink-muted">peserta</span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/**
 * Kursus yang dibuat educator - versi PROFIL (dikembalikan seperti semula).
 *
 * Kursus tersembunyi ikut ditampilkan di profil SENDIRI dan ditandai, supaya
 * pemiliknya tahu draftnya masih ada. Saat profil dibuka orang lain nanti,
 * yang tersembunyi harus disaring lebih dulu oleh pemanggilnya.
 */
export function OwnedCourses({
  courses,
  /** Profil sendiri? Menentukan ajakan saat kosong — pengunjung tidak bisa
   *  membuatkan kursus untuk orang lain. */
  own = false,
}: {
  courses: readonly EducatorCourseRow[];
  own?: boolean;
}) {
  if (courses.length === 0) {
    return own ? (
      <Kosong
        pesan="Belum membuat kursus."
        aksi={{ href: "/educator/courses/new", label: "Buat Kursus" }}
      />
    ) : (
      <Kosong pesan="Belum ada kursus yang tayang." />
    );
  }

  return (
    <div className="grid gap-3.5">
      {courses.map((c) => (
        <Link
          key={c.slug}
          href={`/courses/${c.slug}`}
          className="group flex items-center gap-[18px] bg-paper-card px-[22px] py-5 transition-colors duration-200 ease-out-soft hover:bg-card-hover"
        >
          <span className="flex flex-1 min-w-0 items-center gap-[18px]">
            <Ikon icon={c.icon} tint={c.tint} />

            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-medium text-ink truncate group-hover:text-blue-700 transition-colors">
                {c.title}
              </span>
              <span className="block text-[12.5px] text-ink-muted mt-0.5">
                {c.enrolledStudents.toLocaleString("id-ID")} peserta
                {c.reviews > 0 && ` · ${c.rating.toFixed(1)} dari ${c.reviews} ulasan`}
              </span>
            </span>

            {c.visibility === "private" && <Tag tone="amber">Tersembunyi</Tag>}
          </span>
        </Link>
      ))}
    </div>
  );
}

/**
 * Kelas yang diikuti.
 *
 * Ditaruh di berkas ini, bukan berkas sendiri, supaya ia memakai `Kosong`
 * yang sama dengan dua bagian di atasnya — keadaan kosong yang berbeda-beda
 * di satu halaman terbaca seperti tiga halaman yang ditempel jadi satu.
 */
export function JoinedClasses({ kelas }: { kelas: readonly KelasPublik[] }) {
  if (kelas.length === 0) {
    return (
      <p className="bg-white/5 px-5 py-6 text-center text-[13px] text-ink-muted">
        Belum mengikuti kelas. Masukkan kode undangan dari pengajar Anda.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {kelas.map((k) => (
        <li key={k.id}>
          <Link
            href={`/kelas/${k.id}`}
            className="block bg-paper-card px-[18px] py-4 transition-colors duration-200 ease-out-soft hover:bg-card-hover"
          >
            <p className="text-sm font-medium text-ink break-words">{k.name}</p>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              {k.memberCount} anggota · {k.postCount} postingan
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
