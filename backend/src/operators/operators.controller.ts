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
  Query,
  BadRequestException,
} from '@nestjs/common';
import { OperatorsService } from './operators.service';
import { IsEmail, IsString, MinLength, IsEnum, IsInt, IsOptional, IsDateString } from 'class-validator';
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
    throw new BadRequestException('Access denied. Admin role required.');
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Request() req?: any) {
    const user = req?.user;
    if (user && (user.role === 'admin' || user.role === 'supervisor')) {
      return await this.operatorsService.findAll();
    }
    throw new BadRequestException('Access denied. Supervisor or Admin role required.');
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
    throw new BadRequestException('Access denied. Supervisor or Admin role required.');
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
      throw new BadRequestException('Access denied. Admin role required.');
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
    throw new BadRequestException('Access denied. Admin role required.');
  }

  @Get('statistics')
  @UseGuards(JwtAuthGuard)
  async getStatistics(
    @Query('startDate') startDateStr?: string,
    @Query('endDate') endDateStr?: string,
    @Request() req?: any,
  ) {
    const user = req?.user;
    if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
      throw new BadRequestException('Access denied. Supervisor or Admin role required.');
    }

    // По умолчанию - текущий месяц
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (startDateStr && endDateStr) {
      // Проверка формата даты (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDateStr)) {
        throw new BadRequestException('Invalid startDate format. Expected format: YYYY-MM-DD');
      }
      if (!dateRegex.test(endDateStr)) {
        throw new BadRequestException('Invalid endDate format. Expected format: YYYY-MM-DD');
      }

      // Валидация дат
      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);

      // Проверка валидности дат
      if (isNaN(startDate.getTime())) {
        throw new BadRequestException('Invalid startDate. Please provide a valid date.');
      }
      if (isNaN(endDate.getTime())) {
        throw new BadRequestException('Invalid endDate. Please provide a valid date.');
      }

      // Проверка, что startDate <= endDate
      if (startDate > endDate) {
        throw new BadRequestException('startDate must be less than or equal to endDate');
      }

      // Устанавливаем время на начало дня для startDate
      startDate.setHours(0, 0, 0, 0);
      // Устанавливаем время на конец дня для endDate
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Текущий месяц
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    try {
      const statistics = await this.operatorsService.getStatistics(startDate, endDate);
      return {
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        statistics,
      };
    } catch (error) {
      throw new BadRequestException(`Error getting statistics: ${error.message}`);
    }
  }
}

