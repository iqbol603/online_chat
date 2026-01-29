import { Module, forwardRef } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { OperatorsModule } from '../operators/operators.module';
import { QueuesModule } from '../queues/queues.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [
    OperatorsModule,
    QueuesModule,
    forwardRef(() => ConversationsModule), // Используем forwardRef для разрыва циклической зависимости
  ],
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}

