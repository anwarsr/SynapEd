<section id="courses" class="relative py-28 overflow-hidden bg-white font-sans">
    <div class="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

    <div class="relative max-w-7xl mx-auto px-6">

        <div class="text-center mb-16">
            <h2 class="text-3xl sm:text-4xl lg:text-5xl font-poppins font-bold text-slate-900 leading-tight">
                Materi
                <span class="bg-clip-text text-[#0056D2] ">Pembelajaran</span>
            </h2>
            <p class="text-black font-poppins text-lg mt-4 max-w-2xl mx-auto">Berbagai modul terstruktur dari level dasar hingga lanjutan, dirancang untuk pengalaman belajar yang optimal.</p>
        </div>

            <div class="flex flex-wrap justify-center gap-3 mb-12">
                @foreach($courseCategories as $cat)
                <button
                    data-filter="{{ $cat['slug'] }}"
                    class="course-filter-btn px-6 py-2.5 rounded-full text-sm font-poppins font-semibold transition-all duration-300 border shadow-sm
                    {{ $loop->first
                        ? 'bg-[#0056D2] text-white active-filter'
                        : 'bg-white  text-black hover:text-white hover:bg-[#0056D2]' }}">
                    {{ $cat['label'] }}
                </button>
                @endforeach
            </div>

        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6" id="courses-grid">

            @php
            $iconMap = [
                'brain'   => '<path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />',
                'wave'    => '<path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />',
                'headset' => '<path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />',
                'chart'   => '<path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />',
            ];
            $bgColors = ['bg-orange-50', 'bg-blue-50', 'bg-purple-50', 'bg-emerald-50'];
            @endphp

            @foreach($courses as $index => $course)
            @php
                $iconSvg  = $iconMap[$course['icon']] ?? $iconMap['brain'];
                $cardBg   = $bgColors[$index % count($bgColors)];
            @endphp

            <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden group hover:shadow-xl transition-all duration-300 flex flex-col course-card"
                 data-category="{{ $course['category'] }}">

                <div class="relative h-44 w-full flex justify-center items-end overflow-hidden pt-4 {{ $cardBg }}">

                    <svg class="absolute bottom-0 w-full z-0 opacity-60" viewBox="0 0 400 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M-20 150C-20 150 150 30 420 150" class="stroke-slate-200" stroke-width="40"/>
                        <path d="M20 150C20 150 180 60 380 150" class="stroke-blue-100" stroke-width="20"/>
                        <path d="M60 150C60 150 210 90 340 150" class="stroke-blue-200" stroke-width="60"/>
                        <path d="M120 150C120 150 250 120 400 150" class="stroke-blue-300" stroke-width="30"/>
                    </svg>

                    <img src="https://api.dicebear.com/8.x/notionists/svg?seed={{ urlencode($course['title']) }}&size=150&backgroundColor=transparent"
                         class="relative z-10 h-36 w-auto drop-shadow-md transition-transform duration-500 group-hover:scale-110 object-contain"
                         alt="Course Avatar">
                </div>

                <div class="p-5 flex flex-col flex-1">

                    <h3 class="font-bold text-slate-900 font-poppins text-lg mb-2 leading-snug transition-colors duration-200">
                        {{ $course['title'] }}
                    </h3>

                    <p class="text-slate-500 font-poppins text-sm leading-relaxed mb-6 line-clamp-2">
                        {{ $course['short_desc'] }}
                    </p>

                    <div class="mt-auto space-y-1 mb-5">
                        <div class="text-[13px] text-slate-500">
                            <span class="font-bold font-poppins text-slate-900">{{ $course['lessons_count'] }}</span> modul pelajaran
                        </div>
                        <div class="text-[13px] text-slate-500">
                            <span class="font-bold font-poppins text-slate-900">{{ $course['duration'] }}</span> estimasi durasi
                        </div>
                    </div>

                    <div class="flex items-center justify-between mb-5 pb-5 border-b border-slate-100">
                        <div class="flex items-center gap-1">
                            <span class="text-slate-800 font-poppins font-bold text-sm">{{ $course['rating'] }}</span>
                            <div class="flex gap-0.5">
                                @for($s = 1; $s <= 5; $s++)
                                <svg class="w-3.5 h-3.5 {{ $s <= round($course['rating']) ? 'text-yellow-600' : 'text-slate-200' }}" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 9.101c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                                </svg>
                                @endfor
                            </div>
                            <span class="text-slate-400 font-poppins text-xs ml-1">({{ $course['reviews'] }})</span>
                        </div>
                        <span class="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">
                            {{ $course['level'] }}
                        </span>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                        <a href="{{ route('courses.show', $course['slug']) }}"
                           class="inline-flex items-center justify-center py-2.5 rounded-lg text-xs font-poppins font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-100">
                            Detail
                        </a>

                        @auth
                            <a href="{{ route('learn', $course['slug']) }}"
                               class="inline-flex items-center justify-center py-2.5 rounded-lg text-xs font-poppins font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200">
                                {{ !empty($course['is_enrolled']) ? 'Mulai' : 'Beli' }}
                            </a>
                        @else
                            <a href="{{ route('login') }}" style="color:#ffffff !important;"
                               class="inline-flex items-center justify-center py-2.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200">
                                {{ !empty($course['has_free_preview']) ? 'Preview' : 'Beli' }}
                            </a>
                        @endauth
                    </div>
                </div>
            </div>
            @endforeach

        </div>
    </div>
</section>

@push('scripts')
<script>
(function () {
    const btns  = document.querySelectorAll('.course-filter-btn');
    const cards = document.querySelectorAll('.course-card');

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Reset semua tombol ke status "Tidak Terpilih" (Putih, Teks Hitam)
            btns.forEach(b => {
                b.classList.remove('bg-[#0056D2]', 'border-[#0056D2]', 'text-white', 'active-filter');
                b.classList.add('bg-white', 'border-white', 'text-white', 'hover:bg-slate-50');
            });

            // Set tombol yang diklik ke status "Terpilih" (Biru/Teal, Teks Putih)
            btn.classList.add('bg-[#0056D2]', 'border-[#0056D2]', 'text-white', 'active-filter');
            btn.classList.remove('bg-white', 'border-white', 'text-white', 'hover:bg-slate-50');

            const filter = btn.dataset.filter;

            cards.forEach(card => {
                if (filter === 'semua' || card.dataset.category === filter) {
                    card.classList.remove('hidden');
                    card.classList.add('animate-in', 'fade-in', 'zoom-in-95', 'duration-300');
                } else {
                    card.classList.add('hidden');
                }
            });
        });
    });
})();
</script>
@endpush
