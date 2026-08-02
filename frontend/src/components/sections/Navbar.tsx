"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/cn";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Hanya beranda yang punya hero navy; halaman lain berlatar kertas terang.
  const overDarkHero = pathname === "/";
  const light = overDarkHero && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "Beranda", href: "#hero" },
    { label: "Tentang", href: "#about" },
    { label: "Kurikulum", href: "#value" },
    { label: "Kursus", href: "#courses" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ease-out-soft",
        scrolled ? "bg-paper/90 backdrop-blur-md border-b border-rule" : "bg-transparent",
      )}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center" aria-label="SynapEd — beranda">
          <Image
            src={light ? "/images/logotextwhite.png" : "/images/logotext.png"}
            alt="SynapEd"
            width={80}
            height={32}
            className="w-20"
            priority
          />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                "relative text-sm transition-colors duration-200 ease-out-soft",
                "after:absolute after:left-0 after:-bottom-1.5 after:h-px after:w-full",
                "after:origin-left after:scale-x-0 after:transition-transform after:duration-300 after:ease-warm",
                "hover:after:scale-x-100",
                light
                  ? "text-blue-100 hover:text-white after:bg-amber-500"
                  : "text-ink-body hover:text-blue-700 after:bg-blue-500",
              )}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ease-out-soft",
              light ? "text-blue-100 hover:text-white" : "text-ink-body hover:text-blue-700",
            )}
          >
            Masuk
          </Link>
          <Link
            href="/register"
            className={cn(
              "px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ease-out-soft hover:-translate-y-0.5",
              light
                ? "bg-paper text-navy hover:bg-white hover:shadow-lift"
                : "bg-blue-600 text-white hover:bg-blue-700",
            )}
          >
            Daftar Gratis
          </Link>
        </div>

        <button
          className={cn("md:hidden p-1 transition-colors", light ? "text-paper" : "text-ink")}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
          aria-expanded={mobileOpen}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-paper border-t border-rule">
          <div className="px-6 py-5 space-y-1">
            {navLinks.map((link, i) => (
              <a
                key={link.href}
                href={link.href}
                className="rise-in block text-sm text-ink-body hover:text-blue-700 py-2.5 transition-colors"
                style={{ "--rise-delay": `${i * 40}ms` } as React.CSSProperties}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <hr className="rule-line my-4" />
            <div className="flex flex-col gap-2.5">
              <Link
                href="/login"
                className="px-6 py-3 text-sm font-medium rounded-lg text-center border border-rule text-ink hover:border-blue-500 hover:text-blue-700 transition-colors"
              >
                Masuk
              </Link>
              <Link
                href="/register"
                className="px-6 py-3 text-sm font-semibold rounded-lg text-center bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Daftar Gratis
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
