"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import LencanaPremium from "./LencanaPremium";
import { statusPremiumSaya } from "@/lib/premiumActions";

/**
 * Lencana premium di navbar. Navbar dirender klien tanpa prop di banyak
 * halaman, jadi statusnya diambil sekali lewat server action yang hanya
 * menjawab tentang pengguna SESI itu sendiri, lalu diingat sebentar per uid
 * supaya berpindah halaman tidak memanggil server setiap kali.
 */
const INGAT_MS = 60_000;
const ingatan = new Map<string, { aktif: boolean; at: number }>();

export default function NavbarPremium({ uid }: { uid: string }) {
  const [aktif, setAktif] = useState<boolean>(() => {
    const ada = ingatan.get(uid);
    return Boolean(ada && Date.now() - ada.at < INGAT_MS && ada.aktif);
  });

  useEffect(() => {
    const ada = ingatan.get(uid);
    if (ada && Date.now() - ada.at < INGAT_MS) return;
    let hidup = true;
    statusPremiumSaya()
      .then((s) => {
        ingatan.set(uid, { aktif: s.aktif, at: Date.now() });
        if (hidup) setAktif(s.aktif);
      })
      .catch(() => undefined);
    return () => {
      hidup = false;
    };
  }, [uid]);

  if (!aktif) return null;
  return (
    <Link href="/premium" aria-label="Premium aktif - lihat status" className="hidden sm:block">
      <LencanaPremium />
    </Link>
  );
}
