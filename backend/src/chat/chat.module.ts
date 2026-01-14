import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ClientsModule } from '../clients/clients.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { BotModule } from '../bot/bot.module';
import { RoutingModule } from '../routing/routing.module';
import { OperatorsModule } from '../operators/operators.module';

@Module({
  imports: [
    ClientsModule,
    ConversationsModule,
    MessagesModule,
    BotModule,
    RoutingModule,
    OperatorsModule,
  ],
  controllers: [ChatController],
  providers: [ChatGateway],
})
export class ChatModule {}

