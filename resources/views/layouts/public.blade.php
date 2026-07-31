<!DOCTYPE html>
<html lang="id" class="scroll-smooth">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="SynapEd – Platform pembelajaran online multi-disiplin. Belajar berbagai bidang ilmu secara terstruktur dan aplikatif." />
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', 'SynapEd – Platform Pembelajaran Online Terlengkap')</title>

    <link rel="icon" type="image/png" href="{{ asset('images/logo.png') }}" />

    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

    @vite(['resources/css/app.css', 'resources/js/app.js'])

    @stack('head')
</head>
<body class="antialiased font-sans na-public-body @yield('body-class')">

    @include('components.sections.navbar')

    <main>
        @yield('content')
    </main>

    @include('components.sections.footer')

    @stack('scripts')
</body>
</html>
