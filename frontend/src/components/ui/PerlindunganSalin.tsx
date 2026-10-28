"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Penghalang salin-tempel ringan di halaman publik.
 *
 * JUJUR soal batasnya: apa pun yang dikirim ke peramban (HTML, CSS, JS) bisa diambil
 * orang yang mau - penghalang ini hanya mempersulit pengunjung awam (klik kanan, blok
 * teks lalu Ctrl+C, Ctrl+U, F12). Perlindungan yang sesungguhnya ada di server: kode
 * server & rahasia tak pernah dikirim ke klien, source map produksi dimatikan, dan
 * data dijaga sesi + aturan akses.
 *
 * Dikecualikan: kolom isian/editor (agar mengetik, menempel, dan menyalin kode di
 * SynapLab tetap normal), elemen berpenanda `data-boleh-salin`, dan area pengelola
 * (/admin, /educator) yang memang perlu menyalin email, uid, dan sejenisnya. Tombol
 * "Salin" (kode undangan, tautan bagikan) memakai Clipboard API dan tidak terpengaruh.
 */

const TERBUKA = "input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-boleh-salin]";

function bolehSalin(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TERBUKA) !== null;
}

export default function PerlindunganSalin() {
  const pathname = usePathname();
  const pengelola = pathname.startsWith("/admin") || pathname.startsWith("/educator");

  useEffect(() => {
    if (pengelola) return;
    const html = document.documentElement;
    html.setAttribute("data-lindungi", "true");

    const tahan = (e: Event) => {
      if (!bolehSalin(e.target)) e.preventDefault();
    };
    const tombol = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const alat =
        e.key === "F12" ||
        (ctrl && e.shiftKey && ["i", "j", "c"].includes(k)) ||
        (ctrl && e.altKey && ["i", "u"].includes(k)) ||
        (ctrl && !e.shiftKey && ["u", "s"].includes(k));
      if (alat && !bolehSalin(e.target)) e.preventDefault();
    };

    document.addEventListener("copy", tahan);
    document.addEventListener("cut", tahan);
    document.addEventListener("contextmenu", tahan);
    document.addEventListener("dragstart", tahan);
    document.addEventListener("keydown", tombol);
    return () => {
      html.removeAttribute("data-lindungi");
      document.removeEventListener("copy", tahan);
      document.removeEventListener("cut", tahan);
      document.removeEventListener("contextmenu", tahan);
      document.removeEventListener("dragstart", tahan);
      document.removeEventListener("keydown", tombol);
    };
  }, [pengelola]);

  return null;
}
