@extends('layouts.public')

@section('title', 'SynapEd – Platform Pembelajaran Online Terlengkap')

@section('content')

    {{-- Hero Section --}}
    @include('components.sections.hero') {{-- selesai --}}

    {{-- Stats / Metrics Section --}}
    @include('components.sections.stats') {{-- selesai --}}

    {{-- About Section --}}
    @include('components.sections.about') {{-- selesai --}}

    {{-- Value Proposition Section --}}
    @include('components.sections.value-proposition') {{-- selesai --}}

    {{-- Courses Section (with category filter) --}}
    @include('components.sections.courses') {{-- hampir selesai --}}

    {{-- Features / Keunggulan Section --}}
    @include('components.sections.features')

    {{-- Learning Path / Alur Belajar --}}
    @include('components.sections.learning-path') {{-- selesai-}}

    {{-- Testimonials Section --}}
    @include('components.sections.testimonials') {{-- selesai, tinggal sesuaikan data testimonial di HomeController --}}

    {{-- FAQ Section --}}
    @include('components.sections.faq') {{-- selesai--}}

@endsection
