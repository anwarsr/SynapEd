/**
 * Suara game SyRobo (Bola Gabung & Tanjakan Robo): efek suara + musik latar, semuanya DIBUAT LANGSUNG dengan WebAudio (tanpa berkas
 * audio, jadi tak ada unduhan dan tak ada hak cipta). Pemain bisa menghidupkan/mematikan MUSIK dan EFEK sendiri-sendiri; pilihan
 * disimpan di perangkat (localStorage) dan berlaku untuk kedua game. Hanya untuk komponen klien.
 *
 * Musik = penjadwal kecil (melihat 0,3 dtk ke depan) yang memainkan progresi akor berulang: Bola Gabung tenang (marimba + pad),
 * Tanjakan Robo bertenaga (bass bergerak, kick, hi-hat, arpeggio), Lari Robo cepat dan ceria (kick empat-per-birama, bass melompat, melodi pentatonik). Musik hanya berbunyi selagi permainan berjalan.
 */

const KUNCI = "synaped_syrobo_suara";

export interface PengaturanSuara {
  musik: boolean;
  efek: boolean;
}

export function bacaPengaturan(): PengaturanSuara {
  try {
    const r = JSON.parse(localStorage.getItem(KUNCI) ?? "null") as Partial<PengaturanSuara> | null;
    return { musik: r?.musik !== false, efek: r?.efek !== false };
  } catch {
    return { musik: true, efek: true };
  }
}

export function simpanPengaturan(p: PengaturanSuara): void {
  try {
    localStorage.setItem(KUNCI, JSON.stringify(p));
  } catch {
    /* diabaikan */
  }
}

export type GayaMusik = "bola" | "tanjakan" | "lari";

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface OpsiNada {
  tipe?: OscillatorType;
  vol?: number;
  /** Pengali frekuensi di akhir nada (meluncur). */
  luncur?: number;
  /** Waktu mulai mutlak (detik konteks); bawaan sekarang. */
  at?: number;
  atk?: number;
  /** Frekuensi potong lowpass (Hz). */
  filter?: number;
  bus?: "efek" | "musik";
}

export class SuaraGame {
  private ctx: AudioContext | null = null;
  private efekBus: GainNode | null = null;
  private musikBus: GainNode | null = null;
  private peng: PengaturanSuara;
  private main = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private langkah = 0;
  private nextT = 0;
  private bufDerau: AudioBuffer | null = null;
  private mesinNode: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private nitroNode: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private dentumT = 0;

