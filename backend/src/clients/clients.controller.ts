import { Controller, Post, Body, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { IsString, MinLength, IsEnum, IsOptional } from 'class-validator';

class CreateClientDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  phone: string; // +992987654321

  @IsEnum(['web', 'mobile'])
  channel: 'web' | 'mobile';

  @IsOptional()
  @IsEnum(['ru', 'tj', 'en'])
  language?: 'ru' | 'tj' | 'en';

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  account_id?: string;

  @IsOptional()
  @IsString()
  contract?: string;

  @IsOptional()
  @IsString()
  personal_account?: string;
}

@Controller('api/clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  async create(@Body() dto: CreateClientDto) {
    return await this.clientsService.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.clientsService.findById(id);
  }

  @Get('phone/:phone')
  async findByPhone(@Param('phone') phone: string) {
    return await this.clientsService.findByPhone(phone);
  }
}

