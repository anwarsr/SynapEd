import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import ChatWidget from "@/components/ui/ChatWidget";
import SplashLoader from "@/components/ui/SplashLoader";
import { ChatContextProvider } from "@/components/ui/ChatContext";
import "./globals.css";

// Satu keluarga font untuk seluruh situs (dulu Fraunces untuk judul +
// Inter untuk isi — lihat globals.css untuk variabel --font-sans).
// `style` menyertakan italic karena .t-quote (Testimonials) butuh miring.
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  style: ["normal", "italic"],
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
    <html lang="id" className={plusJakartaSans.variable} suppressHydrationWarning>
      <head>
        {/* Tandai SEBELUM cat pertama bila intro sudah pernah tampil di tab
            ini, supaya layar pembuka (yang dirender server) tidak sempat
            muncul lalu terpotong saat hidrasi. Kunci harus sama dengan
            SEEN_KEY di SplashLoader. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{if(sessionStorage.getItem("synaped_intro_seen_v2")==="1")document.documentElement.classList.add("intro-skip")}catch(e){}',
          }}
        />
      </head>
      <body className="antialiased font-body bg-paper text-ink-body">
        <SplashLoader />
        <ChatContextProvider>
          {children}
          <ChatWidget />
        </ChatContextProvider>
      </body>
    </html>
  );
}
