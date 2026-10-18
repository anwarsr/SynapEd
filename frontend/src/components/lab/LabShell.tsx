"use client";
import { useCallback, useState } from "react";
import LabNavigasi, { type BagianNavigasi } from "./LabNavigasi";
import LabWorkspace from "./LabWorkspace";
import { KIT_ARRAY_1D, KIT_ARRAY_2D, KIT_ARRAY_3D, KIT_ARRAY_ND, KIT_LINKED_LIST } from "./labKits";
import type { LabSnapshot } from "@/lib/lab/labUrl";
import type { LabId } from "@/lib/lab/labTypes";
import { cn } from "@/lib/cn";

type Materi = "array" | "list";

const DIMENSI_ARRAY: readonly { id: LabId; nama: string; ringkas: string }[] = [
  KIT_ARRAY_1D,
  KIT_ARRAY_2D,
  KIT_ARRAY_3D,
  KIT_ARRAY_ND,
];

/** Materi di SynapLab; nomornya tampil di kepala ("Lab 02 · Linked List"). */
const MATERI: readonly { id: Materi; nomor: string; nama: string }[] = [
  { id: "array", nomor: "01", nama: "Array" },
  { id: "list", nomor: "02", nama: "Linked List" },
];

/**
 * Isi laci navigasi: setiap materi beserta lab-labnya. Materi baru cukup
 * menambah satu bagian di sini (dan cabang ruang kerjanya di bawah) — lacinya
 * sendiri tidak perlu disentuh.
 */
const NAVIGASI: readonly BagianNavigasi[] = [
  {
    nomor: "01",
    nama: "Array",
    item: [
      { id: "array1d", nama: "Array 1D", ket: KIT_ARRAY_1D.ringkas },
      { id: "array2d", nama: "Array 2D", ket: KIT_ARRAY_2D.ringkas },
      { id: "array3d", nama: "Array 3D", ket: KIT_ARRAY_3D.ringkas },
      { id: "arrayNd", nama: "Array N-dimensi", ket: KIT_ARRAY_ND.ringkas },
    ],
  },
  {
    nomor: "02",
    nama: "Linked List",
    item: [{ id: "linkedList", nama: "Singly linked list", ket: KIT_LINKED_LIST.ringkas }],
  },
];

const ID_LAB: ReadonlySet<string> = new Set(NAVIGASI.flatMap((b) => b.item.map((it) => it.id)));

const materiDari = (id: LabId): Materi => (id === "linkedList" ? "list" : "array");

/**
 * Pengalih materi (Array · Linked List) dan, untuk array, pengalih dimensinya
 * (1D · 2D · 3D · N-D), beserta kepala halamannya.
 *
 * Setiap lab punya ruang kerjanya sendiri. Ruang kerja dipasang saat pertama
 * kali dibuka lalu DIBIARKAN terpasang (hanya disembunyikan) — berpindah ke 2D
 * untuk menunjukkan sesuatu lalu kembali ke 1D tidak boleh menghapus papan
 * dan riwayat 1D yang sedang dipakai mengajar.
 */
