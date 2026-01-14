import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { MessagesModule } from '../messages/messages.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [MessagesModule, ConversationsModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}

