import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockedClient } from '../entities/blocked-client.entity';
import { BlockedClientsService } from './blocked-clients.service';
import { BlockedClientsController } from './blocked-clients.controller';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [TypeOrmModule.forFeature([BlockedClient]), ClientsModule],
  providers: [BlockedClientsService],
  controllers: [BlockedClientsController],
  exports: [BlockedClientsService],
})
export class BlockedClientsModule {}
