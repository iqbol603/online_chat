import { Module, forwardRef } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ClientsModule } from '../clients/clients.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { BotModule } from '../bot/bot.module';
import { RoutingModule } from '../routing/routing.module';
import { OperatorsModule } from '../operators/operators.module';
import { BlockedClientsModule } from '../blocked-clients/blocked-clients.module';

@Module({
  imports: [
    ClientsModule,
    forwardRef(() => ConversationsModule), // Используем forwardRef для разрыва циклической зависимости
    forwardRef(() => MessagesModule), // Используем forwardRef для разрыва циклической зависимости
    BotModule,
    RoutingModule,
    OperatorsModule,
    BlockedClientsModule,
  ],
  controllers: [ChatController],
  providers: [ChatGateway],
  exports: [ChatGateway], // Экспортируем ChatGateway для использования в других модулях
})
export class ChatModule {}

