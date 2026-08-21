"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Label, inputClass } from "./fields";
import {
  requestCourseDeletion,
  requestVisibilityChange,
  withdrawRequest,
} from "@/lib/courseRequestActions";
import { adminSetVisibility } from "@/lib/courseRequestActions";
import { deleteCourse } from "@/lib/courseActions";
import { requestTypeLabel, type CourseChangeRequest } from "@/lib/courseRequestTypes";
import type { CourseVisibility } from "@/lib/courses";
import { cn } from "@/lib/cn";

/**
 * Panel visibility dan penghapusan.
 *
 * Terpisah dari panel suntingan isi karena sifatnya berbeda: yang ini
 * mengubah keadaan kursus, bukan isinya, dan masing-masing butuh alasannya
 * sendiri. Menggabungkannya akan memaksa educator menulis satu alasan untuk
 * dua maksud yang tidak berhubungan.
 */

function ReasonBox({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="mt-4">
      <Label htmlFor={id}>Alasan</Label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className={cn(inputClass, "resize-y")}
      />
    </div>
  );
}

export default function CourseRequestPanel({
  slug,
  title,
  visibility,
  mode,
  pendingRequest,
}: {
  slug: string;
  title: string;
  visibility: CourseVisibility;
  mode: "request" | "direct";
  pendingRequest: CourseChangeRequest | null;
}) {
  const router = useRouter();
  const [visReason, setVisReason] = useState("");
  const [delReason, setDelReason] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const target: CourseVisibility = visibility === "public" ? "private" : "public";

  async function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setBusy(true);
    setError(null);
    setDone(null);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      setDone(res.message ?? "Berhasil.");
      setVisReason("");
      setDelReason("");
      router.refresh();
    } else {
      setError(res.error ?? "Gagal.");
    }
  }

  // ── Sedang ada pengajuan menggantung ────────────────────────────────
  if (pendingRequest) {
    return (
      <section className="bg-paper-card border border-amber-500/40 rounded-2xl p-7">
        <h2 className="t-h3 text-base mb-2">Menunggu keputusan admin</h2>
        <p className="t-body text-sm mb-4">
          Pengajuan <strong>{requestTypeLabel[pendingRequest.type].toLowerCase()}</strong> sedang
          ditinjau. Selama menunggu, kursus ini tidak bisa diajukan perubahan lain agar dua usulan
          tidak saling menimpa.
        </p>
        <p className="text-sm text-ink-muted mb-5 border-l-2 border-rule pl-4 italic">
          &ldquo;{pendingRequest.reason}&rdquo;
        </p>

        {error && <p className="mb-3 text-sm text-rust-700">{error}</p>}

        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => withdrawRequest(pendingRequest.id))}
          className="rounded-lg border border-rule px-5 py-2.5 text-sm font-medium text-ink-body transition-colors hover:border-blue-500 hover:text-blue-700 disabled:opacity-60"
        >
          {busy ? "Membatalkan…" : "Batalkan Pengajuan"}
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-lg border border-rust-700/25 bg-rust-100 px-4 py-3 text-sm text-rust-700">
          {error}
        </div>
      )}
      {done && (
        <div role="status" className="rounded-lg border border-blue-500/25 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {done}
        </div>
      )}

      {/* ── Visibility ──────────────────────────────────────────────── */}
      <section className="bg-paper-card border border-rule rounded-2xl p-7">
        <h2 className="t-h3 text-base mb-1.5">Visibilitas</h2>
        <p className="t-body text-sm">
          Status sekarang:{" "}
          <strong className={visibility === "public" ? "text-blue-700" : "text-ink"}>
            {visibility === "public" ? "Tayang (publik)" : "Tersembunyi (private)"}
          </strong>
          .{" "}
          {visibility === "private"
            ? "Kursus tidak muncul di katalog. Peserta yang sudah terdaftar tetap bisa membukanya."
            : "Kursus muncul di katalog dan bisa dibeli siapa saja."}
        </p>

        {mode === "request" ? (
          <>
            <ReasonBox
              id="visReason"
              value={visReason}
              onChange={setVisReason}
              placeholder={
                target === "public"
                  ? "Contoh: Materi sudah lengkap dan siap dipelajari peserta."
                  : "Contoh: Ada modul yang perlu diperbaiki sebelum dipelajari lagi."
              }
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => requestVisibilityChange(slug, target, visReason))}
              className="mt-4 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? "Mengirim…" : target === "public" ? "Ajukan Tayang" : "Ajukan Sembunyikan"}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => adminSetVisibility(slug, target))}
            className="mt-4 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Menyimpan…" : target === "public" ? "Tayangkan Sekarang" : "Sembunyikan Sekarang"}
          </button>
        )}
      </section>

      {/* ── Penghapusan ─────────────────────────────────────────────── */}
      <section className="bg-paper-card border border-rust-700/30 rounded-2xl p-7">
        <h2 className="t-h3 text-base mb-1.5 text-rust-700">Hapus Kursus</h2>
        <p className="t-body text-sm">
          Kursus beserta seluruh materinya dihapus permanen. Peserta yang sudah terdaftar akan
          kehilangan aksesnya.
        </p>

        {mode === "request" && (
          <ReasonBox
            id="delReason"
            value={delReason}
            onChange={setDelReason}
            placeholder="Contoh: Kursus ini digantikan versi baru yang sudah saya buat."
          />
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => setAsking(true)}
          className="mt-4 rounded-lg border border-rust-700/40 px-5 py-2.5 text-sm font-medium text-rust-700 transition-colors hover:bg-rust-100 disabled:opacity-60"
        >
          {mode === "request" ? "Ajukan Penghapusan" : "Hapus Sekarang"}
        </button>
      </section>

      <ConfirmDialog
        open={asking}
        title={mode === "request" ? "Ajukan penghapusan kursus?" : "Hapus kursus ini?"}
        description={
          mode === "request"
            ? `Admin akan meninjau permintaan penghapusan "${title}".`
            : `"${title}" akan hilang dari katalog beserta materinya.`
        }
        note={
          mode === "request"
            ? "Kursus tetap tayang sampai admin menyetujui."
            : "Tindakan ini tidak dapat dibatalkan."
        }
        confirmLabel={mode === "request" ? "Ya, Ajukan" : "Ya, Hapus"}
        onConfirm={() => {
          setAsking(false);
          void run(() =>
            mode === "request" ? requestCourseDeletion(slug, delReason) : deleteCourse(slug),
          );
        }}
        onCancel={() => setAsking(false)}
      />
    </div>
  );
}