  constructor(private gaya: GayaMusik, peng: PengaturanSuara) {
    this.peng = { ...peng };
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = 0.8;
      master.connect(ctx.destination);
      this.efekBus = ctx.createGain();
      this.efekBus.gain.value = peng.efek ? 1 : 0;
      this.efekBus.connect(master);
      this.musikBus = ctx.createGain();
      this.musikBus.gain.value = 0;
      this.musikBus.connect(master);
      this.ctx = ctx;
      this.nextT = ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.jadwal(), 80);
    } catch {
      this.ctx = null;
    }
  }

  get pengaturan(): PengaturanSuara {
    return { ...this.peng };
  }

  /** Peramban menahan suara sampai ada sentuhan/tombol: panggil dari penanganan penunjuk/papan ketik. */
  buka(): void {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume().catch(() => undefined);
  }

  setMusik(b: boolean): void {
    this.peng.musik = b;
    this.terapkanBus();
  }

  setEfek(b: boolean): void {
    this.peng.efek = b;
    if (this.efekBus && this.ctx) this.efekBus.gain.setTargetAtTime(b ? 1 : 0, this.ctx.currentTime, 0.04);
    if (!b) {
      this.nitro(false);
      this.mesin(0, false, false);
    }
  }

  /** Musik hanya berbunyi selagi permainan berjalan (bukan saat jeda/selesai). */
  atur(berjalan: boolean): void {
    if (berjalan === this.main) return;
    this.main = berjalan;
    this.terapkanBus();
  }

  private terapkanBus(): void {
    if (this.musikBus && this.ctx) this.musikBus.gain.setTargetAtTime(this.peng.musik && this.main ? 0.55 : 0, this.ctx.currentTime, 0.18);
  }

  tutup(): void {
    clearInterval(this.timer);
    try {
      this.mesinNode?.osc.stop();
      this.nitroNode?.src.stop();
      void this.ctx?.close();
    } catch {
      /* diabaikan */
    }
    this.ctx = null;
  }

  // ── dasar ──────────────────────────────────────────────────────────────
  private bus(o?: OpsiNada): GainNode | null {
    return o?.bus === "musik" ? this.musikBus : this.efekBus;
  }

  private nada(f: number, dur: number, o: OpsiNada = {}): void {
    const ctx = this.ctx;
    const bus = this.bus(o);
    if (!ctx || !bus) return;
    if (o.bus !== "musik" && !this.peng.efek) return;
    const t = o.at ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.tipe ?? "sine";
    osc.frequency.setValueAtTime(f, t);
    if (o.luncur) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f * o.luncur), t + dur);
    const vol = o.vol ?? 0.15;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + (o.atk ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let akhir: AudioNode = osc;
    if (o.filter) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = o.filter;
      osc.connect(lp);
      akhir = lp;
    }
    akhir.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private derau(dur: number, vol: number, filter: number, o: { at?: number; tipeF?: BiquadFilterType; bus?: "efek" | "musik" } = {}): void {
    const ctx = this.ctx;
    const bus = this.bus(o);
    if (!ctx || !bus) return;
    if (o.bus !== "musik" && !this.peng.efek) return;
    if (!this.bufDerau) {
      const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.bufDerau = b;
    }
    const t = o.at ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.bufDerau;
    const f = ctx.createBiquadFilter();
    f.type = o.tipeF ?? "lowpass";
    f.frequency.value = filter;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ── efek Bola Gabung ────────────────────────────────────────────────────
  jatuh(): void {
    this.nada(540, 0.1, { vol: 0.14, luncur: 0.55 });
    this.derau(0.03, 0.05, 2400);
  }

  /** Benturan antarbola/dinding: makin keras makin nyaring, dibatasi supaya tumpukan tak berisik. */
  dentum(kuat: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.currentTime - this.dentumT < 0.045) return;
    this.dentumT = ctx.currentTime;
    const v = Math.min(0.2, kuat / 1100);
    this.nada(150 + Math.random() * 60, 0.1, { vol: v, luncur: 0.5 });
    this.derau(0.04, v * 0.5, 1100);
  }

  /** Penggabungan: nadanya naik mengikuti tingkat bola (tangga nada pentatonik), bola besar diberi dentum rendah. */
  gabung(n: number): void {
    const tangga = [0, 2, 4, 7, 9];
    const m = 60 + tangga[n % 5] + 12 * Math.floor(n / 5);
    this.nada(midi(m), 0.38, { tipe: "triangle", vol: 0.17 });
    this.nada(midi(m + 7), 0.3, { tipe: "triangle", vol: 0.1, at: this.ctx ? this.ctx.currentTime + 0.05 : undefined });
    this.nada(midi(m + 12), 0.22, { vol: 0.07, at: this.ctx ? this.ctx.currentTime + 0.09 : undefined });
    if (n >= 6) this.nada(midi(m - 24), 0.35, { vol: 0.16, luncur: 0.7 });
  }

  selesai(): void {
    const c = this.ctx?.currentTime ?? 0;
    [392, 330, 262, 196].forEach((f, i) => this.nada(f, 0.32, { tipe: "triangle", vol: 0.18, at: c + i * 0.2 }));
  }

  rekor(): void {
    const c = this.ctx?.currentTime ?? 0;
    [523, 659, 784, 1047].forEach((f, i) => this.nada(f, 0.26, { tipe: "triangle", vol: 0.16, at: c + i * 0.09 }));
  }

  // ── efek Tanjakan Robo ──────────────────────────────────────────────────
  koin(): void {
    const c = this.ctx?.currentTime ?? 0;
    this.nada(988, 0.09, { tipe: "square", vol: 0.06, at: c });
    this.nada(1319, 0.18, { tipe: "square", vol: 0.06, at: c + 0.07 });
  }

  bensin(): void {
    const c = this.ctx?.currentTime ?? 0;
    [440, 554, 659].forEach((f, i) => this.nada(f, 0.18, { vol: 0.14, tipe: "triangle", at: c + i * 0.07 }));
  }

  ambilNitro(): void {
    this.nada(260, 0.4, { tipe: "sawtooth", vol: 0.09, luncur: 3, filter: 2500 });
    this.derau(0.3, 0.07, 3000, { tipeF: "bandpass" });
  }

  loncat(): void {
    this.nada(210, 0.2, { tipe: "square", vol: 0.07, luncur: 2.2, filter: 1800 });
  }

  mendarat(kuat: number): void {
    const v = Math.min(0.3, kuat / 1400);
    if (v < 0.04) return;
    this.nada(95, 0.16, { vol: v, luncur: 0.5 });
    this.derau(0.1, v * 0.6, 900);
  }

  tabrak(): void {
    this.derau(0.45, 0.28, 1600);
    this.nada(220, 0.55, { tipe: "sawtooth", vol: 0.16, luncur: 0.3, filter: 1500 });
  }

  habisBensin(): void {
    const c = this.ctx?.currentTime ?? 0;
    this.nada(330, 0.3, { tipe: "triangle", vol: 0.15, at: c });
    this.nada(247, 0.5, { tipe: "triangle", vol: 0.15, at: c + 0.25 });
  }

  // ── efek Lari Robo ──────────────────────────────────────────────────────
  /** Lesatan dash: desis naik + nada menyapu. */
  dash(): void {
    this.derau(0.28, 0.12, 2600, { tipeF: "bandpass" });
    this.nada(180, 0.3, { tipe: "sawtooth", vol: 0.08, luncur: 4, filter: 3000 });
  }

  /** Rintangan hancur oleh dash. */
  hancur(): void {
    this.derau(0.22, 0.2, 2200);
    this.nada(320, 0.18, { tipe: "square", vol: 0.07, luncur: 0.4, filter: 2000 });
  }

  /** Desis nitro selama menyala. */
  nitro(aktif: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.efekBus) return;
    if (aktif && !this.nitroNode && this.peng.efek) {
      const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = b;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 1800;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(f).connect(gain).connect(this.efekBus);
      src.start();
      this.nitroNode = { src, gain };
    }
    this.nitroNode?.gain.gain.setTargetAtTime(aktif && this.peng.efek ? 0.1 : 0, ctx.currentTime, 0.06);
  }

  /** Suara mesin mengikuti kecepatan (dipanggil tiap bingkai). */
  mesin(v: number, gas: boolean, aktif: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.efekBus) return;
    if (!this.mesinNode) {
      if (!aktif || !this.peng.efek) return;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 55;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 420;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter).connect(gain).connect(this.efekBus);
      osc.start();
      this.mesinNode = { osc, gain, filter };
    }
    const m = this.mesinNode;
    const hidup = aktif && this.peng.efek;
    m.gain.gain.setTargetAtTime(hidup ? (gas ? 0.05 : 0.022) : 0, ctx.currentTime, 0.08);
    m.osc.frequency.setTargetAtTime(52 + v * 0.17 + (gas ? 28 : 0), ctx.currentTime, 0.06);
    m.filter.frequency.setTargetAtTime(380 + v * 0.8, ctx.currentTime, 0.1);
  }

  // ── musik ───────────────────────────────────────────────────────────────
  private jadwal(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!(this.peng.musik && this.main) || ctx.state !== "running") {
      this.nextT = ctx.currentTime + 0.1;
      return;
    }
    if (this.nextT < ctx.currentTime - 0.2) this.nextT = ctx.currentTime + 0.05;
    const dt = this.gaya === "bola" ? 60 / 88 / 2 : this.gaya === "lari" ? 60 / 142 / 2 : 60 / 126 / 2;
    while (this.nextT < ctx.currentTime + 0.3) {
      if (this.gaya === "bola") this.langkahBola(this.nextT, this.langkah);
      else if (this.gaya === "lari") this.langkahLariMusik(this.nextT, this.langkah);
      else this.langkahTanjakan(this.nextT, this.langkah);
      this.langkah++;
      this.nextT += dt;
    }
  }

  private langkahBola(t: number, i: number): void {
    const akar = [60, 57, 53, 55][Math.floor(i / 8) % 4];
    const minor = Math.floor(i / 8) % 4 === 1;
    const akor = [0, minor ? 3 : 4, 7, 12];
    const s = i % 8;
    if (s === 0) {
      // pad lembut sepanjang birama
      for (const x of [0, minor ? 3 : 4, 7]) this.nada(midi(akar - 12 + x), 2.6, { bus: "musik", tipe: "sine", vol: 0.05, atk: 0.4, at: t });
      this.nada(midi(akar - 24), 0.9, { bus: "musik", vol: 0.12, at: t });
    }
    if (s === 4) this.nada(midi(akar - 24 + 7), 0.7, { bus: "musik", vol: 0.09, at: t });
    const pola = [0, 2, 1, 2, 3, 2, 1, 2];
    if (Math.random() > 0.16) {
      const m = akar + akor[pola[s]] + (s % 4 === 0 && Math.random() < 0.3 ? 12 : 0);
      this.nada(midi(m), 0.5, { bus: "musik", tipe: "sine", vol: 0.075, at: t });
      this.nada(midi(m + 12), 0.18, { bus: "musik", tipe: "triangle", vol: 0.025, at: t });
    }
  }

  /** Lari Robo: kick tiap ketukan, hi-hat di sela, bass melompat, melodi pentatonik yang berubah tiap birama. */
  private langkahLariMusik(t: number, i: number): void {
    const bar = Math.floor(i / 8) % 4;
    const akar = [57, 53, 60, 55][bar];
    const s = i % 8;
    if (s % 2 === 0) this.nada(130, 0.14, { bus: "musik", vol: 0.2, luncur: 0.32, at: t });
    else this.derau(0.035, 0.05, 8000, { bus: "musik", tipeF: "highpass", at: t });
    if (s === 4) this.derau(0.09, 0.07, 1800, { bus: "musik", tipeF: "bandpass", at: t });
    const bass = [0, 0, 7, 0, 12, 0, 7, 5][s];
    this.nada(midi(akar - 12 + bass), 0.18, { bus: "musik", tipe: "triangle", vol: 0.16, at: t });
    const pentatonik = [0, 3, 5, 7, 10, 12, 15, 17];
    if ((s === 0 || s === 3 || s === 5 || s === 7) && Math.random() > 0.1) {
      const m = akar + 12 + pentatonik[(i * 3 + bar * 2 + (s >> 1)) % pentatonik.length];
      this.nada(midi(m), 0.22, { bus: "musik", tipe: "square", vol: 0.04, filter: 3000, at: t });
    }
  }

  private langkahTanjakan(t: number, i: number): void {
    const bar = Math.floor(i / 8) % 4;
    const akar = [45, 41, 48, 43][bar];
    const s = i % 8;
    if (s % 2 === 0) this.nada(120, 0.15, { bus: "musik", vol: 0.2, luncur: 0.35, at: t });
    else this.derau(0.04, 0.045, 7000, { bus: "musik", tipeF: "highpass", at: t });
    const lompat = [0, 0, 12, 0, 0, 12, 7, 0][s];
    this.nada(midi(akar + lompat), 0.2, { bus: "musik", tipe: "sawtooth", vol: 0.09, filter: 520, at: t });
    const akor = [0, bar === 1 || bar === 2 ? 4 : 3, 7, 12];
    if (s === 0 || s === 3 || s === 6) this.nada(midi(akar + 24 + akor[(i >> 1) % 4]), 0.16, { bus: "musik", tipe: "square", vol: 0.028, filter: 2600, at: t });
  }
}
