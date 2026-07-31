<section id="learning-path" class="relative py-24 bg-slate-50 overflow-hidden">
    <div class="absolute inset-0 opacity-40" style="background-image: radial-gradient(#3b82f6 0.5px, transparent 0.5px); background-size: 24px 24px;"></div>

    <div class="relative max-w-7xl mx-auto px-6">
        <div class="text-center mb-20">
            <h2 class="text-3xl sm:text-4xl lg:text-5xl font-poppins font-bold text-slate-900 leading-tight mb-10">
                Berikut Adalah Langkah <span class="text-[#0056D2]">Pembelajaran</span> Kamu
            </h2>
            <h6 class="text-slate-500 font-poppins text-semibold">
                klik untuk interaksi !!!
            </h6>
        </div>

        @php
        $steps = [
            ['num' => '01', 'title' => 'Daftar', 'desc' => 'Buat akun dan mulai akses seluruh kurikulum.', 'icon' => 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z', 'color' => 'bg-blue-600'],
            ['num' => '02', 'title' => 'Pilih Materi', 'desc' => 'Jelajahi kurikulum dan pilih modul sesuai minat.', 'icon' => 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', 'color' => 'bg-blue-500'],
            ['num' => '03', 'title' => 'Belajar', 'desc' => 'Tonton video, modul PDF, dan selesaikan kuis.', 'icon' => 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z', 'color' => 'bg-indigo-600'],
            ['num' => '04', 'title' => 'Praktik', 'desc' => 'Terapkan ilmu melalui studi kasus dan proyek nyata.', 'icon' => 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4', 'color' => 'bg-indigo-500'],
            ['num' => '05', 'title' => 'Evaluasi', 'desc' => 'Ikuti ujian akhir dan dapatkan sertifikat digital.', 'icon' => 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z', 'color' => 'bg-blue-700'],
        ];
        @endphp

        <div class="relative max-w-6xl mx-auto">
            <svg class="absolute inset-0 w-full h-full pointer-events-none hidden lg:block" style="transform: translateY(40px);" viewBox="0 0 1200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#3b82f6" />
                        <stop offset="100%" stop-color="#6366f1" />
                    </linearGradient>
                </defs>

                <path id="line-1" d="M 120,40 C 180,-20 300,100 360,40" stroke="url(#lineGradient)" stroke-width="8" stroke-linecap="round" class="opacity-10 transition-all duration-700 ease-out" style="stroke-dasharray: 400; stroke-dashoffset: 400;" />
                <path id="line-2" d="M 360,40 C 420,-20 540,100 600,40" stroke="url(#lineGradient)" stroke-width="8" stroke-linecap="round" class="opacity-10 transition-all duration-700 ease-out" style="stroke-dasharray: 400; stroke-dashoffset: 400;" />
                <path id="line-3" d="M 600,40 C 660,-20 780,100 840,40" stroke="url(#lineGradient)" stroke-width="8" stroke-linecap="round" class="opacity-10 transition-all duration-700 ease-out" style="stroke-dasharray: 400; stroke-dashoffset: 400;" />
                <path id="line-4" d="M 840,40 C 900,-20 1020,100 1080,40" stroke="url(#lineGradient)" stroke-width="8" stroke-linecap="round" class="opacity-10 transition-all duration-700 ease-out" style="stroke-dasharray: 400; stroke-dashoffset: 400;" />
            </svg>

            <div class="hidden lg:grid grid-cols-5 relative z-10">
                @foreach($steps as $index => $step)
                <div class="flex flex-col items-center text-center group cursor-pointer" onclick="handleStepClick({{ $index + 1 }})">
                    <div class="relative mb-8">
                        <div id="step-box-{{ $index + 1 }}" class="w-24 h-24 {{ $step['color'] }} rounded-3xl flex items-center justify-center shadow-xl transition-all duration-500 transform rotate-3 group-hover:rotate-0 group-hover:-translate-y-2 group-active:scale-95">
                            <svg class="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="{{ $step['icon'] }}" />
                            </svg>
                        </div>
                        <div class="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-full flex items-center justify-center text-sm font-poppins font-black text-slate-900 shadow-lg border-4 border-slate-50">
                            {{ $step['num'] }}
                        </div>
                    </div>
                    <div class="px-4">
                        <h3 class="text-slate-900 font-bold text-xl mb-3 group-hover:text-[#0056D2] transition-colors">{{ $step['title'] }}</h3>
                        <p class="text-slate-500 text-sm leading-relaxed">{{ $step['desc'] }}</p>
                    </div>
                </div>
                @endforeach
            </div>

            <div class="lg:hidden space-y-12">
                @foreach($steps as $index => $step)
                <div class="flex items-start gap-6 px-4">
                    <div class="flex-shrink-0 w-16 h-16 {{ $step['color'] }} rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="{{ $step['icon'] }}" />
                        </svg>
                    </div>
                    <div>
                        <span class="text-[#0056D2] font-poppins font-bold text-xs uppercase tracking-widest">Langkah {{ $step['num'] }}</span>
                        <h3 class="text-slate-900 font-poppins font-bold text-lg mb-1">{{ $step['title'] }}</h3>
                        <p class="text-slate-500 font-poppins text-sm">{{ $step['desc'] }}</p>
                    </div>
                </div>
                @endforeach
            </div>
        </div>
    </div>
</section>

<script>
    function handleStepClick(id) {
        // Efek Visual pada Box
        const box = document.getElementById(`step-box-${id}`);
        box.classList.add('ring-4', 'ring-blue-400', 'ring-offset-4');

        // Aktifkan Garis Berikutnya
        const line = document.getElementById(`line-${id}`);
        if (line) {
            line.style.strokeDashoffset = "0";
            line.classList.remove('opacity-10');
            line.classList.add('opacity-100');
            // Tambahkan efek glow tipis melalui inline style agar lebih manis
            line.style.filter = "drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))";
        }
    }
</script>
