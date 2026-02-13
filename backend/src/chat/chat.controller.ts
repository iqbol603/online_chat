import { Controller, Post, Body, Get, Param, ParseIntPipe, ForbiddenException } from '@nestjs/common';
import { IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ClientsService } from '../clients/clients.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';
import { BotService } from '../bot/bot.service';
import { BlockedClientsService } from '../blocked-clients/blocked-clients.service';

class StartChatDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  phone: string;

  @IsEnum(['web', 'mobile'])
  channel: 'web' | 'mobile';

  @IsOptional()
  @IsEnum(['ru', 'tj', 'en'], {
    message: 'language must be one of the following values: ru, tj, en',
  })
  language?: 'ru' | 'tj' | 'en';

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
    private blockedClientsService: BlockedClientsService,
  ) {}

  @Post('start')
  async startChat(@Body() dto: StartChatDto) {
    // Проверяем, не заблокирован ли клиент
    const isBlocked = await this.blockedClientsService.isBlocked(dto.phone);
    if (isBlocked) {
      throw new ForbiddenException('Access denied. Your phone number is blocked.');
    }

    // Валидируем и нормализуем язык
    const validLanguages = ['ru', 'tj', 'en'] as const;
    const normalizedLanguage = dto.language && validLanguages.includes(dto.language as any)
      ? dto.language
      : 'ru';

    // Создаем или находим клиента (обновляем язык, если передан)
    const client = await this.clientsService.create({
      ...dto,
      language: normalizedLanguage, // Используем нормализованный язык
    });

    // Перезагружаем клиента, чтобы получить актуальный язык
    const updatedClient = await this.clientsService.findById(client.client_id);
    const clientLanguage = updatedClient.language || normalizedLanguage;

    // Проверяем, есть ли активный диалог
    let conversation = await this.conversationsService.findActiveByClient(updatedClient.client_id);

    if (!conversation) {
      // Создаем новый диалог
      conversation = await this.conversationsService.create({
        client_id: updatedClient.client_id,
        department: dto.channel === 'web' ? 'web' : 'mobile',
      });

      // Отправляем приветственное сообщение от бота
      const welcomeMessage = clientLanguage === 'ru'
        ? `Здравствуйте, ${updatedClient.name}! Я виртуальный помощник. Чем могу вам помочь?`
        : clientLanguage === 'tj'
        ? `Салом, ${updatedClient.name}! Ман кӯмакчии виртуалӣ ҳастам. Чӣ тавр кӯмак карда метавонам?`
        : `Hello, ${updatedClient.name}! I'm a virtual assistant. How can I help you?`;

      // Первые варианты для уточнения темы обращения (без привязки к технологии)
      await this.botService.sendBotMessage(conversation.conversation_id, welcomeMessage, [
        clientLanguage === 'ru' ? 'Интернет не работает' : clientLanguage === 'tj' ? 'Интернет кор намекунад' : 'Internet not working',
        clientLanguage === 'ru' ? 'Медленный интернет' : clientLanguage === 'tj' ? 'Интернети суст' : 'Slow internet',
        clientLanguage === 'ru' ? 'Оплата' : clientLanguage === 'tj' ? 'Пардохт' : 'Payment',
        clientLanguage === 'ru' ? 'Тарифы' : clientLanguage === 'tj' ? 'Тарифҳо' : 'Tariffs',
        clientLanguage === 'ru' ? 'Соединить с оператором' : clientLanguage === 'tj' ? 'Ба оператор пайваст кардан' : 'Connect to operator',
      ]);
    }

    // Получаем историю сообщений
    const messages = await this.messagesService.findByConversation(conversation.conversation_id);

    return {
      client: updatedClient,
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

