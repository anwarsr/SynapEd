const JALUR = {
  sunting: "M16.86 4.49l1.69-1.69a1.88 1.88 0 112.65 2.65L10.58 16.07a4.5 4.5 0 01-1.9 1.13L6 18l.8-2.69a4.5 4.5 0 011.13-1.9l8.93-8.92z",
  pantau: "M3 3v18h18M7 15l4-4 3 3 5-6",
  kunci: "M16.5 10.5V7.5a4.5 4.5 0 10-9 0v3m-1.5 0h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-8a1 1 0 011-1z",
  buka: "M13.5 10.5V7.5a4.5 4.5 0 00-9 0m-1.5 3h12a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1v-8a1 1 0 011-1z",
  hapus: "M6 7h12M9 7V5h6v2m-8 0l1 12h8l1-12",
  waktu: "M12 7v5l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z",
  unduh: "M12 4v11m0 0l-4-4m4 4l4-4M5 19h14",
  lonceng: "M14.86 17.08a2 2 0 01-3.72 0M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9z",
  ulang: "M4 12a8 8 0 108-8H7m0 0l3-3M7 4l3 3",
} as const;

/** Ikon garis kecil untuk tombol aksi quiz. Tanpa hook: aman di komponen server maupun klien. */
export default function QuizIkon({ nama }: { nama: keyof typeof JALUR }) {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={JALUR[nama]} />
    </svg>
  );
}
