import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Anwar Saipul Rohmi' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'anwar@example.com' })
  @IsEmail({}, { message: 'Format email tidak valid.' })
  @MaxLength(180)
  email!: string;

  @ApiProperty({ example: 'rahasia123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Kata sandi minimal 8 karakter.' })
  @MaxLength(72, { message: 'Kata sandi maksimal 72 karakter.' })
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'anwar@example.com' })
  @IsEmail({}, { message: 'Format email tidak valid.' })
  email!: string;

  @ApiProperty({ example: 'rahasia123' })
  @IsString()
  @MinLength(1, { message: 'Kata sandi wajib diisi.' })
  password!: string;
}
