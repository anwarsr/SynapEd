"use client";
import KodeWorkspace from "./KodeWorkspace";
import { PanduanPython } from "./Panduan";
import { usePythonMesin } from "./usePythonMesin";
import { CONTOH_PYTHON } from "@/lib/lab/python/pythonContoh";
import type { IsiKode } from "@/lib/lab/kodeUrl";

export default function PythonWorkspace({ awal, judul, aktif }: { awal: IsiKode | null; judul: React.ReactNode; aktif: boolean }) {
  const mesin = usePythonMesin(aktif);
  return (
    <KodeWorkspace
      bahasa="python"
      judul={judul}
      aktif={aktif}
      awal={awal}
      contoh={CONTOH_PYTHON}
      mesin={mesin}
      panduan={<PanduanPython />}
      ekstensi=".py"
    />
  );
}
