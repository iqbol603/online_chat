import { Module, forwardRef } from '@nestjs/common';
import { BotService } from './bot.service';
import { MessagesModule } from '../messages/messages.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [
    forwardRef(() => MessagesModule), // Используем forwardRef для разрыва циклической зависимости
    forwardRef(() => ConversationsModule), // Используем forwardRef для разрыва циклической зависимости
  ],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}