export default function LabShell({ awal, tautanRusak }: { awal: LabSnapshot | null; tautanRusak: boolean }) {
  const [aktif, setAktif] = useState<LabId>(awal?.lab ?? "array1d");
  const [dibuka, setDibuka] = useState<ReadonlySet<LabId>>(() => new Set([awal?.lab ?? "array1d"]));
  const [beritahuRusak, setBeritahuRusak] = useState(tautanRusak);

  const pilih = useCallback((id: LabId) => {
    setAktif(id);
    setDibuka((s) => (s.has(id) ? s : new Set([...s, id])));
  }, []);

  const sembunyikanPemberitahuan = useCallback(() => setBeritahuRusak(false), []);

  const materi = materiDari(aktif);
  const infoMateri = MATERI.find((m) => m.id === materi)!;
  const lab = aktif === "linkedList" ? KIT_LINKED_LIST : (DIMENSI_ARRAY.find((l) => l.id === aktif) ?? DIMENSI_ARRAY[0]);

  const judul = (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            Lab {infoMateri.nomor} · {infoMateri.nama}
            {materi === "array" ? ` ${lab.nama}` : ""}
          </p>
          <h1 className="mt-2">
            <span className="sr-only">SynapLab</span>
            {/* 157×30 — gambar logo, bukan tulisan; tinggi dipatok, lebar mengikuti rasio */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/SynapLab.png" alt="" width={157} height={30} className="logo-on-dark h-8 w-auto lg:h-9" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/SynapLab Black.png" alt="" width={157} height={30} className="logo-on-light h-8 w-auto lg:h-9" />
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          {materi === "array" && (
        <div role="tablist" aria-label="Dimensi array" className="lab-fade-up flex rounded-full border border-rule bg-paper-card p-1 shadow-soft">
          {DIMENSI_ARRAY.map((l) => {
            const dipilih = l.id === aktif;
            return (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={dipilih}
                onClick={() => pilih(l.id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-semibold tabular-nums transition-all duration-200 ease-out-soft",
                  dipilih ? "bg-blue-600 text-white shadow-soft" : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                {/* Kunci = pilihan: label yang baru dipilih berdenyut sekali. */}
                <span key={String(dipilih)} className={cn("inline-block", dipilih && "lab-pop")}>
                  {l.nama}
                </span>
              </button>
            );
          })}
        </div>
          )}
        </div>
      </div>

      <p key={aktif} className="lab-fade-up text-sm text-ink-muted">
        {lab.ringkas}
      </p>

      {beritahuRusak && (
        <p role="status" className="lab-fade-up bg-amber-500/15 px-4 py-3 text-sm text-warn-text">
          Tautan papan tidak dapat dibaca, jadi lab dibuka kosong.
        </p>
      )}
    </header>
  );

  // Satu cabang per lab, bukan peta kit generik: tiap `LabWorkspace` harus
  // tahu tipe keadaan lab-nya sendiri, dan peta heterogen hanya bisa diketik
  // dengan membuang tipe itu.
  return (
    // Di layar lebar: kolom tombol materi di kiri + ruang kerja. Kolom itu
    // milik kerangka lab, bukan milik materi — tidak ikut tergulir, berganti,
    // atau tersembunyi bersama ruang kerja.
    <div className="lg:flex lg:h-full lg:gap-5">
      {/* Navigasi materi dirender SEKALI di sini, di luar ruang kerja mana pun. */}
      <LabNavigasi
        bagian={NAVIGASI}
        aktif={aktif}
        onPilih={(id) => {
          if (ID_LAB.has(id)) pilih(id as LabId);
        }}
      />
      <div className="min-w-0 lg:h-full lg:flex-1">
      {dibuka.has("array1d") && (
        <div hidden={aktif !== "array1d"} className="lg:h-full">
          <LabWorkspace
            kit={KIT_ARRAY_1D}
            awal={awal?.lab === "array1d" ? awal.state : KIT_ARRAY_1D.kosong()}
            judul={judul}
            aktif={aktif === "array1d"}
            onJalan={sembunyikanPemberitahuan}
          />
        </div>
      )}
      {dibuka.has("array2d") && (
        <div hidden={aktif !== "array2d"} className="lg:h-full">
          <LabWorkspace
            kit={KIT_ARRAY_2D}
            awal={awal?.lab === "array2d" ? awal.state : KIT_ARRAY_2D.kosong()}
            judul={judul}
            aktif={aktif === "array2d"}
            onJalan={sembunyikanPemberitahuan}
          />
        </div>
      )}
      {dibuka.has("array3d") && (
        <div hidden={aktif !== "array3d"} className="lg:h-full">
          <LabWorkspace
            kit={KIT_ARRAY_3D}
            awal={awal?.lab === "array3d" ? awal.state : KIT_ARRAY_3D.kosong()}
            judul={judul}
            aktif={aktif === "array3d"}
            onJalan={sembunyikanPemberitahuan}
          />
        </div>
      )}
      {dibuka.has("linkedList") && (
        <div hidden={aktif !== "linkedList"} className="lg:h-full">
          <LabWorkspace
            kit={KIT_LINKED_LIST}
            awal={awal?.lab === "linkedList" ? awal.state : KIT_LINKED_LIST.kosong()}
            judul={judul}
            aktif={aktif === "linkedList"}
            onJalan={sembunyikanPemberitahuan}
          />
        </div>
      )}
      {dibuka.has("arrayNd") && (
        <div hidden={aktif !== "arrayNd"} className="lg:h-full">
          <LabWorkspace
            kit={KIT_ARRAY_ND}
            awal={awal?.lab === "arrayNd" ? awal.state : KIT_ARRAY_ND.kosong()}
            judul={judul}
            aktif={aktif === "arrayNd"}
            onJalan={sembunyikanPemberitahuan}
          />
        </div>
      )}
      </div>
    </div>
  );
}
