import { Body, Controller, Delete, HttpCode, Patch, Put, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChangePasswordDto, DeleteAccountDto, UpdateProfileDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiCookieAuth()
@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch()
  @ApiOperation({ summary: 'Perbarui nama / email' })
  updateProfile(@CurrentUser() user: { id: number }, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Put('password')
  @HttpCode(204)
  @ApiOperation({ summary: 'Ganti kata sandi (mencabut semua sesi lain)' })
  async changePassword(
    @CurrentUser() user: { id: number },
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.users.changePassword(user.id, dto);
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Hapus akun secara permanen' })
  async deleteAccount(
    @CurrentUser() user: { id: number },
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.users.deleteAccount(user.id, dto, res);
  }
}
