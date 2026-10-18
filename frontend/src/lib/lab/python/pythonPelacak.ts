/**
 * Kode Python yang dipasang SEKALI di Pyodide (di dalam Web Worker) untuk
 * menjalankan program siswa dan merekamnya menjadi `JejakKode`.
 *
 * Ditaruh sebagai teks di sini — bukan di `public/lab/python-worker.js` —
 * supaya ikut ditinjau, diberi versi, dan dikirim bersama halaman. Worker-nya
 * sendiri hanya cangkang: memuat Pyodide, memasang kode ini, lalu meneruskan
 * pesan.
 *
 * Cara kerja `_synap_jalankan(kode, masukan, rekam, …)`:
 *  - kode dikompilasi sebagai berkas `<siswa>`; SyntaxError langsung dilaporkan;
 *  - `sys.stdin` = baris-baris kotak Masukan (habis → EOFError → saran ramah),
 *    `sys.stdout`/`stderr` ditangkap dan SETIAP potongan tulisan dikabarkan
 *    ke utas utama — kalau program dihentikan paksa (batas waktu/Stop),
 *    keluaran sejauh itu tidak hilang. Per potongan, bukan berkala: program
 *    yang mencetak lalu masuk perulangan tak berujung tidak pernah sempat
 *    "berkala" lagi;
 *  - mode langkah: `sys.settrace` mencatat setiap event `line` di `<siswa>`
 *    (keadaan SEBELUM baris dijalankan, sama dengan pseudocode). Rekaman
 *    berhenti di `maks_rekam`, program dihentikan di `maks_langkah` —
 *    perulangan tak berujung menjadi galat yang terekam, bukan layar beku;
 *  - setelah setiap jalan, `builtins` & batas rekursi dipulihkan: program
 *    sebelumnya tidak boleh mewariskan `print = None` ke program berikutnya.
 *
 * Penghalang impor (`js`, `pyodide`, …) di bawah ini adalah lapisan SOPAN —
 * memberi pesan jelas bagi yang mencoba. Ia BISA ditembus (mis. lewat
 * `gc.get_objects()`), jadi pembatas sesungguhnya adalah CSP worker dan
 * penghapusan API jaringan di `python-worker.js`. Lihat CLAUDE.md.
 *
 * Modul netral (teks saja).
 */
