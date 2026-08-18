import { courseImageUrl } from "@/lib/videoEmbed";
import { cn } from "@/lib/cn";

/**
 * Latar kartu kursus: gambar unggahan kalau ada, kalau tidak `fallback`.
 *
 * Cadangannya berbeda-beda di tiap tempat (ilustrasi di beranda, ikon di
 * katalog), jadi diserahkan sebagai prop alih-alih dipaksa seragam. Yang
 * disatukan hanya keputusan "pakai gambar atau tidak" — itulah bagian yang
 * kalau ditulis ulang di lima tempat pasti melenceng.
 */
export default function CourseThumb({
  thumbnail,
  className,
  fallback,
}: {
  thumbnail: string | null | undefined;
  className?: string;
  fallback: React.ReactNode;
}) {
  const src = courseImageUrl(thumbnail);

  if (!src) return <>{fallback}</>;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Gambar bisa berasal dari Storage, URL luar, atau folder public —
          <img> biasa menghindarkan daftar remotePatterns yang panjang. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="w-full h-full object-cover" />
    </div>
  );
}
