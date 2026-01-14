import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
  Delete,
  Request,
} from '@nestjs/common';
import { OperatorsService } from './operators.service';
import { IsEmail, IsString, MinLength, IsEnum, IsInt, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OperatorStatus } from '../entities/operator.entity';

class CreateOperatorDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(['operator', 'admin', 'supervisor'])
  role?: 'operator' | 'admin' | 'supervisor';

  @IsOptional()
  @IsInt()
  max_active_chats?: number;
}

class UpdateOperatorDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(['operator', 'admin', 'supervisor'])
  role?: 'operator' | 'admin' | 'supervisor';

  @IsOptional()
  @IsInt()
  max_active_chats?: number;
}

@Controller('api/operators')
export class OperatorsController {
  constructor(private readonly operatorsService: OperatorsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateOperatorDto, @Request() req?: any) {
    const user = req?.user;
    if (user && user.role === 'admin') {
      return await this.operatorsService.create(dto);
    }
    throw new Error('Access denied. Admin role required.');
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Request() req?: any) {
    const user = req?.user;
    if (user && (user.role === 'admin' || user.role === 'supervisor')) {
      return await this.operatorsService.findAll();
    }
    throw new Error('Access denied. Supervisor or Admin role required.');
  }

  @Get('online')
  async findOnline() {
    return await this.operatorsService.findOnline();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.operatorsService.findById(id);
  }

  // Специфичные маршруты должны быть выше общего :id
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: OperatorStatus,
  ) {
    return await this.operatorsService.updateStatus(id, status);
  }

  @Get(':id/active-chats-count')
  @UseGuards(JwtAuthGuard)
  async getActiveChatsCount(@Param('id', ParseIntPipe) id: number) {
    const count = await this.operatorsService.getActiveChatsCount(id);
    return { count };
  }

  @Post(':id/queues/:queueId')
  @UseGuards(JwtAuthGuard)
  async addToQueue(
    @Param('id', ParseIntPipe) operatorId: number,
    @Param('queueId', ParseIntPipe) queueId: number,
    @Body('priority') priority?: number,
  ) {
    await this.operatorsService.addToQueue(operatorId, queueId, priority || 0);
    return { success: true };
  }

  @Post(':id/queues/:queueId/remove')
  @UseGuards(JwtAuthGuard)
  async removeFromQueue(
    @Param('id', ParseIntPipe) operatorId: number,
    @Param('queueId', ParseIntPipe) queueId: number,
    @Request() req?: any,
  ) {
    const user = req?.user;
    if (user && (user.role === 'admin' || user.role === 'supervisor')) {
      await this.operatorsService.removeFromQueue(operatorId, queueId);
      return { success: true };
    }
    throw new Error('Access denied. Supervisor or Admin role required.');
  }

  // Общий маршрут обновления должен быть последним
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateOperatorDto,
    @Request() req?: any,
  ) {
    const user = req?.user;
    if (!user || user.role !== 'admin') {
      throw new Error('Access denied. Admin role required.');
    }
    return await this.operatorsService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id', ParseIntPipe) id: number, @Request() req?: any) {
    const user = req?.user;
    if (user && user.role === 'admin') {
      await this.operatorsService.delete(id);
      return { success: true };
    }
    throw new Error('Access denied. Admin role required.');
  }
}

