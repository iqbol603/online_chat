import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { OperatorsService } from '../operators/operators.service';
import { QueuesService } from '../queues/queues.service';
import { ConversationsService } from '../conversations/conversations.service';

@Injectable()
export class RoutingService {
  constructor(
    private operatorsService: OperatorsService,
    private queuesService: QueuesService,
    @Inject(forwardRef(() => ConversationsService))
    private conversationsService: ConversationsService,
  ) {}

  async findAvailableOperator(queueId?: number): Promise<number | null> {
    // Получаем всех онлайн операторов
    const onlineOperators = await this.operatorsService.findOnline();

    if (onlineOperators.length === 0) {
      return null;
    }

    // Фильтруем по очереди, если указана
    let candidates = onlineOperators;

    if (queueId) {
      const queueOperators = [];
      for (const operator of onlineOperators) {
        const queues = await this.operatorsService.getQueuesForOperator(operator.operator_id);
        if (queues.includes(queueId)) {
          queueOperators.push(operator);
        }
      }
      candidates = queueOperators;
    }

    if (candidates.length === 0) {
      return null;
    }

    // Выбираем оператора по стратегии least-active
    let selectedOperator = candidates[0];
    let minActiveChats = await this.operatorsService.getActiveChatsCount(selectedOperator.operator_id);

    for (const operator of candidates) {
      const activeChats = await this.operatorsService.getActiveChatsCount(operator.operator_id);
      const canAcceptMore = await this.operatorsService.canAcceptMoreChats(operator.operator_id);

      if (canAcceptMore && activeChats < minActiveChats) {
        selectedOperator = operator;
        minActiveChats = activeChats;
      }
    }

    // Проверяем, может ли оператор принять еще чат
    const canAccept = await this.operatorsService.canAcceptMoreChats(selectedOperator.operator_id);
    if (!canAccept) {
      return null;
    }

    return selectedOperator.operator_id;
  }

  async routeConversation(conversationId: number, queueId?: number): Promise<number | null> {
    const operatorId = await this.findAvailableOperator(queueId);
    
    if (operatorId) {
      await this.conversationsService.assignOperator(conversationId, operatorId);
      return operatorId;
    }

    // Если оператора нет, оставляем в очереди
    await this.conversationsService.updateStatus(conversationId, 'queued');
    return null;
  }

  async tryRouteQueuedConversations(): Promise<void> {
    const queuedConversations = await this.conversationsService.findByStatus('queued');

    for (const conversation of queuedConversations) {
      const operatorId = await this.findAvailableOperator(conversation.queue_id);
      if (operatorId) {
        await this.conversationsService.assignOperator(conversation.conversation_id, operatorId);
      }
    }
  }
}

