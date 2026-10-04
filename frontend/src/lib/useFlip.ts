"use client";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * FLIP: elemen yang berpindah tempat meluncur dari posisi lamanya.
 *
 * Setiap render, posisi setiap elemen ber-`data-lab-id` di dalam wadah dicatat
 * (per id — bukan per urutan, supaya elemen yang sama dikenali walau pindah
 * baris, kolom, atau kotak). Elemen yang bergeser diberi transform terbalik
 * tanpa transisi, lalu transformnya dilepas DENGAN transisi `.lab-cell` —
 * jadi ia tampak meluncur, bukan melompat. Bekerja di dua sumbu, jadi sama
 * untuk deret 1D, kisi 2D, dan kotak bersarang N-dimensi.
 *
 * Posisi diukur relatif terhadap wadah, sehingga menggulir papan atau panel
 * tidak pernah disangka perpindahan. Translasi yang sedang berjalan dikurangi
 * dari hasil ukur supaya yang tercatat adalah posisi tata letak, bukan posisi
 * di tengah animasi.
 *
 * Tidak ada setState di sini — hanya menulis gaya DOM, yang memang tugas
 * layout effect. Saat hemat gerak menyala, posisi tetap dicatat tetapi tidak
 * ada transform yang ditulis.
 */
export function useFlip(wadahRef: RefObject<HTMLElement | null>): void {
  const hematGerak = useReducedMotion();
  const posisiLama = useRef(new Map<string, { x: number; y: number }>());

  useLayoutEffect(() => {
    const wadah = wadahRef.current;
    // Tanpa wadah (mis. papan 3D sedang di tampilan kubus, yang tidak memakai
    // FLIP) posisi lama juga dilupakan — kalau tidak, kembali ke tampilan datar
    // akan menganimasikan sel dari posisi yang sudah lama basi.
    if (!wadah) {
      posisiLama.current = new Map();
      return;
    }

    // Papan yang sedang disembunyikan (lab lain yang aktif, `display: none`)
    // tetap ikut dirender saat pengalih dipakai. Mengukurnya menghasilkan nol
    // untuk semua elemen, dan saat papannya ditampilkan lagi setiap sel akan
    // meluncur dari pojok kiri atas. Posisinya dilupakan saja: kembali ke
    // sebuah lab bukan perpindahan yang perlu dianimasikan.
    if (wadah.getClientRects().length === 0) {
      posisiLama.current = new Map();
      return;
    }

    const asal = wadah.getBoundingClientRect();
    const elemen = Array.from(wadah.querySelectorAll<HTMLElement>("[data-lab-id]"));
    const baru = new Map<string, { x: number; y: number }>();

    for (const el of elemen) {
      const r = el.getBoundingClientRect();
      const t = getComputedStyle(el).transform;
      const geser = t && t !== "none" ? new DOMMatrixReadOnly(t) : null;
      baru.set(el.dataset.labId ?? "", {
        x: r.left - asal.left - (geser?.m41 ?? 0),
        y: r.top - asal.top - (geser?.m42 ?? 0),
      });
    }

    if (!hematGerak) {
      const bergerak: HTMLElement[] = [];
      for (const el of elemen) {
        const id = el.dataset.labId ?? "";
        const lama = posisiLama.current.get(id);
        const kini = baru.get(id);
        if (!lama || !kini) continue;
        const dx = lama.x - kini.x;
        const dy = lama.y - kini.y;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
        el.style.transition = "none";
        el.style.transform = `translate(${dx}px, ${dy}px)`;
        bergerak.push(el);
      }

      if (bergerak.length > 0) {
        // Satu reflow untuk semua elemen, lalu transform dilepas bersamaan.
        void wadah.offsetWidth;
        for (const el of bergerak) {
          el.style.transition = "";
          el.style.transform = "";
        }
      }
    }

    posisiLama.current = baru;
  });
}
