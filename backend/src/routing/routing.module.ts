import { Module } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { OperatorsModule } from '../operators/operators.module';
import { QueuesModule } from '../queues/queues.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [OperatorsModule, QueuesModule, ConversationsModule],
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}

