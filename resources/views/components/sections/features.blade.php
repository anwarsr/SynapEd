<section id="features" class="relative py-24 bg-slate-50 overflow-hidden" style="font-family: 'Poppins', sans-serif;">
    <div class="relative max-w-6xl mx-auto px-6">
        <div class="text-center mb-20">
            <h2 class="text-4xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight leading-tight">
                Keunggulan yang Membuat
            </h2>
            <span id="typing-target" class="text-4xl md:text-5xl font-bold text-blue-600 border-r-4 border-blue-600 pr-1 tracking-tight leading-tight"></span>
            <p class="max-w-2xl mx-auto text-lg text-slate-600 leading-relaxed">
                SynapEd menghadirkan pembelajaran dari berbagai bidang ilmu secara sistematis. Materi dirancang agar mudah dipahami oleh pelajar dan pemula tanpa memerlukan latar belakang khusus.
            </p>
        </div>

        <div class="flex flex-col gap-8 max-w-3xl mx-auto">
            @php
                $features = [
                    ['title' => 'Kurikulum Terverifikasi', 'desc' => 'Materi dikurasi oleh para ahli dan praktisi berpengalaman di bidangnya.'],
                    ['title' => 'Video Berkualitas', 'desc' => 'Video rekaman & animasi terstruktur yang sangat mudah dipahami.'],
                    ['title' => 'Modul PDF Lengkap', 'desc' => 'Ringkasan PDF yang dapat diunduh untuk mendukung belajar secara offline.'],
                    ['title' => 'Studi Kasus Praktis', 'desc' => 'Studi kasus nyata dan panduan praktik untuk melatih skill secara langsung.'],
                    ['title' => 'Akses Fleksibel', 'desc' => 'Responsif di laptop, tablet, atau smartphone. Belajar di mana saja.'],
                    ['title' => 'Berbasis Riset', 'desc' => 'Kurikulum disusun berdasarkan standar riset teknologi terbaru.']
                ];
            @endphp

            @foreach($features as $index => $feature)
            <div class="feature-item group flex items-start gap-8 p-6 duration-500 opacity-0 translate-y-8">
                <div class="flex-shrink-0 w-12 h-12 flex items-center justify-center border-2 border-blue-100 text-blue-600 rounded-full text-xl font-bold group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all duration-300">
                    {{ str_pad($index + 1, 2, '0', STR_PAD_LEFT) }}
                </div>

                <div class="pt-1">
                    <h3 class="text-xl font-bold text-slate-900 typing-text-item" data-text="{{ $feature['title'] }}"></h3>
                    <p class="text-slate-500 text-sm leading-relaxed desc-text opacity-0 transition-opacity duration-700">
                        {{ $feature['desc'] }}
                    </p>
                </div>
            </div>
            @endforeach
        </div>
    </div>
</section>

<script>
    // 1. Headline Typing Effect
    const mainText = "Belajar Lebih Efektif";
    const mainTarget = document.getElementById("typing-target");
    let mainIndex = 0;

    function typeWriterMain() {
        if (mainIndex < mainText.length) {
            mainTarget.innerHTML += mainText.charAt(mainIndex);
            mainIndex++;
            setTimeout(typeWriterMain, 100);
        } else {
            mainTarget.classList.remove('border-r-4');
        }
    }

    // 2. Feature Typing Effect
    function typeEffect(element, speed = 40) {
        const text = element.getAttribute('data-text');
        let j = 0;
        element.innerHTML = "";

        function typing() {
            if (j < text.length) {
                element.innerHTML += text.charAt(j);
                j++;
                setTimeout(typing, speed);
            } else {
                element.nextElementSibling.classList.remove('opacity-0');
            }
        }
        typing();
    }

    const observerOptions = {
        threshold: 0.15
    };

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (entry.target.id === 'features') {
                    typeWriterMain();
                }

                if (entry.target.classList.contains('feature-item')) {
                    const item = entry.target;
                    const titleElement = item.querySelector('.typing-text-item');

                    // Reveal Container
                    item.classList.remove('opacity-0', 'translate-y-8');
                    item.classList.add('opacity-100', 'translate-y-0');

                    // Start Typing
                    setTimeout(() => {
                        typeEffect(titleElement);
                    }, 400);

                    sectionObserver.unobserve(item);
                }
            }
        });
    }, observerOptions);

    sectionObserver.observe(document.getElementById('features'));
    document.querySelectorAll('.feature-item').forEach(item => {
        sectionObserver.observe(item);
    });
</script>
