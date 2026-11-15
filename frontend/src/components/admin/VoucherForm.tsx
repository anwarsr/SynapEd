"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aturVoucherAktif, hapusVoucher, simpanVoucher } from "@/lib/voucherActions";
import { inputWibKeIso, isoKeInputWib } from "@/lib/classAssignmentRules";
import {
  MAKS_PER_AKUN,
  VOUCHER_KODE_MAKS,
  buatKodeAcak,
  hitungHarga,
  normalisasiKode,
  validasiVoucher,
  type JenisPotongan,
  type MasukanVoucher,
  type Voucher,
} from "@/lib/voucherRules";
import { formatPrice } from "@/lib/courseUi";
import { cn } from "@/lib/cn";

const ISIAN =
  "w-full bg-white/[0.06] px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:shadow-[inset_0_-2px_0_var(--color-blue-400)]";
const TOMBOL =
  "bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60";
const TOMBOL_SAMAR =
  "bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-ink-body transition-colors hover:bg-white/10 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60";
const HARI_MS = 86_400_000;
const CONTOH_HARGA = [50_000, 100_000, 250_000];

type Pesan = { ok: boolean; teks: string } | null;

function Status({ pesan }: { pesan: Pesan }) {
  if (!pesan) return null;
  return (
    <p role="status" className={cn("px-4 py-3 text-sm", pesan.ok ? "bg-blue-500/10 text-ink-body" : "bg-[#E0795A]/15 text-error-text")}>
      {pesan.teks}
    </p>
  );
}

