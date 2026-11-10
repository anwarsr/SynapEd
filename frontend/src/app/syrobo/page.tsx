import Navbar from "@/components/sections/Navbar";
import SyroboClient from "@/components/syrobo/SyroboClient";
import SyroboTamu from "@/components/syrobo/SyroboTamu";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/firebase/session";
import { bacaSyrobo } from "@/lib/syrobo/syroboCore";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SyRobo - SynapEd",
  description: "Pelihara robot kecilmu: beri makan, mandikan, ganti bajunya, dan kumpulkan poin dari belajar di SynapEd.",
};

export const dynamic = "force-dynamic";

/**
 * Halaman SyRobo: kamar robot peliharaan sebagai SATU layar utuh, TANPA footer (permintaan pemilik; navbar melayang di
 * atasnya). Data dibaca di server dari sesi (uid tidak pernah dari URL); tamu hanya melihat kamar contoh + ajakan masuk.
 */
export default async function SyroboPage() {
  const user = await getCurrentUser();
  const awal = user ? await bacaSyrobo(adminDb(), user.uid) : null;

  return (
    <>
      <Navbar />
      <main className="relative h-dvh overflow-hidden">
        <h1 className="sr-only">SyRobo</h1>
        {awal ? <SyroboClient awal={awal} /> : <SyroboTamu />}
      </main>
    </>
  );
}
