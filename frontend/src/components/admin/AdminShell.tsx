"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Navbar from "@/components/sections/Navbar";
import Footer from "@/components/sections/Footer";
import type { SessionUser } from "@/lib/firebase/session";
import type { AdminBadges } from "@/lib/adminBadges";
import { cn } from "@/lib/cn";

/**
 * `badge` menunjuk field mana di AdminBadges yang jadi angkanya. Ditulis
 * begini, bukan dicocokkan dari href di dalam JSX seperti dulu — waktu itu
 * lencananya diikat mati ke satu tautan, sehingga menambah tautan kedua yang
 * juga perlu lencana berarti menambah cabang if di tengah render.
 */
const NAV = [
  { href: "/admin", label: "Akun Pengguna" },
  { href: "/admin/categories", label: "Kategori" },
  { href: "/admin/notifications", label: "Pengajuan Edukator", badge: "applications" },
  { href: "/admin/course-requests", label: "Pengajuan Kursus", badge: "requests" },
  { href: "/admin/payments", label: "Pembayaran", badge: "payments" },
  // Tanpa lencana: ulasan tidak menunggu keputusan siapa pun, jadi tidak ada
  // angka yang berarti "belum dikerjakan".
  { href: "/admin/reviews", label: "Ulasan" },
  { href: "/admin/classes", label: "Kelas" },
] as const satisfies readonly {
  href: string;
  label: string;
  badge?: keyof AdminBadges;
}[];

/**
 * Kerangka halaman admin.
 *
 * Dulu punya bilah atas sendiri yang tampil beda dari seluruh situs. Kini
 * memakai Navbar & Footer beranda (admin juga mendapat "Kursus Saya" dan
 * "Kelas Saya" di sana, seperti educator) dan satu baris sub-navigasi teks:
 * tautan aktif ditandai garis biru yang tumbuh dari kiri, lencana jumlah
 * pengajuan berupa kotak amber kecil.
 *
 * `badges` datang dari server supaya sudah benar pada render pertama.
 * `user` dipertahankan di tanda tangan agar pemanggil tak perlu diubah.
 */
export default function AdminShell({
  badges,
  children,
}: {
  user?: SessionUser;
  badges: AdminBadges;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <>
      <Navbar />

      <main className="min-h-screen bg-paper pb-28 pt-32">
        <div className="container-page mb-12">
          <nav
            aria-label="Navigasi admin"
            className="-mx-1 flex gap-x-8 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {NAV.map((item) => {
              // Padanan persis: /admin tidak boleh ikut aktif saat berada
              // di /admin/notifications.
              const aktif =
                item.href === "/admin"
                  ? pathname === "/admin" || pathname.startsWith("/admin/users")
                  : pathname.startsWith(item.href);

              const menunggu = "badge" in item ? badges[item.badge] : 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={aktif ? "page" : undefined}
                  className={cn(
                    "group relative flex shrink-0 items-center gap-2 whitespace-nowrap py-3.5 text-[13px] font-semibold transition-colors duration-300",
                    aktif ? "text-white" : "text-ink-muted hover:text-white",
                  )}
                >
                  {item.label}
                  {menunggu > 0 && (
                    <span className="min-w-[1.25rem] bg-amber-500 px-1.5 text-center text-[10px] font-bold leading-5 text-black">
                      {menunggu > 99 ? "99+" : menunggu}
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-x-0 bottom-0 h-[2px] origin-left bg-blue-500 transition-transform duration-500 ease-warm",
                      aktif ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
                    )}
                  />
                </Link>
              );
            })}
          </nav>
        </div>

        {children}
      </main>

      <Footer />
    </>
  );
}
