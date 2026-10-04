import type { ReactElement } from "react";

/**
 * Mengurutkan elemen sel menurut kuncinya (id sel) — urutan DOM yang TETAP
 * sepanjang umur papan.
 *
 * Papan 2D/3D/N-D memosisikan sel lewat `translate`, jadi urutan DOM tidak
 * memengaruhi tampilan. Tapi kalau elemen dirender menurut POSISI-nya, setiap
 * transformasi membuat React memindahkan node DOM (`insertBefore`). Node yang
 * dipindah diperlakukan peramban seperti node baru: animasi masuknya diputar
 * ulang dan transisinya tidak berjalan — sel tampak "muncul lagi" dan
 * melompat, bukan meluncur. Diurutkan menurut id, React cukup mengganti
 * gayanya saja. Sel baru (id lebih besar) selalu ditambahkan di ujung.
 *
 * Akibatnya urutan baca pembaca layar mengikuti id, bukan posisi; setiap sel
 * menyebut koordinatnya sendiri di `aria-label`, dan hanya satu sel yang bisa
 * dicapai Tab (roving tabindex), jadi navigasi keyboard tidak berubah.
 */
export function urutStabil(elemen: ReactElement[]): ReactElement[] {
  return [...elemen].sort((a, b) => Number(a.key) - Number(b.key));
}
