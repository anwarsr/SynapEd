"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { deleteClass, deletePost, deleteReply, leaveClass } from "@/lib/classActions";
import { cn } from "@/lib/cn";

/**
 * Satu tombol untuk semua tindakan yang merusak di fitur kelas.
 *
 * Aksinya dipilih di dalam komponen lewat `kind`, bukan dioper sebagai fungsi
 * dari halaman: Server Action yang dioper lintas batas server-klien harus
 * berupa referensi yang bisa diserialkan, dan mengikat argumennya di halaman
 * membuat setiap pemanggilan butuh pembungkus sendiri-sendiri.
 *
 * Selalu bertanya lebih dulu. Tidak ada satu pun dari tindakan ini yang bisa
 * dibatalkan, dan menghapus kelas ikut membawa seluruh postingan, balasan, dan
 * daftar anggotanya.
 */
type Target =
  | { kind: "class"; classId: string }
  | { kind: "leave"; classId: string }
  | { kind: "post"; classId: string; postId: string }
  | { kind: "reply"; classId: string; postId: string; replyId: string };

const SALINAN: Record<Target["kind"], { label: string; title: string; description: string }> = {
  class: {
    label: "Hapus kelas",
    title: "Hapus kelas ini?",
    description:
      "Seluruh postingan, balasan, dan daftar anggotanya ikut terhapus. Tindakan ini tidak bisa dibatalkan.",
  },
  leave: {
    label: "Keluar dari kelas",
    title: "Keluar dari kelas ini?",
    description:
      "Anda tidak akan bisa membacanya lagi. Untuk bergabung kembali, Anda perlu kode undangannya.",
  },
  post: {
    label: "Hapus",
    title: "Hapus postingan ini?",
    description: "Balasan di bawahnya ikut terhapus.",
  },
  reply: {
    label: "Hapus",
    title: "Hapus balasan ini?",
    description: "Balasan yang sudah dihapus tidak bisa dikembalikan.",
  },
};

export default function DeleteButton({
  target,
  after,
  className,
}: {
  target: Target;
  /** Ke mana diarahkan setelah berhasil. Tanpa ini hanya menyegarkan halaman. */
  after?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const salinan = SALINAN[target.kind];

  function jalankan() {
    setOpen(false);
    setError(null);

    startTransition(async () => {
      const res =
        target.kind === "class"
          ? await deleteClass(target.classId)
          : target.kind === "leave"
            ? await leaveClass(target.classId)
            : target.kind === "post"
              ? await deletePost(target.classId, target.postId)
              : await deleteReply(target.classId, target.postId, target.replyId);

      if (!res.ok) return setError(res.error);

      if (after) router.push(after);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className={cn(
          "text-xs font-medium text-ink-muted transition-colors duration-200",
          "hover:text-rust-700 disabled:opacity-60 disabled:cursor-not-allowed",
          className,
        )}
      >
        {pending ? "Menghapus…" : salinan.label}
      </button>

      <ConfirmDialog
        open={open}
        title={salinan.title}
        description={salinan.description}
        confirmLabel={salinan.label}
        onConfirm={jalankan}
        onCancel={() => setOpen(false)}
      />

      {error && (
        <p role="alert" className="mt-2 text-sm text-rust-700">
          {error}
        </p>
      )}
    </>
  );
}
