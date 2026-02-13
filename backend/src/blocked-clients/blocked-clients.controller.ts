import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BlockedClientsService } from './blocked-clients.service';
import { IsString, IsOptional } from 'class-validator';

class BlockClientDto {
  @IsString()
  phone: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  clientName?: string;
}

@Controller('api/blocked-clients')
@UseGuards(JwtAuthGuard)
export class BlockedClientsController {
  constructor(private readonly blockedClientsService: BlockedClientsService) {}

  @Get()
  async findAll(@Request() req: any) {
    const user = req?.user;
    if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
      throw new BadRequestException('Access denied. Admin or Supervisor role required.');
    }
    return await this.blockedClientsService.findAll();
  }

  @Post('block')
  async block(@Body() dto: BlockClientDto, @Request() req: any) {
    const user = req?.user;
    if (!user) {
      throw new BadRequestException('Authentication required.');
    }
    if (!dto.phone) {
      throw new BadRequestException('Phone number is required.');
    }
    return await this.blockedClientsService.block(
      dto.phone,
      dto.reason || 'Заблокирован оператором',
      user.operator_id || user.sub,
      dto.clientName,
    );
  }

  @Delete('unblock/:phone')
  async unblock(@Param('phone') phone: string, @Request() req: any) {
    const user = req?.user;
    if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
      throw new BadRequestException('Access denied. Admin or Supervisor role required.');
    }
    await this.blockedClientsService.unblock(phone);
    return { success: true, message: 'Client unblocked' };
  }

  @Get('check/:phone')
  async check(@Param('phone') phone: string) {
    const isBlocked = await this.blockedClientsService.isBlocked(phone);
    return { isBlocked };
  }
}
