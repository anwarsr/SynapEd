"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Penampil PDF bergaya SynapEd.
 *
 * Viewer bawaan peramban tidak bisa digayakan sama sekali — ia konteks
 * penjelajahan tersendiri, terkunci dari halaman yang memuatnya. Satu-satunya
 * cara menyamakan tampilannya dengan sisa aplikasi adalah merender sendiri
 * halamannya ke canvas dengan PDF.js, lalu membuat bilah alatnya sendiri.
 *
 * Halaman dirender MALAS: hanya yang mendekati layar. Modul di sini bisa
 * mencapai 39 halaman, dan merender semuanya sekaligus akan membekukan tab
 * beberapa detik sekaligus memakan ratusan megabyte canvas.
 */

// Tipe ASLI dari paketnya. `import type` dihapus saat kompilasi, jadi impor
// dinamis di bawah tetap yang menentukan kapan pustakanya dimuat.
//
// Sebelumnya bentuk-bentuk ini dijabarkan ulang di sini lalu dipaksa dengan
// `as unknown` — dan tebakannya salah: destroy() ada di loading task, bukan di
// dokumennya. Pemaksaan tipe itu yang membuat compiler diam.
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";

const ZOOMS = [0.75, 1, 1.25, 1.5, 2];

export default function PdfViewer({ src, title }: { src: string; title: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);

  // Dipegang terpisah: yang punya destroy() adalah loading task-nya, bukan
  // dokumennya. Itulah yang membatalkan permintaan jaringan dan menutup worker.
  const taskRef = useRef<PDFDocumentLoadingTask | null>(null);

  const [pages, setPages] = useState(0);
  const [current, setCurrent] = useState(1);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [fullscreen, setFullscreen] = useState(false);

  const zoom = ZOOMS[zoomIndex];

  // ── Memuat dokumen ────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;

    (async () => {
      const pdfjs = await import("pdfjs-dist");

      // Worker disalin ke public/ saat pemasangan. Menunjuk berkas di
      // node_modules akan bergantung pada perilaku bundler yang berbeda-beda
      // antara dev dan build.
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const task = pdfjs.getDocument({ url: src });
      taskRef.current = task;

      const doc = await task.promise;
      if (!alive) {
        void task.destroy();
        return;
      }

      docRef.current = doc;
      setPages(doc.numPages);
      setStatus("ready");
    })().catch(() => {
      if (alive) setStatus("error");
    });

    return () => {
      alive = false;
      void taskRef.current?.destroy();
      taskRef.current = null;
      docRef.current = null;
    };
  }, [src]);

  // ── Nomor halaman yang sedang dibaca ──────────────────────────────
  const onScroll = useCallback(() => {
    const box = scrollRef.current;
    if (!box) return;

    const middle = box.scrollTop + box.clientHeight / 2;
    const slots = Array.from(box.querySelectorAll<HTMLElement>("[data-page]"));

    for (const slot of slots) {
      if (slot.offsetTop + slot.offsetHeight >= middle) {
        setCurrent(Number(slot.dataset.page));
        return;
      }
    }
  }, []);

  function goTo(page: number) {
    const box = scrollRef.current;
    const slot = box?.querySelector<HTMLElement>(`[data-page="${page}"]`);
    if (box && slot) box.scrollTo({ top: slot.offsetTop - 12, behavior: "smooth" });
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-rule bg-paper-alt overflow-hidden",
        fullscreen && "fixed inset-0 z-50 rounded-none border-0",
      )}
    >
      {/* ── Bilah alat ──────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-3 py-2 bg-paper-card border-b border-rule">
        <ToolButton onClick={() => goTo(Math.max(1, current - 1))} disabled={current <= 1} label="Halaman sebelumnya">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </ToolButton>
        <ToolButton onClick={() => goTo(Math.min(pages, current + 1))} disabled={current >= pages} label="Halaman berikutnya">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </ToolButton>

        <span className="px-2 text-sm text-ink-body tabular-nums whitespace-nowrap">
          {status === "ready" ? `${current} / ${pages}` : "—"}
        </span>

        <span aria-hidden="true" className="w-px h-5 bg-rule mx-1" />

        <ToolButton
          onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
          disabled={zoomIndex === 0}
          label="Perkecil"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" />
        </ToolButton>
        <span className="px-1 text-sm text-ink-muted tabular-nums w-14 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <ToolButton
          onClick={() => setZoomIndex((i) => Math.min(ZOOMS.length - 1, i + 1))}
          disabled={zoomIndex === ZOOMS.length - 1}
          label="Perbesar"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12M18 12H6" />
        </ToolButton>

        <span className="ml-auto flex items-center gap-1">
          <ToolButton onClick={() => setFullscreen((v) => !v)} label={fullscreen ? "Keluar layar penuh" : "Layar penuh"}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={
                fullscreen
                  ? "M9 9V4M9 9H4M9 9L4 4m11 5h5M15 9V4m0 5l5-5M9 15v5m0-5H4m5 0l-5 5m11-5h5m-5 0v5m0-5l5 5"
                  : "M4 8V4m0 0h4M4 4l5 5m11-5v4m0-4h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
              }
            />
          </ToolButton>
          <a
            href={`${src}${src.includes("?") ? "&" : "?"}download=1`}
            download={title}
            aria-label="Unduh berkas"
            className="p-2 rounded-lg text-ink-muted transition-colors hover:bg-blue-50 hover:text-blue-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
          </a>
        </span>
      </div>

      {/* ── Halaman ─────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className={cn("overflow-auto px-3 py-3", fullscreen ? "flex-1" : "h-[78vh]")}
      >
        {status === "loading" && (
          <p className="py-20 text-center text-sm text-ink-muted">Memuat dokumen…</p>
        )}
        {status === "error" && (
          <p className="py-20 text-center text-sm text-ink-muted">
            Dokumen tidak dapat ditampilkan. Silakan unduh berkasnya.
          </p>
        )}

        {status === "ready" &&
          Array.from({ length: pages }, (_, i) => (
            <PdfPageCanvas key={i + 1} doc={docRef} page={i + 1} zoom={zoom} root={scrollRef} />
          ))}
      </div>
    </div>
  );
}

function ToolButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="p-2 rounded-lg text-ink-muted transition-colors hover:bg-blue-50 hover:text-blue-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-muted"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        {children}
      </svg>
    </button>
  );
}

/**
 * Satu halaman. Ukurannya dipesan lebih dulu dari viewport PDF, jadi bilah
 * gulir tidak melompat-lompat saat halaman menyusul dirender.
 */
function PdfPageCanvas({
  doc,
  page,
  zoom,
  root,
}: {
  doc: React.RefObject<PDFDocumentProxy | null>;
  page: number;
  zoom: number;
  root: React.RefObject<HTMLDivElement | null>;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // Terlihat = sudah dekat layar. rootMargin memberi ruang agar halaman
  // berikutnya sudah siap sebelum benar-benar terlihat.
  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { root: root.current, rootMargin: "800px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    if (!visible) return;

    let alive = true;
    let task: RenderTask | null = null;

    (async () => {
      const pdf = doc.current;
      if (!pdf) return;

      const p = await pdf.getPage(page);
      if (!alive) return;

      // devicePixelRatio supaya teksnya tajam di layar beresolusi tinggi.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = p.getViewport({ scale: zoom * dpr });
      const css = p.getViewport({ scale: zoom });

      setSize({ w: css.width, h: css.height });

      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      // `canvas` adalah parameter utamanya di versi ini; canvasContext sudah
      // menjadi opsional dan tidak diperlukan.
      const render = p.render({ canvas, viewport });
      task = render;
      await render.promise;
    })().catch(() => {
      /* pembatalan saat gulir cepat itu wajar, bukan galat */
    });

    return () => {
      alive = false;
      task?.cancel();
    };
  }, [visible, doc, page, zoom]);

  return (
    <div
      ref={holderRef}
      data-page={page}
      className="mx-auto mb-3 bg-paper-card border border-rule rounded-lg shadow-soft overflow-hidden"
      style={size ? { width: size.w, height: size.h } : { width: "100%", height: 900 }}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        aria-label={`Halaman ${page}`}
      />
    </div>
  );
}
