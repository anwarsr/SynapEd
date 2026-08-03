import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Anwar Saipul Rohmi' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'anwar@example.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid.' })
  @MaxLength(180)
  email?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'sandiLama123' })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ example: 'sandiBaru123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Kata sandi baru minimal 8 karakter.' })
  @MaxLength(72)
  newPassword!: string;
}

export class DeleteAccountDto {
  @ApiProperty({ example: 'sandiSaya123' })
  @IsString()
  password!: string;
}
