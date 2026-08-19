import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import ChatWidget from "@/components/ui/ChatWidget";
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
  icons: { icon: "/images/logo.png" },
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
        <ChatWidget />
      </body>
    </html>
  );
}
