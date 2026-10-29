/*
 * SynapLab · Lab 04 Python — Web Worker yang menjalankan Pyodide (CPython di
 * WebAssembly). Berkas statis (bukan dibundel) karena Pyodide dimuat dengan
 * importScripts, yang hanya ada di worker klasik.
 *
 * KEAMANAN — kode Python dari tautan siapa saja berjalan di origin SynapEd.
 * Tiga lapisan, dari yang terkuat:
 *  1. Content-Security-Policy berkas ini (next.config.ts): script & koneksi
 *     hanya ke direktori Pyodide yang dikunci versinya, tanpa eval, tanpa
 *     worker bersarang. Ditegakkan BROWSER, berlaku apa pun yang dilakukan kode.
 *  2. Setelah Pyodide termuat, API jaringan & penyimpanan dihapus dari global
 *     worker (dan prototipenya) — jalan pulang ke fetch/importScripts tertutup.
 *  3. Penghalang impor `js`/`pyodide` di pythonPelacak.ts — pesan yang jelas
 *     bagi yang mencoba, BUKAN pembatas (bisa ditembus lewat gc).
 * Hasil yang dikirim ke halaman diperiksa bentuknya (sahkanJejak) sebelum
 * dirender — worker ini tidak dipercaya halaman.
 *
 * Protokol (pesan dari halaman):
 *   { jenis: "muat", indexURL, pelacak }       → { jenis: "siap" } | { jenis: "gagal-muat", pesan }
 *   { jenis: "jalankan", id, kode, masukan, rekam, maksRekam, maksLangkah, maksKeluaran }
 *                                              → { jenis: "keluaran", id, teks }* lalu { jenis: "hasil", id, json }
 */
"use strict";

var jalankanPython = null;
var sedangMemuat = false;

var API_TERLARANG = [
  "fetch", "XMLHttpRequest", "WebSocket", "WebSocketStream", "WebTransport", "EventSource",
  "importScripts", "indexedDB", "caches", "BroadcastChannel", "Worker", "SharedWorker",
  "FontFace", "fonts", "navigator",
];

function kunciJaringan() {
  for (var i = 0; i < API_TERLARANG.length; i++) {
    var nama = API_TERLARANG[i];
    // Hapus dari global DAN seluruh rantai prototipenya (fetch & importScripts
    // hidup di WorkerGlobalScope.prototype, bukan di objek global sendiri).
    for (var o = self; o; o = Object.getPrototypeOf(o)) {
      try {
        if (Object.prototype.hasOwnProperty.call(o, nama)) delete o[nama];
      } catch {
        /* properti tak bisa dihapus — ditimpa di bawah */
      }
    }
    try {
      Object.defineProperty(self, nama, { value: undefined, writable: false, configurable: false });
    } catch {
      /* sudah tidak ada */
    }
  }
}

function galatInternal(pesan) {
  return JSON.stringify({ langkah: [], keluaran: "", galat: { baris: null, jenis: "Galat internal", pesan: String(pesan), saran: null }, terpotong: false });
}

self.onmessage = function (e) {
  var d = e.data || {};
  if (d.jenis === "muat") {
    if (jalankanPython || sedangMemuat) return;
    sedangMemuat = true;
    try {
      importScripts(d.indexURL + "pyodide.js");
    } catch (err) {
      self.postMessage({ jenis: "gagal-muat", pesan: "Pyodide tidak bisa diunduh (" + (err && err.message ? err.message : err) + ")" });
      return;
    }
    self
      .loadPyodide({ indexURL: d.indexURL, stdout: function () {}, stderr: function () {} })
      .then(function (py) {
        py.runPython(d.pelacak);
        jalankanPython = py.globals.get("_synap_jalankan");
        kunciJaringan();
        self.postMessage({ jenis: "siap" });
      })
      .catch(function (err) {
        self.postMessage({ jenis: "gagal-muat", pesan: String(err && err.message ? err.message : err) });
      });
    return;
  }
  if (d.jenis === "jalankan") {
    if (!jalankanPython) {
      self.postMessage({ jenis: "hasil", id: d.id, json: galatInternal("Python belum siap.") });
      return;
    }
    var id = d.id;
    var kabar = function (teks) {
      self.postMessage({ jenis: "keluaran", id: id, teks: String(teks) });
    };
    var json;
    try {
      json = jalankanPython(String(d.kode), String(d.masukan), !!d.rekam, d.maksRekam | 0, d.maksLangkah | 0, d.maksKeluaran | 0, kabar);
    } catch (err) {
      json = galatInternal(err && err.message ? err.message : err);
    }
    self.postMessage({ jenis: "hasil", id: id, json: String(json) });
  }
};
