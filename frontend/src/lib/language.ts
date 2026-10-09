/**
 * Bahasa tampilan situs: "id" (asli) atau "en" (diterjemahkan Google).
 *
 * Disimpan di localStorage (`synaped_lang`) dan - khusus "en" - dipasang sebagai
 * cookie `googtrans=/id/en` yang dibaca widget Google Website Translation.
 * Modul netral (tanpa server-only): dipakai LanguageSwitch dan TranslateLoader.
 */
export type Bahasa = "id" | "en";

export const LANG_KEY = "synaped_lang";

/** Cookie yang dibaca widget penerjemah Google untuk memilih pasangan bahasa. */
function aturCookie(b: Bahasa) {
  const host = window.location.hostname;
  const kedaluwarsa = "expires=Thu, 01 Jan 1970 00:00:00 GMT";

  // Widget membaca cookie di path "/" pada host dan (kadang) domain induknya.
  const varian = ["", `; domain=${host}`, `; domain=.${host}`];

  for (const d of varian) {
    document.cookie =
      b === "en" ? `googtrans=/id/en; path=/${d}` : `googtrans=; ${kedaluwarsa}; path=/${d}`;
  }
}

/** Simpan pilihan, atur cookie penerjemah, lalu muat ulang agar berlaku dari awal. */
export function setBahasa(b: Bahasa) {
  try {
    localStorage.setItem(LANG_KEY, b);
  } catch {
    // penyimpanan diblokir: cookie tetap menjaga pilihan selama sesi
  }
  aturCookie(b);
  window.location.reload();
}

export function bahasaTersimpan(): Bahasa {
  try {
    if (localStorage.getItem(LANG_KEY) === "en") return "en";
  } catch {
    // abaikan
  }
  return /(?:^|;\s*)googtrans=\/id\/en/.test(document.cookie) ? "en" : "id";
}
