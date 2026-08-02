// Course data — dikonversi dari LmsData.php

export interface Lesson {
  id: number;
  slug: string;
  title: string;
  type: 'video' | 'reading' | 'quiz';
  duration: string;
  free: boolean;
}

export interface Section {
  id: number;
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: number;
  slug: string;
  title: string;
  short_desc: string;
  long_desc: string;
  level: string;
  level_color: string;
  category: string;
  icon: string;
  lessons_count: number;
  duration: string;
  rating: number;
  reviews: number;
  /** Kelas Tailwind untuk tint kepala kartu. Gradient lama dibuang —
   *  permukaan gradient melawan kesan cetak pada palet ini. */
  tint: string;
  instructor: string;
  instructor_bio: string;
  what_you_learn: string[];
  requirements: string[];
  sections: Section[];
}

export const courses: Course[] = [
  {
    id: 1,
    slug: 'dasar-neuroscience',
    title: 'Dasar Neuroscience',
    short_desc: 'Pelajari struktur neuron, sinapsis, dan cara otak memproses informasi dari level seluler hingga sistem.',
    long_desc: 'Modul ini merupakan fondasi dari seluruh kurikulum. Anda akan memulai dari konsep paling dasar tentang sistem saraf, memahami bagaimana neuron berkomunikasi melalui sinapsis, hingga mempelajari arsitektur otak manusia secara menyeluruh.',
    level: 'Pemula', level_color: 'green', category: 'neuroscience', icon: 'brain',
    lessons_count: 12, duration: '6 Jam', rating: 4.8, reviews: 124,
    tint: 'bg-blue-50',
    instructor: 'Tim Pengajar SynapEd', instructor_bio: 'Spesialis Neurosains Kognitif dan Neuroplastisitas.',
    what_you_learn: [
      'Memahami struktur neuron dan fungsinya',
      'Mengenal berbagai jenis sinapsis dan neurotransmitter',
      'Mempelajari anatomi otak manusia secara sistematis',
      'Memahami bagaimana sinyal listrik mengalir di neuron',
      'Mengenal lobus-lobus otak dan fungsinya',
      'Fondasi untuk mempelajari teknologi EEG',
    ],
    requirements: [
      'Tidak diperlukan pengetahuan medis sebelumnya',
      'Kemampuan membaca teks akademik dasar',
      'Rasa ingin tahu yang tinggi',
    ],
    sections: [
      { id: 1, title: 'Pengantar Neuroscience', lessons: [
        { id: 1, slug: 'apa-itu-neuroscience', title: 'Apa itu Neuroscience?', type: 'video', duration: '18 menit', free: true },
        { id: 2, slug: 'sejarah-neuroscience', title: 'Sejarah Singkat Neuroscience', type: 'video', duration: '14 menit', free: true },
        { id: 3, slug: 'neuroscience-kehidupan', title: 'Neuroscience dalam Kehidupan Sehari-hari', type: 'reading', duration: '10 menit', free: false },
      ]},
      { id: 2, title: 'Anatomi Neuron', lessons: [
        { id: 4, slug: 'struktur-neuron', title: 'Struktur Dasar Neuron', type: 'video', duration: '22 menit', free: false },
        { id: 5, slug: 'jenis-neuron', title: 'Jenis-jenis Neuron', type: 'video', duration: '16 menit', free: false },
        { id: 6, slug: 'kuis-anatomi-neuron', title: 'Kuis: Anatomi Neuron', type: 'quiz', duration: '10 menit', free: false },
      ]},
      { id: 3, title: 'Sinapsis dan Neurotransmitter', lessons: [
        { id: 7, slug: 'mekanisme-sinapsis', title: 'Mekanisme Sinapsis', type: 'video', duration: '20 menit', free: false },
        { id: 8, slug: 'neurotransmitter-utama', title: 'Neurotransmitter Utama', type: 'video', duration: '18 menit', free: false },
        { id: 9, slug: 'gangguan-neurotransmitter', title: 'Gangguan Neurotransmitter', type: 'reading', duration: '12 menit', free: false },
      ]},
      { id: 4, title: 'Arsitektur Otak', lessons: [
        { id: 10, slug: 'lobus-otak', title: 'Lobus-lobus Otak', type: 'video', duration: '24 menit', free: false },
        { id: 11, slug: 'sistem-limbik', title: 'Sistem Limbik dan Emosi', type: 'video', duration: '20 menit', free: false },
        { id: 12, slug: 'kuis-arsitektur-otak', title: 'Kuis Akhir: Arsitektur Otak', type: 'quiz', duration: '15 menit', free: false },
      ]},
    ],
  },
  {
    id: 2,
    slug: 'pengenalan-eeg',
    title: 'Pengenalan EEG',
    short_desc: 'Memahami prinsip electroencephalography, cara kerja elektroda, dan teknik perekaman sinyal otak.',
    long_desc: 'Modul ini memperkenalkan Anda pada dunia Electroencephalography (EEG). Anda akan memahami bagaimana sinyal listrik otak direkam, interpretasi gelombang otak dasar, serta standar internasional penempatan elektroda.',
    level: 'Menengah', level_color: 'yellow', category: 'eeg', icon: 'wave',
    lessons_count: 10, duration: '8 Jam', rating: 4.7, reviews: 89,
    tint: 'bg-paper-alt',
    instructor: 'Tim Pengajar SynapEd', instructor_bio: 'Spesialis Teknologi EEG dan Sinyal Biomedik.',
    what_you_learn: [
      'Memahami prinsip dasar EEG',
      'Mengenal jenis-jenis gelombang otak',
      'Mempelajari sistem penempatan elektroda 10-20',
      'Teknik perekaman sinyal EEG yang benar',
      'Interpretasi sinyal EEG dasar',
      'Artefak dan cara mengatasinya',
    ],
    requirements: [
      'Menyelesaikan modul Dasar Neuroscience',
      'Pemahaman dasar tentang listrik',
      'Komputer dengan koneksi internet',
    ],
    sections: [
      { id: 5, title: 'Dasar EEG', lessons: [
        { id: 13, slug: 'apa-itu-eeg', title: 'Apa itu EEG?', type: 'video', duration: '20 menit', free: true },
        { id: 14, slug: 'sejarah-eeg', title: 'Sejarah dan Perkembangan EEG', type: 'video', duration: '15 menit', free: true },
      ]},
      { id: 6, title: 'Gelombang Otak', lessons: [
        { id: 15, slug: 'jenis-gelombang-otak', title: 'Alpha, Beta, Theta, Delta', type: 'video', duration: '25 menit', free: false },
        { id: 16, slug: 'frekuensi-dan-amplitudo', title: 'Frekuensi dan Amplitudo', type: 'video', duration: '18 menit', free: false },
        { id: 17, slug: 'kuis-gelombang', title: 'Kuis: Gelombang Otak', type: 'quiz', duration: '10 menit', free: false },
      ]},
      { id: 7, title: 'Sistem Elektroda', lessons: [
        { id: 18, slug: 'sistem-10-20', title: 'Sistem Internasional 10-20', type: 'video', duration: '22 menit', free: false },
        { id: 19, slug: 'impedansi-elektroda', title: 'Impedansi dan Kualitas Sinyal', type: 'video', duration: '16 menit', free: false },
        { id: 20, slug: 'artefak-eeg', title: 'Mengenali dan Mengatasi Artefak', type: 'reading', duration: '12 menit', free: false },
      ]},
    ],
  },
  {
    id: 3,
    slug: 'implementasi-muse',
    title: 'Implementasi Muse',
    short_desc: 'Praktik langsung menggunakan headband Muse untuk merekam dan menganalisis sinyal otak secara real-time.',
    long_desc: 'Modul ini membawa Anda ke praktik langsung dengan perangkat EEG konsumer — Muse Headband. Anda akan belajar setup, koneksi, streaming data, hingga visualisasi sinyal otak menggunakan Python.',
    level: 'Menengah', level_color: 'yellow', category: 'eeg', icon: 'headset',
    lessons_count: 8, duration: '7 Jam', rating: 4.9, reviews: 67,
    tint: 'bg-amber-100',
    instructor: 'Tim Pengajar SynapEd', instructor_bio: 'Praktisi Brain-Computer Interface dan Developer Python.',
    what_you_learn: [
      'Setup dan konfigurasi Muse Headband',
      'Streaming data EEG menggunakan LSL',
      'Visualisasi sinyal otak real-time',
      'Pengolahan data EEG dengan Python',
      'Membuat aplikasi neurofeedback sederhana',
      'Best practice penggunaan perangkat EEG',
    ],
    requirements: [
      'Menyelesaikan modul Pengenalan EEG',
      'Dasar pemrograman Python',
      'Perangkat Muse Headband (opsional)',
    ],
    sections: [
      { id: 8, title: 'Setup Muse', lessons: [
        { id: 21, slug: 'mengenal-muse', title: 'Mengenal Muse Headband', type: 'video', duration: '15 menit', free: true },
        { id: 22, slug: 'setup-lingkungan', title: 'Setup Lingkungan Development', type: 'video', duration: '20 menit', free: false },
      ]},
      { id: 9, title: 'Streaming Data', lessons: [
        { id: 23, slug: 'muse-lsl', title: 'Koneksi Muse via LSL', type: 'video', duration: '22 menit', free: false },
        { id: 24, slug: 'python-streaming', title: 'Python Real-time Streaming', type: 'video', duration: '25 menit', free: false },
      ]},
      { id: 10, title: 'Visualisasi & Analisis', lessons: [
        { id: 25, slug: 'visualisasi-eeg', title: 'Visualisasi Sinyal EEG', type: 'video', duration: '20 menit', free: false },
        { id: 26, slug: 'analisis-frekuensi', title: 'Analisis Frekuensi Dasar', type: 'video', duration: '22 menit', free: false },
        { id: 27, slug: 'neurofeedback-sederhana', title: 'Membuat Neurofeedback Sederhana', type: 'video', duration: '28 menit', free: false },
        { id: 28, slug: 'kuis-implementasi', title: 'Kuis: Implementasi Muse', type: 'quiz', duration: '12 menit', free: false },
      ]},
    ],
  },
  {
    id: 4,
    slug: 'analisis-data-eeg',
    title: 'Analisis Data EEG',
    short_desc: 'Teknik pengolahan sinyal, ekstraksi fitur, dan analisis data EEG menggunakan Python dan MNE.',
    long_desc: 'Modul lanjutan yang berfokus pada analisis data EEG secara mendalam menggunakan library Python MNE. Anda akan belajar preprocessing, analisis spektral, ERP, dan machine learning untuk klasifikasi sinyal otak.',
    level: 'Lanjutan', level_color: 'red', category: 'analisis', icon: 'chart',
    lessons_count: 10, duration: '10 Jam', rating: 4.6, reviews: 45,
    tint: 'bg-blue-100',
    instructor: 'Tim Pengajar SynapEd', instructor_bio: 'Data Scientist dengan spesialisasi Neuroscience Komputasional.',
    what_you_learn: [
      'Preprocessing data EEG',
      'Analisis domain frekuensi (FFT, PSD)',
      'Event-Related Potentials (ERP)',
      'Ekstraksi fitur untuk Machine Learning',
      'Klasifikasi sinyal EEG',
      'Membuat pipeline analisis end-to-end',
    ],
    requirements: [
      'Menyelesaikan modul Pengenalan EEG',
      'Pemrograman Python menengah',
      'Dasar statistik dan matematika',
    ],
    sections: [
      { id: 11, title: 'Preprocessing', lessons: [
        { id: 29, slug: 'pengantar-mne', title: 'Pengantar MNE-Python', type: 'video', duration: '20 menit', free: true },
        { id: 30, slug: 'filtering-eeg', title: 'Filtering Sinyal EEG', type: 'video', duration: '22 menit', free: false },
        { id: 31, slug: 'artefak-removal', title: 'ICA dan Artefak Removal', type: 'video', duration: '25 menit', free: false },
      ]},
      { id: 12, title: 'Analisis Spektral', lessons: [
        { id: 32, slug: 'fft-psd', title: 'FFT dan Power Spectral Density', type: 'video', duration: '24 menit', free: false },
        { id: 33, slug: 'band-power', title: 'Analisis Band Power', type: 'video', duration: '20 menit', free: false },
      ]},
      { id: 13, title: 'Machine Learning', lessons: [
        { id: 34, slug: 'feature-extraction', title: 'Ekstraksi Fitur EEG', type: 'video', duration: '22 menit', free: false },
        { id: 35, slug: 'klasifikasi-eeg', title: 'Klasifikasi Sinyal EEG', type: 'video', duration: '28 menit', free: false },
        { id: 36, slug: 'pipeline-lengkap', title: 'Pipeline Analisis Lengkap', type: 'video', duration: '30 menit', free: false },
        { id: 37, slug: 'proyek-akhir', title: 'Proyek Akhir: Analisis Dataset', type: 'reading', duration: '45 menit', free: false },
        { id: 38, slug: 'kuis-akhir-analisis', title: 'Kuis Akhir: Analisis Data', type: 'quiz', duration: '15 menit', free: false },
      ]},
    ],
  },
];

export const iconPaths: Record<string, string> = {
  brain: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  wave: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
  headset: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  chart: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  reading: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
};

/** Tone dipetakan ke primitif <Tag>, bukan ke kelas Tailwind lepas —
 *  emerald/rose lama berada di luar palet "Tinta & Kertas". */
export const levelMap: Record<string, { tone: 'blue' | 'amber' | 'rust'; label: string }> = {
  green: { tone: 'blue', label: 'Pemula' },
  yellow: { tone: 'amber', label: 'Menengah' },
  red: { tone: 'rust', label: 'Lanjutan' },
};
