import { Controller, Get, Post, Body, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { QueuesService } from './queues.service';
import { IsString, IsEnum, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class CreateQueueDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsEnum(['round-robin', 'least-active', 'skill-based'])
  routing_mode?: 'round-robin' | 'least-active' | 'skill-based';
}

@Controller('api/queues')
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  @Get()
  async findAll() {
    return await this.queuesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.queuesService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateQueueDto) {
    return await this.queuesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id', ParseIntPipe) id: number, @Body() data: Partial<CreateQueueDto>) {
    return await this.queuesService.update(id, data);
  }
}

