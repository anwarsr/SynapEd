"use client";

import { useEffect } from "react";
import { bahasaTersimpan } from "@/lib/language";

interface GoogleTranslateWindow extends Window {
  googleTranslateElementInit?: () => void;
  google?: {
    translate: {
      TranslateElement: new (
        opsi: { pageLanguage: string; includedLanguages: string; autoDisplay: boolean },
        id: string,
      ) => unknown;
    };
  };
}

/**
 * Memuat penerjemah resmi Google (Website Translation) hanya bila bahasa Inggris
 * dipilih - pengunjung berbahasa Indonesia tidak mengunduh skrip apa pun.
 *
 * Widget menerjemahkan dengan membungkus ulang simpul teks di DOM, dan React
 * bisa tersandung saat memperbarui simpul yang sudah dipindah/dibungkus
 * ("removeChild … not a child of this node"). Tambalan di bawah - yang lazim
 * dipakai untuk kombinasi React + Google Translate - membuat dua operasi itu
 * memaafkan induk yang sudah berubah. Hanya dipasang saat bahasa Inggris aktif.
 */
export default function TranslateLoader() {
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (bahasaTersimpan() !== "en") return;

      const hapus = Node.prototype.removeChild;
      Node.prototype.removeChild = function <T extends Node>(this: Node, anak: T): T {
        if (anak.parentNode !== this) return anak;
        return hapus.call(this, anak) as T;
      };
      const sisip = Node.prototype.insertBefore;
      Node.prototype.insertBefore = function <T extends Node>(this: Node, baru: T, acuan: Node | null): T {
        if (acuan && acuan.parentNode !== this) return baru;
        return sisip.call(this, baru, acuan) as T;
      };

      const w = window as GoogleTranslateWindow;
      w.googleTranslateElementInit = () => {
        if (!w.google) return;
        new w.google.translate.TranslateElement(
          { pageLanguage: "id", includedLanguages: "id,en", autoDisplay: false },
          "google_translate_element",
        );
      };

      const s = document.createElement("script");
      s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      s.async = true;
      document.body.appendChild(s);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // Wadah yang dicari widget; disembunyikan di luar layar (display:none membuatnya gagal).
  return <div id="google_translate_element" aria-hidden="true" className="notranslate pointer-events-none fixed -left-[9999px] top-0" />;
}
