"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import UserAvatar from "@/components/ui/UserAvatar";
import MiniProfile from "@/components/profile/MiniProfile";

/**
 * Foto profil yang bisa dipencet: membuka kartu mini-profil orangnya.
 *
 * Kartunya dirender lewat portal ke <body>: pemanggilnya sering berada di dalam
 * pembungkus beranimasi (Reveal memakai transform), dan elemen `fixed` di dalam
 * leluhur bertransform tidak lagi menempel ke layar.
 *
 * `uid` kosong = foto biasa (akun hasil migrasi/terhapus).
 */
export default function AvatarMini({
  uid,
  name,
  photoURL,
  size = "md",
  className,
}: {
  uid?: string | null;
  name: string;
  photoURL: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [buka, setBuka] = useState(false);

  if (!uid) return <UserAvatar name={name} photoURL={photoURL} size={size} className={className} />;

  return (
    <>
      <button
        type="button"
        onClick={() => setBuka(true)}
        aria-label={`Lihat profil ${name}`}
        className="shrink-0 rounded-full transition-transform duration-300 ease-warm hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
      >
        <UserAvatar name={name} photoURL={photoURL} size={size} className={className} />
      </button>

      {buka &&
        createPortal(
          <MiniProfile uid={uid} name={name} avatar={photoURL} banner={null} onClose={() => setBuka(false)} />,
          document.body,
        )}
    </>
  );
}
