"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SyroboKamar from "./SyroboKamar";
import SyroboRobot from "./SyroboRobot";

/**
 * Tampilan untuk tamu (belum masuk): kamar yang sama tetapi robotnya MATI (layar padam, tak bergerak), tanpa nama,
 * poin, bar, dan menu. Menekan robot mengarahkan ke halaman masuk. Tidak membaca/menulis data apa pun.
 */
export default function SyroboTamu() {
  const router = useRouter();
  const [gelap, setGelap] = useState(false);
  const [ucapan, setUcapan] = useState<{ teks: string; n: number } | null>(null);

  return (
    <div className="keep-white relative h-dvh w-full overflow-hidden bg-[#538589]">
      <SyroboKamar
        gelap={gelap}
        ubahGelap={setGelap}
        bisik={(teks) => setUcapan({ teks, n: Date.now() })}
      />
      <div className="pointer-events-none absolute bottom-[calc(176px+2dvh)] left-0 z-10 flex w-full justify-center sm:bottom-[24dvh]">
        <SyroboRobot suasana="senang" gelap={gelap} mati ucapan={ucapan} onMati={() => router.push("/login?next=/syrobo")} />
      </div>
    </div>
  );
}
