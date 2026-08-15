"use client";
import { lessonAssetUrl, previewKind } from "@/lib/videoEmbed";
import type { Attachment } from "@/lib/courses";
import PdfViewer from "./PdfViewer";

/**
 * Menampilkan berkas materi langsung di halaman.
 *
 * Hanya PDF, dan dirender sendiri dengan PDF.js supaya tampilannya mengikuti
 * gaya SynapEd — viewer bawaan peramban adalah konteks penjelajahan
 * tersendiri yang tidak bisa digayakan sama sekali.
 *
 * Lampiran .docx lama yang masih tersimpan tidak ditampilkan; tautan unduhnya
 * tetap ada di bawah.
 */
export default function MaterialViewer({
  courseSlug,
  file,
}: {
  courseSlug: string;
  file: Attachment;
}) {
  if (previewKind(file.name, file.mime) !== "pdf") return null;

  return <PdfViewer src={lessonAssetUrl(courseSlug, file.path)} title={file.name} />;
}
