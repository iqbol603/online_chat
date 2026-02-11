import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Query,
  Patch,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { IsEnum, IsOptional, IsInt, IsString, Min, Max, MaxLength } from 'class-validator';
import { ConversationStatus, ConversationPriority } from '../entities/conversation.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class CreateConversationDto {
  @IsInt()
  client_id: number;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsInt()
  queue_id?: number;

  @IsOptional()
  @IsEnum(['low', 'normal', 'high', 'critical'])
  priority?: ConversationPriority;
}

class SetConversationRatingDto {
  @IsInt()
  client_id: number;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

@Controller('api/conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  async create(@Body() dto: CreateConversationDto) {
    return await this.conversationsService.create(dto);
  }

  @Get('operator/:operatorId/archived')
  @UseGuards(JwtAuthGuard)
  async findArchivedByOperator(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @Query('date') date: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('includeAssigned') includeAssigned?: string,
    @Query('includeClosedBy') includeClosedBy?: string,
    @Request() req?: any,
  ) {
    const user = req?.user;
    if (!user || (user.role !== 'admin' && user.role !== 'supervisor')) {
      throw new ForbiddenException('Access denied. Admin or Supervisor role required.');
    }

    const effectiveStart = startDate || date;
    const effectiveEnd = endDate || date;

    if (!effectiveStart || !effectiveEnd) {
      throw new BadRequestException(
        'startDate and endDate are required (format: YYYY-MM-DD)',
      );
    }

    const parseBool = (v?: string) =>
      v === undefined ? undefined : v === 'true' || v === '1';
    const incAssigned = parseBool(includeAssigned) ?? true;
    const incClosedBy = parseBool(includeClosedBy) ?? true;

    return await this.conversationsService.findArchivedByOperator(
      operatorId,
      effectiveStart,
      effectiveEnd,
      incAssigned,
      incClosedBy,
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.conversationsService.findById(id);
  }

  @Get('client/:clientId')
  async findByClient(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Query('status') status?: ConversationStatus,
  ) {
    return await this.conversationsService.findByClient(clientId, status);
  }

  @Get('status/:status')
  @UseGuards(JwtAuthGuard)
  async findByStatus(
    @Param('status') status: ConversationStatus,
    @Query('queueId') queueId?: number,
    @Request() req?: any,
  ) {
    // Operator видит только свои, Supervisor/Admin - все
    const user = req?.user;
    if (user && (user.role === 'supervisor' || user.role === 'admin')) {
      return await this.conversationsService.findAll(status);
    }
    return await this.conversationsService.findByStatus(status, queueId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query('status') status?: ConversationStatus, @Request() req?: any) {
    const user = req?.user;
    if (user && (user.role === 'supervisor' || user.role === 'admin')) {
      return await this.conversationsService.findAll(status);
    }
    throw new Error('Access denied. Supervisor or Admin role required.');
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: ConversationStatus,
    @Body('operatorId') operatorId?: number,
  ) {
    return await this.conversationsService.updateStatus(id, status, operatorId);
  }

  @Patch(':id/assign')
  async assignOperator(
    @Param('id', ParseIntPipe) id: number,
    @Body('operatorId', ParseIntPipe) operatorId: number,
  ) {
    return await this.conversationsService.assignOperator(id, operatorId);
  }

  @Patch(':id/close')
  async close(@Param('id', ParseIntPipe) id: number) {
    return await this.conversationsService.close(id);
  }

  @Post(':id/tags')
  async addTag(
    @Param('id', ParseIntPipe) id: number,
    @Body('tag') tag: string,
  ) {
    return await this.conversationsService.addTag(id, tag);
  }

  @Post(':id/rating')
  async setRating(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetConversationRatingDto,
  ) {
    return await this.conversationsService.setRating(id, dto.client_id, dto.rating, dto.comment);
  }

  @Patch(':id/reassign')
  @UseGuards(JwtAuthGuard)
  async reassign(
    @Param('id', ParseIntPipe) id: number,
    @Body('operatorId', ParseIntPipe) operatorId: number,
    @Request() req?: any,
  ) {
    const user = req?.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Admin / Supervisor могут переназначать любой диалог
    if (user.role === 'supervisor' || user.role === 'admin') {
      return await this.conversationsService.reassign(id, operatorId);
    }

    // Обычный оператор может переназначать только свои диалоги
    if (user.role === 'operator') {
      const conversation = await this.conversationsService.findById(id);
      if (conversation.assigned_operator_id !== user.operator_id) {
        throw new ForbiddenException('You can only reassign conversations assigned to you');
      }
      return await this.conversationsService.reassign(id, operatorId);
    }

    throw new ForbiddenException('Access denied');
  }

}