export const KODE_PELACAK = String.raw`
import sys, io, json, builtins, traceback, types, reprlib

_SYN_DILARANG = frozenset({"js", "pyodide", "pyodide_js", "_pyodide", "_pyodide_core", "micropip", "pyodide_http"})

class _SynPenghalang:
    def find_spec(self, nama, path=None, target=None):
        if nama.split(".")[0] in _SYN_DILARANG:
            raise ImportError("Modul '" + nama + "' tidak tersedia di SynapLab (kode tidak boleh mengakses browser).")
        return None

sys.meta_path.insert(0, _SynPenghalang())
for _m in list(sys.modules):
    if _m.split(".")[0] in _SYN_DILARANG:
        del sys.modules[_m]

_SYN_BUILTINS = dict(builtins.__dict__)
_SYN_REKURSI = sys.getrecursionlimit()

_syn_repr = reprlib.Repr()
_syn_repr.maxstring = 60
_syn_repr.maxother = 60
_syn_repr.maxlist = 12
_syn_repr.maxtuple = 12
_syn_repr.maxset = 10
_syn_repr.maxfrozenset = 10
_syn_repr.maxdict = 8
_syn_repr.maxlevel = 3
_syn_repr.maxlong = 40

class _SynBatasLangkah(BaseException):
    pass

class _SynBatasKeluaran(BaseException):
    pass

class _SynKeluaran(io.TextIOBase):
    def __init__(self, maks, kabar):
        self.bagian = []
        self.panjang = 0
        self.maks = maks
        self.kabar = kabar
    def writable(self):
        return True
    def write(self, s):
        if not isinstance(s, str):
            raise TypeError("write() argument must be str")
        if self.panjang + len(s) > self.maks:
            sisa = max(0, self.maks - self.panjang)
            self.bagian.append(s[:sisa])
            self.panjang += sisa
            self.kabar(s[:sisa])
            raise _SynBatasKeluaran()
        self.bagian.append(s)
        self.panjang += len(s)
        if s:
            self.kabar(s)
        return len(s)
    def flush(self):
        pass
    def teks(self):
        if len(self.bagian) > 1:
            self.bagian = ["".join(self.bagian)]
        return self.bagian[0] if self.bagian else ""

class _SynMasukan(io.TextIOBase):
    def __init__(self, baris):
        self.baris = baris
        self.i = 0
    def readable(self):
        return True
    def readline(self, size=-1):
        if self.i >= len(self.baris):
            return ""
        s = self.baris[self.i] + "\n"
        self.i += 1
        return s
    def read(self, size=-1):
        sisa = "".join(b + "\n" for b in self.baris[self.i:])
        self.i = len(self.baris)
        return sisa

def _syn_nilai(v):
    try:
        if isinstance(v, types.FunctionType):
            return "<fungsi " + v.__name__ + ">"
        if isinstance(v, type):
            return "<kelas " + v.__name__ + ">"
        s = _syn_repr.repr(v)
    except BaseException:
        s = "<tidak bisa ditampilkan>"
    return s if len(s) <= 160 else s[:159] + "…"

def _syn_isi(lingkup, isi, vars):
    for nama, v in list(isi.items()):
        if len(vars) >= 60:
            return
        if nama.startswith("__") and nama.endswith("__"):
            continue
        if isinstance(v, types.ModuleType):
            continue
        vars.append({"nama": nama, "nilai": _syn_nilai(v), "jenis": type(v).__name__, "lingkup": lingkup})

def _syn_potret(frame, baris, keluar):
    rantai = []
    f = frame
    while f is not None:
        if f.f_code.co_filename == "<siswa>":
            rantai.append(f)
        f = f.f_back
    rantai.reverse()
    label = []
    tumpukan = []
    hitung = {}
    for f in rantai:
        n = f.f_code.co_name
        if n == "<module>":
            label.append("global")
            continue
        hitung[n] = hitung.get(n, 0) + 1
        label.append(n if hitung[n] == 1 else n + " (" + str(hitung[n]) + ")")
        tumpukan.append(n)
    # Global + 8 bingkai terdalam: rekursi dalam × 2000 langkah terlalu besar.
    pilih = list(range(len(rantai))) if len(rantai) <= 9 else [0] + list(range(len(rantai) - 8, len(rantai)))
    vars = []
    for i in pilih:
        f = rantai[i]
        _syn_isi(label[i], f.f_globals if f.f_code.co_name == "<module>" else f.f_locals, vars)
    return {"baris": baris, "vars": vars, "panjangKeluaran": keluar.panjang, "tumpukan": tumpukan}

def _syn_baris_kode(kode, n):
    baris = kode.split("\n")
    return baris[n - 1].strip() if n and 1 <= n <= len(baris) else ""

def _syn_galat(e, kode):
    if isinstance(e, SyntaxError):
        teks = type(e).__name__ + ": " + str(e.msg)
        isi = _syn_baris_kode(kode, e.lineno)
        if isi:
            teks += "\n    " + isi
        return {"baris": e.lineno, "jenis": type(e).__name__, "pesan": teks, "saran": None}
    tb = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == "<siswa>"]
    baris = tb[-1].lineno if tb else None
    teks = []
    if tb:
        teks.append("Traceback (panggilan terakhir paling bawah):")
        for f in tb[-6:]:
            di = "program utama" if f.name == "<module>" else f.name + "()"
            teks.append("  baris " + str(f.lineno) + ", di " + di)
            isi = _syn_baris_kode(kode, f.lineno)
            if isi:
                teks.append("    " + isi)
    pesan = str(e)
    teks.append(type(e).__name__ + (": " + pesan if pesan else ""))
    return {"baris": baris, "jenis": type(e).__name__, "pesan": "\n".join(teks), "saran": None}

def _synap_jalankan(kode, masukan, rekam, maks_rekam, maks_langkah, maks_keluaran, kabar):
    keluar = _SynKeluaran(maks_keluaran, kabar)
    baris_masukan = masukan.replace("\r\n", "\n").replace("\r", "\n").split("\n") if masukan != "" else []
    if baris_masukan and baris_masukan[-1] == "":
        baris_masukan.pop()
    langkah = []
    status = {"n": 0, "terpotong": False, "baris": None}
    try:
        obj = compile(kode, "<siswa>", "exec")
    except SyntaxError as e:
        return json.dumps({"langkah": [], "keluaran": "", "galat": _syn_galat(e, kode), "terpotong": False})

    def pelacak(frame, event, arg):
        if frame.f_code.co_filename != "<siswa>":
            return None
        if event == "line":
            status["n"] += 1
            status["baris"] = frame.f_lineno
            if status["n"] > maks_langkah:
                raise _SynBatasLangkah()
            if len(langkah) < maks_rekam:
                langkah.append(_syn_potret(frame, frame.f_lineno, keluar))
            else:
                status["terpotong"] = True
        return pelacak

    stdin = _SynMasukan(baris_masukan)

    # input() menggemakan nilai yang dibaca, seperti terminal sungguhan:
    # tanpa itu keluaran "Panjang: Lebar: Luas = 20" tampak seperti galat.
    def _syn_input(prompt=""):
        keluar.write(str(prompt))
        s = stdin.readline()
        if s == "":
            raise EOFError("EOF when reading a line")
        s = s[:-1]
        keluar.write(s + "\n")
        return s

    ruang = {"__name__": "__main__", "__builtins__": builtins}
    galat = None
    lama = (sys.stdout, sys.stderr, sys.stdin)
    sys.stdout = keluar
    sys.stderr = keluar
    sys.stdin = stdin
    builtins.input = _syn_input
    try:
        if rekam:
            sys.settrace(pelacak)
        exec(obj, ruang)
    except SystemExit:
        pass
    except _SynBatasLangkah:
        galat = {"baris": status["baris"], "jenis": "Batas langkah", "pesan": "Program dihentikan setelah " + format(maks_langkah, ",").replace(",", ".") + " langkah.", "saran": None}
    except _SynBatasKeluaran:
        galat = {"baris": None, "jenis": "Batas keluaran", "pesan": "Keluaran terlalu panjang (lebih dari " + format(maks_keluaran, ",").replace(",", ".") + " karakter).", "saran": None}
    except BaseException as e:
        galat = _syn_galat(e, kode)
    finally:
        sys.settrace(None)
        sys.stdout, sys.stderr, sys.stdin = lama
        builtins.__dict__.clear()
        builtins.__dict__.update(_SYN_BUILTINS)
        sys.setrecursionlimit(_SYN_REKURSI)

    akhir = {"baris": galat["baris"] if galat else None, "vars": [], "panjangKeluaran": keluar.panjang, "tumpukan": []}
    _syn_isi("global", ruang, akhir["vars"])
    if galat is None or not rekam or status["terpotong"] or not langkah:
        langkah.append(akhir)
    else:
        # Langkah terakhir yang terekam = baris yang gagal; ganti dengan keadaan
        # saat gagal (seperti pseudocode) agar tidak ada dua langkah untuk satu baris.
        terakhir = langkah[-1]
        terakhir["panjangKeluaran"] = keluar.panjang
    return json.dumps({"langkah": langkah, "keluaran": keluar.teks(), "galat": galat, "terpotong": status["terpotong"]})
`;
