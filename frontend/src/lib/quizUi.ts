/**
 * Kelas gaya tombol aksi quiz (Sunting / Pantau / Tutup / Hapus): kotak persegi
 * berlatar putih transparan dengan garis tepi tipis. Modul netral supaya
 * komponen server (QuizTab) dan klien (QuizAksi) memakai rupa yang SAMA.
 */
export const TOMBOL_KOTAK =
  "inline-flex items-center gap-2 bg-white/[0.07] px-4 py-2.5 text-[12.5px] font-semibold tracking-[0.02em] text-ink " +
  "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] transition-colors duration-300 " +
  "hover:bg-white/[0.13] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.32)] disabled:cursor-not-allowed disabled:opacity-60";

/** Varian untuk tindakan yang merusak: tetap kotak, memerah hanya saat di-hover. */
export const TOMBOL_KOTAK_BAHAYA =
  TOMBOL_KOTAK + " hover:!bg-rust-700/20 hover:!text-rust-700 hover:!shadow-[inset_0_0_0_1px_var(--color-rust-700)]";
