import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperatorsController } from './operators.controller';
import { OperatorsService } from './operators.service';
import { Operator } from '../entities/operator.entity';
import { OperatorQueue } from '../entities/operator-queue.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Operator, OperatorQueue])],
  controllers: [OperatorsController],
  providers: [OperatorsService],
  exports: [OperatorsService],
})
export class OperatorsModule {}

