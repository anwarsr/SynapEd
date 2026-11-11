"use client";
import { useEffect, useRef } from "react";
import { ikonBola } from "./bolaGambar";
import { ikonLari } from "./lariGambar";
import { ikonTanjakan } from "./tanjakanGambar";

/**
 * Ikon kartu game di menu Games: dilukis di kanvas dengan gambar yang sama seperti di dalam game (bola sungguhan, adegan kota
 * senja + robot pelari), bukan SVG datar. Persegi bersudut membulat; resolusi mengikuti kerapatan piksel layar.
 */
export default function IkonGame({ jenis, className }: { jenis: "bola" | "lari" | "tanjakan"; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const u = 64;
    cv.width = u * dpr;
    cv.height = u * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, u, u);
    if (jenis === "bola") ikonBola(ctx, u);
    else if (jenis === "tanjakan") ikonTanjakan(ctx, u);
    else ikonLari(ctx, u, 1);
  }, [jenis]);
  return <canvas ref={ref} className={className} role="img" aria-label={jenis === "bola" ? "Ikon Bola Gabung" : jenis === "tanjakan" ? "Ikon Tanjakan Robo" : "Ikon Lari Robo"} />;
}