function Bab({ no, judul, keterangan, children }: { no: string; judul: string; keterangan?: string; children: React.ReactNode }) {
  return (
    <section className="bg-paper-card p-6 sm:p-7">
      <div className="mb-5 flex items-baseline gap-4">
        <span className="text-2xl font-extrabold tabular-nums text-ink-faint">{no}</span>
        <div className="min-w-0">
          <h2 className="t-h3">{judul}</h2>
          {keterangan && <p className="mt-1 text-sm text-ink-muted">{keterangan}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Label({ teks, children, className }: { teks: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="t-label mb-2 block text-ink-muted">{teks}</span>
      {children}
    </label>
  );
}

function Centang({ cek, ubah, teks, sub }: { cek: boolean; ubah: (v: boolean) => void; teks: string; sub?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1.5">
      <input type="checkbox" checked={cek} onChange={(e) => ubah(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 text-sm">
        <span className="text-ink">{teks}</span>
        {sub && <span className="block text-xs text-ink-muted">{sub}</span>}
      </span>
    </label>
  );
}

/** Teks angka → number | "" (kosong). Validasi akhirnya tetap di server. */
const angka = (t: string): number | "" => (t.trim() === "" ? "" : Number(t.replace(/[.\s]/g, "")));

export interface KursusPilihan {
  slug: string;
  title: string;
  price: number;
  category: string;
}

/**
 * Formulir buat/sunting voucher. Pratinjau & validasi memakai `validasiVoucher`
 * yang SAMA dengan server, tetapi server tetap memeriksa ulang semuanya.
 */
export default function VoucherForm({
  awal,
  kursus,
  kategori,
}: {
  /** Ada = menyunting (kode tidak bisa diganti). */
  awal?: Voucher;
  kursus: KursusPilihan[];
  kategori: { slug: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pesan, setPesan] = useState<Pesan>(null);

  const [code, setCode] = useState(awal?.code ?? "");
  const [note, setNote] = useState(awal?.note ?? "");
  const [jenis, setJenis] = useState<JenisPotongan>(awal?.jenis ?? "persen");
  const [nilai, setNilai] = useState(awal ? String(awal.nilai) : "");
  const [maks, setMaks] = useState(awal?.maksPotongan != null ? String(awal.maksPotongan) : "");
  const [premium, setPremium] = useState(awal?.premium ?? false);
  const [semua, setSemua] = useState(awal?.semuaKursus ?? false);
  const [pilihKursus, setPilihKursus] = useState<string[]>(awal?.kursus ?? []);
  const [pilihKategori, setPilihKategori] = useState<string[]>(awal?.kategori ?? []);
  const [cari, setCari] = useState("");
  const [mulai, setMulai] = useState(isoKeInputWib(awal?.mulai ?? null));
  const [berakhir, setBerakhir] = useState(isoKeInputWib(awal?.berakhir ?? null));
  const [kuota, setKuota] = useState(awal?.kuota != null ? String(awal.kuota) : "");
  const [perAkun, setPerAkun] = useState(String(awal?.batasPerAkun ?? 1));
  const [minHarga, setMinHarga] = useState(awal?.minHarga ? String(awal.minHarga) : "");
  const [pertama, setPertama] = useState(awal?.pembelianPertama ?? false);
  const [email, setEmail] = useState((awal?.khususEmail ?? []).join("\n"));
  const [aktif, setAktif] = useState(awal?.active ?? true);

  const masukan: MasukanVoucher = {
    code,
    note,
    active: aktif,
    jenis,
    nilai: angka(nilai),
    maksPotongan: jenis === "persen" ? angka(maks) : null,
    premium,
    semuaKursus: semua,
    kursus: pilihKursus,
    kategori: pilihKategori,
    mulai: mulai ? inputWibKeIso(mulai) : null,
    berakhir: berakhir ? inputWibKeIso(berakhir) : null,
    kuota: angka(kuota),
    batasPerAkun: angka(perAkun),
    minHarga: angka(minHarga),
    khususEmail: email.split(/[\s,;]+/).filter(Boolean),
    pembelianPertama: pertama,
  };
  // Tanggal "sudah lewat" diperiksa server dengan jam server; di sini cukup bentuknya.
  const cek = validasiVoucher(masukan, new Date(0), false);

  const terlihat = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return kursus.filter((k) => !q || k.title.toLowerCase().includes(q) || k.slug.includes(q));
  }, [cari, kursus]);

  const tukar = (daftar: string[], x: string, ya: boolean) => (ya ? [...new Set([...daftar, x])] : daftar.filter((y) => y !== x));

  function durasi(hari: number) {
    const dari = (mulai && inputWibKeIso(mulai)) || new Date().toISOString();
    setBerakhir(isoKeInputWib(new Date(Date.parse(dari) + hari * HARI_MS).toISOString()));
  }

  function simpan() {
    setPesan(null);
    start(async () => {
      try {
        const res = await simpanVoucher(masukan, awal ? "ubah" : "baru");
        if (!res.ok) return setPesan({ ok: false, teks: res.error });
        setPesan({ ok: true, teks: res.message });
        if (!awal && res.code) router.push(`/admin/vouchers/${res.code}`);
        else router.refresh();
      } catch {
        setPesan({ ok: false, teks: "Gagal menyimpan. Periksa koneksi lalu coba lagi." });
      }
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        simpan();
      }}
    >
      <Bab no="01" judul="Kode" keterangan="Yang diketik pembeli. Huruf besar, angka, - atau _. Tidak bisa diganti setelah dibuat.">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Label teks="Kode voucher">
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(normalisasiKode(e.target.value))}
                disabled={!!awal}
                maxLength={VOUCHER_KODE_MAKS}
                autoComplete="off"
                spellCheck={false}
                placeholder="MERDEKA17"
                className={cn(ISIAN, "font-semibold uppercase tracking-wide disabled:opacity-70")}
              />
              {!awal && (
                <button type="button" onClick={() => setCode(buatKodeAcak())} className={TOMBOL_SAMAR}>
                  Acak
                </button>
              )}
            </div>
          </Label>
          <Label teks="Catatan internal (opsional)">
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="mis. promo webinar Oktober" className={ISIAN} />
          </Label>
        </div>
      </Bab>

      <Bab no="02" judul="Potongan" keterangan="Bagi hasil educator, platform, dan perujuk dihitung dari harga SETELAH potongan.">
        <div className="mb-4 inline-flex bg-white/[0.06] p-1" role="group" aria-label="Jenis potongan">
          {(["persen", "nominal"] as const).map((j) => (
            <button
              key={j}
              type="button"
              aria-pressed={jenis === j}
              onClick={() => setJenis(j)}
              className={cn("px-4 py-2 text-sm font-medium transition-colors", jenis === j ? "bg-blue-600 text-white" : "text-ink-body hover:text-ink")}
            >
              {j === "persen" ? "Persen" : "Rupiah"}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Label teks={jenis === "persen" ? "Potongan (%)" : "Potongan (Rp)"}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={jenis === "persen" ? 100 : undefined}
              value={nilai}
              onChange={(e) => setNilai(e.target.value)}
              placeholder={jenis === "persen" ? "20" : "25000"}
              className={cn(ISIAN, "tabular-nums")}
            />
          </Label>
          {jenis === "persen" && (
            <Label teks="Maksimal potongan Rp (opsional)">
              <input type="number" inputMode="numeric" min={1} value={maks} onChange={(e) => setMaks(e.target.value)} placeholder="tanpa batas" className={cn(ISIAN, "tabular-nums")} />
            </Label>
          )}
        </div>
        {cek.ok && (
          <ul className="mt-5 grid gap-1 text-sm sm:grid-cols-3" aria-label="Contoh harga setelah voucher">
            {CONTOH_HARGA.map((h) => {
              const r = hitungHarga(cek.data, h);
              return (
                <li key={h} className="bg-white/[0.04] px-4 py-2.5 tabular-nums">
                  <span className="text-ink-muted">{formatPrice(h)} → </span>
                  <span className="font-semibold text-ink">{r.akhir === 0 ? "Gratis" : formatPrice(r.akhir)}</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-muted">Harga akhir paling sedikit Rp1.000, kecuali potongannya menutup seluruh harga - pembelian itu langsung terbuka tanpa pembayaran.</p>
      </Bab>

      <Bab no="03" judul="Berlaku untuk" keterangan="Pilih satu atau beberapa. Voucher berlaku bila salah satunya cocok.">
        <div className="grid gap-x-8 sm:grid-cols-2">
          <Centang cek={premium} ubah={setPremium} teks="SynapEd Premium" sub="Pembelian/perpanjangan Premium 30 hari" />
          <Centang cek={semua} ubah={setSemua} teks="Semua kursus berbayar" sub="Termasuk kursus yang terbit nanti" />
        </div>

        {!semua && (
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div>
              <p className="t-label mb-2 text-ink-muted">Kategori</p>
              {kategori.length === 0 ? (
                <p className="text-sm text-ink-muted">Belum ada kategori.</p>
              ) : (
                kategori.map((k) => (
                  <Centang key={k.slug} cek={pilihKategori.includes(k.slug)} ubah={(v) => setPilihKategori((d) => tukar(d, k.slug, v))} teks={k.label} />
                ))
              )}
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <p className="t-label text-ink-muted">Kursus tertentu</p>
                <p className="text-xs text-ink-muted">{pilihKursus.length} dipilih</p>
              </div>
              <input type="search" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari judul kursus…" className={cn(ISIAN, "mb-2")} />
              <div className="lab-pane max-h-72 overflow-y-auto bg-white/[0.03] px-3">
                {terlihat.length === 0 ? (
                  <p className="py-3 text-sm text-ink-muted">Tidak ada kursus berbayar yang cocok.</p>
                ) : (
                  terlihat.map((k) => (
                    <Centang
                      key={k.slug}
                      cek={pilihKursus.includes(k.slug)}
                      ubah={(v) => setPilihKursus((d) => tukar(d, k.slug, v))}
                      teks={k.title}
                      sub={formatPrice(k.price)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Bab>

      <Bab no="04" judul="Masa berlaku" keterangan="Waktu dalam WIB. Kosongkan tanggal berakhir untuk tanpa batas.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Label teks="Mulai (kosong = sekarang)">
            <input type="datetime-local" value={mulai} onChange={(e) => setMulai(e.target.value)} className={ISIAN} />
          </Label>
          <Label teks="Berakhir">
            <input type="datetime-local" value={berakhir} onChange={(e) => setBerakhir(e.target.value)} className={ISIAN} />
          </Label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Durasi cepat">
          {[1, 7, 30, 90].map((h) => (
            <button key={h} type="button" onClick={() => durasi(h)} className={TOMBOL_SAMAR}>
              {h} hari
            </button>
          ))}
          <button type="button" onClick={() => setBerakhir("")} className={TOMBOL_SAMAR}>
            Tanpa batas
          </button>
        </div>
      </Bab>

      <Bab no="05" judul="Batas pemakaian">
        <div className="grid gap-4 sm:grid-cols-3">
          <Label teks="Kuota total (kosong = tanpa batas)">
            <input type="number" inputMode="numeric" min={1} value={kuota} onChange={(e) => setKuota(e.target.value)} placeholder="tanpa batas" className={cn(ISIAN, "tabular-nums")} />
          </Label>
          <Label teks="Per akun">
            <input type="number" inputMode="numeric" min={1} max={MAKS_PER_AKUN} value={perAkun} onChange={(e) => setPerAkun(e.target.value)} className={cn(ISIAN, "tabular-nums")} />
          </Label>
          <Label teks="Minimal harga normal (Rp)">
            <input type="number" inputMode="numeric" min={0} value={minHarga} onChange={(e) => setMinHarga(e.target.value)} placeholder="tanpa syarat" className={cn(ISIAN, "tabular-nums")} />
          </Label>
        </div>
        <div className="mt-4">
          <Centang cek={pertama} ubah={setPertama} teks="Hanya pembelian pertama" sub="Akun yang belum pernah punya pesanan lunas" />
        </div>
        <p className="mt-3 text-xs text-ink-muted">Pemakaian dihitung saat pembayaran lunas. Pesanan yang masih menunggu bayar ikut menahan kuota supaya voucher tidak terpakai melebihi batas.</p>
      </Bab>

      <Bab no="06" judul="Khusus akun tertentu" keterangan="Opsional. Satu email per baris; kosong = semua akun boleh memakai.">
        <textarea
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          rows={4}
          spellCheck={false}
          placeholder={"siswa1@contoh.com\nsiswa2@contoh.com"}
          className={cn(ISIAN, "resize-y font-mono text-xs leading-6")}
        />
      </Bab>

      <section className="flex flex-col gap-4 bg-paper-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <Centang cek={aktif} ubah={setAktif} teks="Aktif" sub="Voucher nonaktif tidak bisa dipakai, tetapi riwayatnya tetap." />
        <button type="submit" disabled={pending || !cek.ok} className={TOMBOL}>
          {pending ? "Menyimpan…" : awal ? "Simpan perubahan" : "Buat voucher"}
        </button>
      </section>
      {!cek.ok && (code || nilai) && <p className="text-sm text-error-text">{cek.error}</p>}
      <Status pesan={pesan} />
    </form>
  );
}

/** Tombol cepat di halaman voucher: aktif/nonaktif dan hapus (hanya yang belum pernah dipakai). */
export function VoucherKelola({ code, aktif, bisaHapus }: { code: string; aktif: boolean; bisaHapus: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pesan, setPesan] = useState<Pesan>(null);
  const [yakin, setYakin] = useState(false);

  function jalankan(f: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, ke?: string) {
    setPesan(null);
    start(async () => {
      const res = await f();
      setPesan(res.ok ? { ok: true, teks: res.message } : { ok: false, teks: res.error });
      if (res.ok && ke) router.push(ke);
      else if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={() => jalankan(() => aturVoucherAktif(code, !aktif))} className={TOMBOL_SAMAR}>
          {aktif ? "Nonaktifkan" : "Aktifkan"}
        </button>
        {bisaHapus &&
          (yakin ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => jalankan(() => hapusVoucher(code), "/admin/vouchers")}
              className="bg-rust-700 px-4 py-2.5 text-sm font-semibold text-[#fff] disabled:opacity-60"
            >
              {pending ? "Menghapus…" : "Ya, hapus voucher"}
            </button>
          ) : (
            <button type="button" onClick={() => setYakin(true)} className={cn(TOMBOL_SAMAR, "hover:bg-rust-700 hover:text-[#fff]")}>
              Hapus
            </button>
          ))}
      </div>
      <Status pesan={pesan} />
    </div>
  );
}
