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
  Req,
  BadRequestException,
  InternalServerErrorException,
  Query,
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

  // КРИТИЧЕСКИ ВАЖНО: Специфичные маршруты должны быть ПЕРЕД параметризованными маршрутами (:id)
  // Иначе NestJS будет пытаться обработать "statistics" как :id
  @Get('statistics')
  @UseGuards(JwtAuthGuard)
  async getStatistics(@Request() req: any) {
    const user = req.user;
    if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
      throw new BadRequestException('Supervisor or Admin role required.');
    }

    // Получаем query параметры
    const query = req.query || {};
    
    // Обрабатываем массивы в query параметрах
    const getFirst = (v: any) => Array.isArray(v) ? v[0] : v;
    
    const startDateStr = query.startDate ? String(getFirst(query.startDate)).trim() : undefined;
    const endDateStr = query.endDate ? String(getFirst(query.endDate)).trim() : undefined;

    // Парсинг дат
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

      // Парсим даты напрямую из строки YYYY-MM-DD (без проблем с UTC/Local)
      const [sy, sm, sd] = startDateStr.split('-').map(Number);
      const [ey, em, ed] = endDateStr.split('-').map(Number);

      startDate = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
      endDate = new Date(ey, em - 1, ed, 23, 59, 59, 999);

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
    } catch (error: any) {
      console.error('getStatistics error:', {
        message: error?.message,
        stack: error?.stack,
        startDate,
        endDate,
      });
      // Ошибки БД, TypeORM, SQL, timeout, permission - это 500, а не 400
      throw new InternalServerErrorException(`Failed to get statistics: ${error?.message || 'unknown error'}`);
    }
  }

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
  async findOne(@Param('id') id: string) {
    console.log('⚠️ [OperatorsController] findOne called with id:', id);
    // Если это "statistics", значит маршрут не сработал - это ошибка конфигурации
    if (id === 'statistics') {
      console.error('[CRITICAL] Statistics route is being matched by :id route! This should not happen!');
      throw new BadRequestException('Statistics endpoint routing error - contact administrator');
    }
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      throw new BadRequestException(`Invalid id: ${id}. Expected a number.`);
    }
    return await this.operatorsService.findById(numId);
  }

  // Специфичные маршруты должны быть выше общего :id
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: OperatorStatus,
  ) {
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      throw new BadRequestException(`Invalid id: ${id}. Expected a number.`);
    }
    return await this.operatorsService.updateStatus(numId, status);
  }

  @Get(':id/active-chats-count')
  @UseGuards(JwtAuthGuard)
  async getActiveChatsCount(@Param('id') id: string) {
    console.log('🔵 [getActiveChatsCount] called with id:', id);
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      throw new BadRequestException(`Invalid id: ${id}. Expected a number.`);
    }
    const count = await this.operatorsService.getActiveChatsCount(numId);
    return { count };
  }

  @Post(':id/queues/:queueId')
  @UseGuards(JwtAuthGuard)
  async addToQueue(
    @Param('id') operatorIdStr: string,
    @Param('queueId') queueIdStr: string,
    @Body('priority') priority?: number,
  ) {
    const operatorId = parseInt(operatorIdStr, 10);
    const queueId = parseInt(queueIdStr, 10);
    if (isNaN(operatorId) || isNaN(queueId)) {
      throw new BadRequestException(`Invalid id or queueId. Expected numbers.`);
    }
    await this.operatorsService.addToQueue(operatorId, queueId, priority || 0);
    return { success: true };
  }

  @Post(':id/queues/:queueId/remove')
  @UseGuards(JwtAuthGuard)
  async removeFromQueue(
    @Param('id') operatorIdStr: string,
    @Param('queueId') queueIdStr: string,
    @Request() req?: any,
  ) {
    const user = req?.user;
    if (user && (user.role === 'admin' || user.role === 'supervisor')) {
      const operatorId = parseInt(operatorIdStr, 10);
      const queueId = parseInt(queueIdStr, 10);
      if (isNaN(operatorId) || isNaN(queueId)) {
        throw new BadRequestException(`Invalid id or queueId. Expected numbers.`);
      }
      await this.operatorsService.removeFromQueue(operatorId, queueId);
      return { success: true };
    }
    throw new BadRequestException('Access denied. Supervisor or Admin role required.');
  }

  // Общий маршрут обновления должен быть последним
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() data: UpdateOperatorDto,
    @Request() req?: any,
  ) {
    const user = req?.user;
    if (!user || user.role !== 'admin') {
      throw new BadRequestException('Access denied. Admin role required.');
    }
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      throw new BadRequestException(`Invalid id: ${id}. Expected a number.`);
    }
    return await this.operatorsService.update(numId, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string, @Request() req?: any) {
    const user = req?.user;
    if (user && user.role === 'admin') {
      const numId = parseInt(id, 10);
      if (isNaN(numId)) {
        throw new BadRequestException(`Invalid id: ${id}. Expected a number.`);
      }
      await this.operatorsService.delete(numId);
      return { success: true };
    }
    throw new BadRequestException('Access denied. Admin role required.');
  }
}

