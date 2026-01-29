import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from '../conversations/conversations.service';
import { ClientsService } from '../clients/clients.service';
import { BotService } from '../bot/bot.service';
import { RoutingService } from '../routing/routing.service';
import { OperatorsService } from '../operators/operators.service';

interface ClientSocket extends Socket {
  clientId?: number;
  operatorId?: number;
  conversationId?: number;
}

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      // Разрешаем запросы без origin
      if (!origin) return callback(null, true);
      
      // Разрешаем localhost и локальную сеть
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(origin);
      const isLocalNetwork = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(origin);
      
      // Разрешаем порты 3001 и 3002
      const isAllowedPort = /:300[12]/.test(origin);
      
      // Разрешаем домен сервера wifi.babilon-t.tj
      const isServerDomain = /^https?:\/\/wifi\.babilon-t\.tj/.test(origin);
      
      if ((isLocalhost || isLocalNetwork) && isAllowedPort) {
        return callback(null, true);
      }
      
      if (isServerDomain) {
        return callback(null, true);
      }
      
      // Проверяем явно указанные origins
      const corsOrigins = process.env.CORS_ORIGIN?.split(',') || [];
      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'], // Поддержка WebSocket и polling
  allowEIO3: true, // Поддержка старых версий Socket.IO
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private clientSockets = new Map<number, string>(); // clientId -> socketId
  private operatorSockets = new Map<number, string>(); // operatorId -> socketId
  private typingTimers = new Map<string, NodeJS.Timeout>(); // socketId -> timer

  constructor(
    private messagesService: MessagesService,
    private conversationsService: ConversationsService,
    private clientsService: ClientsService,
    private botService: BotService,
    private routingService: RoutingService,
    private operatorsService: OperatorsService,
  ) {}

  async handleConnection(client: ClientSocket) {
    console.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: ClientSocket) {
    console.log(`Client disconnected: ${client.id}`);
    
    if (client.clientId) {
      this.clientSockets.delete(client.clientId);
    }
    
    if (client.operatorId) {
      this.operatorSockets.delete(client.operatorId);
      // Обновляем статус оператора на offline при отключении
      await this.operatorsService.updateStatus(client.operatorId, 'offline');
    }
  }

  @SubscribeMessage('client:register')
  async handleClientRegister(
    @ConnectedSocket() client: ClientSocket,
    @MessageBody() data: { clientId: number; conversationId?: number },
  ) {
    client.clientId = data.clientId;
    if (data.conversationId) {
      client.conversationId = data.conversationId;
    }
    this.clientSockets.set(data.clientId, client.id);
    
    // Отправляем историю сообщений
    if (data.conversationId) {
      const messages = await this.messagesService.findByConversation(data.conversationId);
      client.emit('messages:history', messages);
    }
  }

  @SubscribeMessage('operator:register')
  async handleOperatorRegister(
    @ConnectedSocket() client: ClientSocket,
    @MessageBody() data: { operatorId: number },
  ) {
    client.operatorId = data.operatorId;
    this.operatorSockets.set(data.operatorId, client.id);
    
    // Обновляем статус оператора на online
    await this.operatorsService.updateStatus(data.operatorId, 'online');
    
    // Отправляем список чатов в очереди
    const queuedConversations = await this.conversationsService.findByStatus('queued');
    client.emit('conversations:queued', queuedConversations);
    
    // Отправляем активные чаты оператора
    const activeConversations = await this.conversationsService.findByOperator(
      data.operatorId,
      'in_progress',
    );
    client.emit('conversations:active', activeConversations);
  }

  @SubscribeMessage('message:send')
  async handleMessage(
    @ConnectedSocket() client: ClientSocket,
    @MessageBody() data: { conversationId: number; text: string; attachments?: any[] },
  ) {
    if (!client.clientId) {
      return { error: 'Not registered as client' };
    }

    const conversation = await this.conversationsService.findById(data.conversationId);
    
    if (conversation.client_id !== client.clientId) {
      return { error: 'Unauthorized' };
    }

    // Создаем сообщение
    const message = await this.messagesService.create({
      conversation_id: data.conversationId,
      sender_type: 'client',
      sender_id: client.clientId,
      text: data.text,
      attachments: data.attachments || [],
    });

    // Отправляем клиенту подтверждение
    client.emit('message:sent', message);

    // Если диалог в статусе bot, обрабатываем ботом
    if (conversation.status === 'bot') {
      const clientData = await this.clientsService.findById(client.clientId);
      const botResponse = await this.botService.processMessage(
        data.conversationId,
        data.text,
        clientData.language,
      );

      // Отправляем ответ бота
      await this.botService.sendBotMessage(
        data.conversationId,
        botResponse.text,
        botResponse.buttons,
      );

      // Если нужно передать оператору
      if (botResponse.shouldTransferToOperator) {
        const operatorId = await this.routingService.routeConversation(
          data.conversationId,
          conversation.queue_id,
        );

        if (operatorId) {
          const operator = await this.operatorsService.findById(operatorId);
          const systemMessageText = clientData.language === 'ru'
            ? `Оператор ${operator.name} подключился к разговору.`
            : clientData.language === 'tj'
            ? `Оператор ${operator.name} ба муколама пайваст шуд.`
            : `Operator ${operator.name} joined the conversation.`;
          
          const systemMessage = await this.messagesService.create({
            conversation_id: data.conversationId,
            sender_type: 'system',
            text: systemMessageText,
          });

          // Отправляем клиенту
          this.sendToClient(conversation.client_id, 'message:new', systemMessage);
          
          // Отправляем оператору
          this.sendToOperator(operatorId, 'conversation:assigned', conversation);
          this.sendToOperator(operatorId, 'message:new', systemMessage);
        } else {
          // Нет доступных операторов
          const noOperatorText = clientData.language === 'ru'
            ? 'Сейчас операторов нет онлайн. Оставьте сообщение — мы ответим, как только будем на связи.'
            : clientData.language === 'tj'
            ? 'Акнун операторҳо онлайн нестанд. Паём гузоред — мо ҳамчун ки дар тамос бошем, ҷавоб медиҳем.'
            : 'No operators are online now. Leave a message — we will respond as soon as we are available.';
          
          const noOperatorMessage = await this.messagesService.create({
            conversation_id: data.conversationId,
            sender_type: 'system',
            text: noOperatorText,
          });
          this.sendToClient(conversation.client_id, 'message:new', noOperatorMessage);
        }
      }

      // Отправляем обновленную историю клиенту
      const messages = await this.messagesService.findByConversation(data.conversationId);
      this.sendToClient(conversation.client_id, 'messages:update', messages);
    } else if (conversation.status === 'in_progress' && conversation.assigned_operator_id) {
      // Отправляем оператору
      this.sendToOperator(conversation.assigned_operator_id, 'message:new', message);
      
      // НЕ помечаем автоматически как прочитанное - оператор должен прочитать сообщение сам
      // Сообщение будет помечено как прочитанное только когда оператор откроет диалог
    }

    return { success: true, message };
  }

  @SubscribeMessage('operator:message:send')
  async handleOperatorMessage(
    @ConnectedSocket() client: ClientSocket,
    @MessageBody() data: { conversationId: number; text: string; attachments?: any[] },
  ) {
    if (!client.operatorId) {
      return { error: 'Not registered as operator' };
    }

    const conversation = await this.conversationsService.findById(data.conversationId);
    
    if (conversation.assigned_operator_id !== client.operatorId) {
      return { error: 'Unauthorized' };
    }

    // Создаем сообщение
    const message = await this.messagesService.create({
      conversation_id: data.conversationId,
      sender_type: 'operator',
      sender_id: client.operatorId,
      text: data.text,
      attachments: data.attachments || [],
    });

    // Отправляем оператору новое сообщение (для отображения в реальном времени)
    client.emit('message:new', message);

    // Отправляем клиенту
    this.sendToClient(conversation.client_id, 'message:new', message);

    // Помечаем как прочитанное клиентом (если он онлайн) и отправляем обновление
    const updatedMessage = await this.messagesService.markAsReadByClient(message.message_id);
    if (updatedMessage) {
      // Отправляем обновленное сообщение оператору для обновления статуса галочек
      client.emit('message:updated', updatedMessage);
      this.sendToClient(conversation.client_id, 'message:updated', updatedMessage);
    }

    return { success: true, message };
  }

  @SubscribeMessage('operator:accept')
  async handleOperatorAccept(
    @ConnectedSocket() client: ClientSocket,
    @MessageBody() data: { conversationId: number },
  ) {
    if (!client.operatorId) {
      return { error: 'Not registered as operator' };
    }

    const conversation = await this.conversationsService.findById(data.conversationId);
    
    // Проверяем, может ли оператор принять
    const canAccept = await this.operatorsService.canAcceptMoreChats(client.operatorId);
    if (!canAccept) {
      return { error: 'Max active chats reached' };
    }

    // Назначаем оператора
    await this.conversationsService.assignOperator(data.conversationId, client.operatorId);

    const operator = await this.operatorsService.findById(client.operatorId);
    const clientData = await this.clientsService.findById(conversation.client_id);
    const systemMessageText = clientData.language === 'ru'
      ? `Оператор ${operator.name} подключился к разговору.`
      : clientData.language === 'tj'
      ? `Оператор ${operator.name} ба муколама пайваст шуд.`
      : `Operator ${operator.name} joined the conversation.`;
    
    const systemMessage = await this.messagesService.create({
      conversation_id: data.conversationId,
      sender_type: 'system',
      text: systemMessageText,
    });

    // Отправляем клиенту
    this.sendToClient(conversation.client_id, 'message:new', systemMessage);
    this.sendToClient(conversation.client_id, 'conversation:status', { status: 'in_progress' });

    // Отправляем оператору историю
    const messages = await this.messagesService.findByConversation(data.conversationId);
    client.emit('messages:history', messages);
    client.emit('conversation:accepted', conversation);

    // Обновляем список очереди для всех операторов
    this.broadcastToOperators('conversations:queued', await this.conversationsService.findByStatus('queued'));

    return { success: true, conversation };
  }

  @SubscribeMessage('operator:close')
  async handleOperatorClose(
    @ConnectedSocket() client: ClientSocket,
    @MessageBody() data: { conversationId: number },
  ) {
    if (!client.operatorId) {
      return { error: 'Not registered as operator' };
    }

    const conversation = await this.conversationsService.findById(data.conversationId);
    
    if (conversation.assigned_operator_id !== client.operatorId) {
      return { error: 'Unauthorized' };
    }

    await this.conversationsService.close(data.conversationId);

    const clientData = await this.clientsService.findById(conversation.client_id);
    const systemMessageText = clientData.language === 'ru'
      ? 'Диалог закрыт оператором.'
      : clientData.language === 'tj'
      ? 'Муколама аз ҷониби оператор пӯшида шуд.'
      : 'Dialog closed by operator.';
    
    const systemMessage = await this.messagesService.create({
      conversation_id: data.conversationId,
      sender_type: 'system',
      text: systemMessageText,
    });

    this.sendToClient(conversation.client_id, 'message:new', systemMessage);
    this.sendToClient(conversation.client_id, 'conversation:closed', { conversationId: data.conversationId });

    client.emit('conversation:closed', conversation);

    return { success: true };
  }

  @SubscribeMessage('client:close')
  async handleClientClose(
    @ConnectedSocket() client: ClientSocket,
    @MessageBody() data: { conversationId: number },
  ) {
    try {
      if (!client.clientId) {
        console.error('Client close: Not registered as client');
        return { error: 'Not registered as client' };
      }

      const conversation = await this.conversationsService.findById(data.conversationId);
      
      if (!conversation) {
        console.error('Client close: Conversation not found', data.conversationId);
        return { error: 'Conversation not found' };
      }
      
      if (conversation.client_id !== client.clientId) {
        console.error('Client close: Unauthorized', { clientId: client.clientId, conversationClientId: conversation.client_id });
        return { error: 'Unauthorized' };
      }

      if (conversation.status === 'closed') {
        console.log('Client close: Conversation already closed', data.conversationId);
        return { success: true, message: 'Already closed' };
      }

      await this.conversationsService.close(data.conversationId);

      const clientData = await this.clientsService.findById(conversation.client_id);
      const systemMessageText = clientData.language === 'ru'
        ? 'Диалог закрыт клиентом.'
        : clientData.language === 'tj'
        ? 'Муколама аз ҷониби муштарӣ пӯшида шуд.'
        : 'Dialog closed by client.';
      
      const systemMessage = await this.messagesService.create({
        conversation_id: data.conversationId,
        sender_type: 'system',
        text: systemMessageText,
      });

      // Отправляем клиенту
      client.emit('message:new', systemMessage);
      client.emit('conversation:closed', { conversationId: data.conversationId });

      // Отправляем оператору, если он назначен
      if (conversation.assigned_operator_id) {
        this.sendToOperator(conversation.assigned_operator_id, 'message:new', systemMessage);
        this.sendToOperator(conversation.assigned_operator_id, 'conversation:closed', conversation);
      }

      console.log('Client close: Successfully closed conversation', data.conversationId);
      return { success: true };
    } catch (error) {
      console.error('Client close: Error', error);
      return { error: 'Internal server error' };
    }
  }

  // Вспомогательные методы для отправки сообщений
  public sendToClient(clientId: number, event: string, data: any) {
    const socketId = this.clientSockets.get(clientId);
    if (socketId) {
      this.server.to(socketId).emit(event, data);
    }
  }

  public sendToOperator(operatorId: number, event: string, data: any) {
    const socketId = this.operatorSockets.get(operatorId);
    if (socketId) {
      this.server.to(socketId).emit(event, data);
    }
  }

  private broadcastToOperators(event: string, data: any) {
    this.operatorSockets.forEach((socketId) => {
      this.server.to(socketId).emit(event, data);
    });
  }

  @SubscribeMessage('client:typing:start')
  async handleClientTypingStart(
    @ConnectedSocket() client: ClientSocket,
    @MessageBody() data: { conversationId: number },
  ) {
    if (!client.clientId) return;

    const conversation = await this.conversationsService.findById(data.conversationId);
    if (conversation.client_id !== client.clientId) return;

    const clientData = await this.clientsService.findById(client.clientId);
    
    // Отправляем оператору (если назначен)
    if (conversation.assigned_operator_id) {
      this.sendToOperator(conversation.assigned_operator_id, 'typing:start', {
        conversationId: data.conversationId,
        name: clientData.name,
      });
    } else if (conversation.status === 'queued' || conversation.status === 'assigned') {
      // Если диалог в очереди, отправляем всем операторам
      this.broadcastToOperators('typing:start', {
        conversationId: data.conversationId,
        name: clientData.name,
      });
    }

    // Очищаем предыдущий таймер
    const timerKey = `client:${client.id}`;
    if (this.typingTimers.has(timerKey)) {
      clearTimeout(this.typingTimers.get(timerKey));
    }

    // Автоматически останавливаем через 3 секунды
    const timer = setTimeout(() => {
      this.handleClientTypingStop(client, { conversationId: data.conversationId });
      this.typingTimers.delete(timerKey);
    }, 3000);
    this.typingTimers.set(timerKey, timer);
  }

  @SubscribeMessage('client:typing:stop')
  async handleClientTypingStop(
    @ConnectedSocket() client: ClientSocket,
    @MessageBody() data: { conversationId: number },
  ) {
    if (!client.clientId) return;

    const conversation = await this.conversationsService.findById(data.conversationId);
    if (conversation.client_id !== client.clientId) return;

    // Отправляем оператору (если назначен)
    if (conversation.assigned_operator_id) {
      this.sendToOperator(conversation.assigned_operator_id, 'typing:stop', {
        conversationId: data.conversationId,
      });
    } else if (conversation.status === 'queued' || conversation.status === 'assigned') {
      // Если диалог в очереди, отправляем всем операторам
      this.broadcastToOperators('typing:stop', {
        conversationId: data.conversationId,
      });
    }

    // Очищаем таймер
    const timerKey = `client:${client.id}`;
    if (this.typingTimers.has(timerKey)) {
      clearTimeout(this.typingTimers.get(timerKey));
      this.typingTimers.delete(timerKey);
    }
  }

  @SubscribeMessage('operator:typing:start')
  async handleOperatorTypingStart(
    @ConnectedSocket() client: ClientSocket,
    @MessageBody() data: { conversationId: number },
  ) {
    if (!client.operatorId) return;

    const conversation = await this.conversationsService.findById(data.conversationId);
    if (conversation.assigned_operator_id !== client.operatorId) return;

    // Отправляем клиенту
    const operator = await this.operatorsService.findById(client.operatorId);
    this.sendToClient(conversation.client_id, 'typing:start', {
      conversationId: data.conversationId,
      name: operator.name,
    });

    // Очищаем предыдущий таймер
    const timerKey = `operator:${client.id}`;
    if (this.typingTimers.has(timerKey)) {
      clearTimeout(this.typingTimers.get(timerKey));
    }

    // Автоматически останавливаем через 3 секунды
    const timer = setTimeout(() => {
      this.handleOperatorTypingStop(client, { conversationId: data.conversationId });
      this.typingTimers.delete(timerKey);
    }, 3000);
    this.typingTimers.set(timerKey, timer);
  }

  @SubscribeMessage('operator:typing:stop')
  async handleOperatorTypingStop(
    @ConnectedSocket() client: ClientSocket,
    @MessageBody() data: { conversationId: number },
  ) {
    if (!client.operatorId) return;

    const conversation = await this.conversationsService.findById(data.conversationId);
    if (conversation.assigned_operator_id !== client.operatorId) return;

    // Отправляем клиенту
    this.sendToClient(conversation.client_id, 'typing:stop', {
      conversationId: data.conversationId,
    });

    // Очищаем таймер
    const timerKey = `operator:${client.id}`;
    if (this.typingTimers.has(timerKey)) {
      clearTimeout(this.typingTimers.get(timerKey));
      this.typingTimers.delete(timerKey);
    }
  }
}

