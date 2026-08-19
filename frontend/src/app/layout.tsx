import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

// Fraunces variabel. `axes` wajib — secara default next/font hanya
// menyertakan wght, sedangkan SOFT/WONK/opsz justru yang memberi
// kesan hangat & "dicetak". Lihat globals.css → .t-display.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SynapEd – Platform Pembelajaran Online Terlengkap",
  description:
    "SynapEd – Platform pembelajaran online multi-disiplin. Belajar berbagai bidang ilmu secara terstruktur dan aplikatif.",
  // `icons` sengaja TIDAK diisi di sini.
  //
  // Dulu menunjuk /images/logo.png — berkas 2,3 MB berkanvas 5906x3322 dengan
  // margin transparan sangat lebar. Sebagai favicon ia dua kali salah: setiap
  // pengunjung mengunduh 2,3 MB hanya untuk ikon tab, dan marknya menyusut jadi
  // titik karena kanvasnya jauh lebih besar daripada isinya.
  //
  // Sekarang ikon berasal dari konvensi berkas Next: app/favicon.ico,
  // app/icon.png, dan app/apple-icon.png — semuanya sudah dipotong ke isi
  // logo dan dibuat persegi. Mengisi `icons` di sini akan menimpa ketiganya.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="antialiased font-body bg-paper text-ink-body">
        {children}
      </body>
    </html>
  );
}
