"use client";

export default function PrintCertificateButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors duration-200 ease-out-soft hover:bg-blue-700"
    >
      Cetak / Simpan sebagai PDF
    </button>
  );
}
