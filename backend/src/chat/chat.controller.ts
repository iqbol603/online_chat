import { Controller, Post, Body, Get, Param, ParseIntPipe } from '@nestjs/common';
import { IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ClientsService } from '../clients/clients.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';
import { BotService } from '../bot/bot.service';

class StartChatDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  phone: string;

  @IsEnum(['web', 'mobile'])
  channel: 'web' | 'mobile';

  @IsOptional()
  @IsEnum(['ru', 'tj'])
  language?: 'ru' | 'tj';

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

@Controller('api/chat')
export class ChatController {
  constructor(
    private clientsService: ClientsService,
    private conversationsService: ConversationsService,
    private messagesService: MessagesService,
    private botService: BotService,
  ) {}

  @Post('start')
  async startChat(@Body() dto: StartChatDto) {
    // Создаем или находим клиента
    const client = await this.clientsService.create(dto);

    // Проверяем, есть ли активный диалог
    let conversation = await this.conversationsService.findActiveByClient(client.client_id);

    if (!conversation) {
      // Создаем новый диалог
      conversation = await this.conversationsService.create({
        client_id: client.client_id,
        department: dto.channel === 'web' ? 'web' : 'mobile',
      });

      // Отправляем приветственное сообщение от бота
      const welcomeMessage = client.language === 'ru'
        ? `Здравствуйте, ${client.name}! Я виртуальный помощник. Чем могу помочь?`
        : `Салом, ${client.name}! Ман кӯмакчии виртуалӣ ҳастам. Чӣ тавр кӯмак карда метавонам?`;

      await this.botService.sendBotMessage(conversation.conversation_id, welcomeMessage, [
        client.language === 'ru' ? 'Интернет не работает' : 'Интернет кор намекунад',
        client.language === 'ru' ? 'Оплата' : 'Пардохт',
        client.language === 'ru' ? 'Тарифы' : 'Тарифҳо',
        client.language === 'ru' ? 'Соединить с оператором' : 'Ба оператор пайваст кардан',
      ]);
    }

    // Получаем историю сообщений
    const messages = await this.messagesService.findByConversation(conversation.conversation_id);

    return {
      client,
      conversation,
      messages,
    };
  }

  @Get('conversation/:conversationId')
  async getConversation(@Param('conversationId', ParseIntPipe) conversationId: number) {
    const conversation = await this.conversationsService.findById(conversationId);
    const messages = await this.messagesService.findByConversation(conversationId);
    return {
      conversation,
      messages,
    };
  }

  @Get('client/:clientId/active')
  async getActiveConversation(@Param('clientId', ParseIntPipe) clientId: number) {
    const conversation = await this.conversationsService.findActiveByClient(clientId);
    if (!conversation) {
      return { conversation: null, messages: [] };
    }
    const messages = await this.messagesService.findByConversation(conversation.conversation_id);
    return {
      conversation,
      messages,
    };
  }
}

