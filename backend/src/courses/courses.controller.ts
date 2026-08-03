import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CoursesService } from './courses.service';

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar kursus, opsional disaring per kategori' })
  @ApiQuery({ name: 'category', required: false, example: 'eeg' })
  findAll(@Query('category') category?: string) {
    return this.courses.findAll(category);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Kategori untuk tombol filter' })
  categories() {
    return this.courses.categories();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Detail satu kursus beserta section & lesson' })
  findOne(@Param('slug') slug: string) {
    return this.courses.findBySlug(slug);
  }

  @Get(':slug/lessons/:lessonSlug')
  @ApiOperation({ summary: 'Satu pelajaran beserta navigasi sebelum/sesudah' })
  findLesson(@Param('slug') slug: string, @Param('lessonSlug') lessonSlug: string) {
    return this.courses.findLesson(slug, lessonSlug);
  }
}
