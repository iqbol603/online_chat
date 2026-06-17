import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  Conversation,
  ConversationStatus,
  ConversationPriority,
  ConversationClosedByType,
} from '../entities/conversation.entity';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private conversationsRepository: Repository<Conversation>,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) {}

  async create(data: {
    client_id: number;
    department?: string;
    queue_id?: number;
    priority?: ConversationPriority;
  }): Promise<Conversation> {
    const conversation = this.conversationsRepository.create({
      client_id: data.client_id,
      status: 'bot',
      priority: data.priority || 'normal',
      department: data.department,
      queue_id: data.queue_id,
    });

    return await this.conversationsRepository.save(conversation);
  }

  async findById(conversationId: number): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findOne({
      where: { conversation_id: conversationId },
      relations: ['client', 'assigned_operator', 'queue', 'messages'],
      order: { messages: { created_at: 'ASC' } },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  async findByClient(clientId: number, status?: ConversationStatus): Promise<Conversation[]> {
    const where: any = { client_id: clientId };
    if (status) {
      where.status = status;
    }

    return await this.conversationsRepository.find({
      where,
      relations: ['client', 'assigned_operator', 'queue'],
      order: { created_at: 'DESC' },
    });
  }

  async findActiveByClient(clientId: number): Promise<Conversation | null> {
    return await this.conversationsRepository.findOne({
      where: {
        client_id: clientId,
        status: In(['bot', 'queued', 'assigned', 'in_progress']),
      },
      relations: ['client', 'assigned_operator', 'queue', 'messages'],
      order: { created_at: 'DESC' },
    });
  }

  async updateStatus(
    conversationId: number,
    status: ConversationStatus,
    operatorId?: number,
  ): Promise<Conversation> {
    const conversation = await this.findById(conversationId);

    conversation.status = status;

    if (status === 'queued') {
      conversation.queued_at = new Date();
    }

    if (status === 'assigned' || status === 'in_progress') {
      if (operatorId) {
        conversation.assigned_operator_id = operatorId;
        conversation.assigned_at = new Date();
      }
    }

    if (status === 'closed') {
      conversation.closed_at = new Date();
    }

    return await this.conversationsRepository.save(conversation);
  }

  async assignOperator(conversationId: number, operatorId: number): Promise<Conversation> {
    // Используем прямой UPDATE, как в reassign, чтобы избежать проблем с кэшем
    const updateResult = await this.conversationsRepository.update(
      { conversation_id: conversationId },
      {
        assigned_operator_id: operatorId,
        status: 'in_progress',
        assigned_at: new Date(),
      },
    );

    if (updateResult.affected === 0) {
      throw new NotFoundException('Conversation not found or update failed');
    }

    // Перезагружаем диалог из БД с актуальными данными
    const reloadedConversation = await this.conversationsRepository
      .createQueryBuilder('conversation')
      .where('conversation.conversation_id = :id', { id: conversationId })
      .leftJoinAndSelect('conversation.client', 'client')
      .leftJoinAndSelect('conversation.assigned_operator', 'assigned_operator')
      .leftJoinAndSelect('conversation.queue', 'queue')
      .getOne();

    if (!reloadedConversation) {
      throw new NotFoundException('Conversation not found after assign');
    }

    return reloadedConversation;
  }

  async close(conversationId: number): Promise<Conversation> {
    return await this.updateStatus(conversationId, 'closed');
  }

  /**
   * Отмечаем, кем был закрыт диалог (клиент или оператор)
   */
  async markClosedBy(
    conversationId: number,
    type: ConversationClosedByType,
    operatorId?: number,
  ): Promise<Conversation> {
    const conversation = await this.findById(conversationId);
    conversation.closed_by_type = type;
    conversation.closed_by_operator_id = type === 'operator' ? operatorId ?? null : null;
    return await this.conversationsRepository.save(conversation);
  }

  async findByStatus(status: ConversationStatus, queueId?: number): Promise<Conversation[]> {
    const where: any = { status };
    if (queueId) {
      where.queue_id = queueId;
    }

    return await this.conversationsRepository.find({
      where,
      relations: ['client', 'assigned_operator', 'queue'],
      order: { created_at: 'ASC' },
    });
  }

  async findByOperator(operatorId: number, status?: ConversationStatus): Promise<Conversation[]> {
    const where: any = { assigned_operator_id: operatorId };
    if (status) {
      where.status = status;
    }

    return await this.conversationsRepository.find({
      where,
      relations: ['client', 'queue', 'messages'],
      order: { updated_at: 'DESC' },
    });
  }

  /**
   * Поиск всех обращений клиента по его номеру телефона.
   * Используется в аналитике/поиске по телефону.
   */
  async findByClientPhone(phone: string): Promise<Conversation[]> {
    // Нормализация телефона такая же, как в ClientsService
    const normalizedPhone = this.normalizePhoneForSearch(phone);

    return await this.conversationsRepository
      .createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.client', 'client')
      .leftJoinAndSelect('conversation.assigned_operator', 'assigned_operator')
      .leftJoinAndSelect('conversation.queue', 'queue')
      .where('client.phone = :phone', { phone: normalizedPhone })
      .orderBy('conversation.created_at', 'DESC')
      .getMany();
  }

  // Локальная версия normalizePhone, чтобы избежать циклических зависимостей с ClientsService
  private normalizePhoneForSearch(phone: string): string {
    let cleaned = phone.replace(/[^\d+]/g, '');

    if (cleaned.startsWith('992') && !cleaned.startsWith('+992')) {
      cleaned = '+' + cleaned;
    }

    if (cleaned.match(/^9\d{8}$/)) {
      cleaned = '+992' + cleaned;
    }

    return cleaned;
  }

  /**
   * Получить архивные (закрытые) чаты оператора за период (от-до)
   * Для аналитики админа
   */
  async findArchivedByOperator(
    operatorId: number,
    startDate: string,
    endDate: string,
    includeAssigned = true,
    includeClosedBy = true,
    limit = 500,
  ): Promise<Conversation[]> {
    if (!includeAssigned && !includeClosedBy) {
      return [];
    }

    const start = `${startDate} 00:00:00`;
    const end = `${endDate} 23:59:59`;

    const orParts: string[] = [];
    const params: Record<string, unknown> = {
      operatorId,
      status: 'closed',
      start,
      end,
    };

    if (includeClosedBy) {
      orParts.push('conversation.closed_by_operator_id = :operatorId');
    }
    if (includeAssigned) {
      orParts.push('conversation.assigned_operator_id = :operatorId');

      // Отдельный быстрый запрос вместо EXISTS по всей таблице messages
      const rows = await this.conversationsRepository.manager
        .createQueryBuilder()
        .select('DISTINCT m.conversation_id', 'conversation_id')
        .from('messages', 'm')
        .innerJoin(
          'conversations',
          'c',
          'c.conversation_id = m.conversation_id AND c.status = :status AND c.closed_at IS NOT NULL AND c.closed_at >= :start AND c.closed_at <= :end',
        )
        .where('m.sender_type = :senderType', { senderType: 'operator' })
        .andWhere('m.sender_id = :operatorId', { operatorId })
        .setParameters({ status: 'closed', start, end, operatorId, senderType: 'operator' })
        .limit(5000)
        .getRawMany<{ conversation_id: number }>();

      const messageConversationIds = rows.map((r) => Number(r.conversation_id)).filter(Boolean);
      if (messageConversationIds.length > 0) {
        orParts.push('conversation.conversation_id IN (:...messageConversationIds)');
        params.messageConversationIds = messageConversationIds;
      }
    }

    if (orParts.length === 0) {
      return [];
    }

    return await this.conversationsRepository
      .createQueryBuilder('conversation')
      .where(`(${orParts.join(' OR ')})`, params)
      .andWhere('conversation.status = :status', { status: 'closed' })
      .andWhere('conversation.closed_at IS NOT NULL')
      .andWhere('conversation.closed_at >= :start', { start })
      .andWhere('conversation.closed_at <= :end', { end })
      .leftJoinAndSelect('conversation.client', 'client')
      .leftJoinAndSelect('conversation.assigned_operator', 'assigned_operator')
      .leftJoinAndSelect('conversation.queue', 'queue')
      .orderBy('conversation.closed_at', 'DESC')
      .take(Math.min(Math.max(limit, 1), 1000))
      .getMany();
  }

  /**
   * Получить все закрытые чаты за период (для быстрой статистики)
   */
  async findAllArchivedByPeriod(
    startDate: string,
    endDate: string,
    limit = 1000,
  ): Promise<Conversation[]> {
    const start = `${startDate} 00:00:00`;
    const end = `${endDate} 23:59:59`;

    return await this.conversationsRepository
      .createQueryBuilder('conversation')
      .where('conversation.status = :status', { status: 'closed' })
      .andWhere('conversation.closed_at IS NOT NULL')
      .andWhere('conversation.closed_at >= :start', { start })
      .andWhere('conversation.closed_at <= :end', { end })
      .leftJoinAndSelect('conversation.client', 'client')
      .leftJoinAndSelect('conversation.assigned_operator', 'assigned_operator')
      .leftJoinAndSelect('conversation.queue', 'queue')
      .orderBy('conversation.closed_at', 'DESC')
      .take(Math.min(Math.max(limit, 1), 2000))
      .getMany();
  }

  async addTag(conversationId: number, tag: string): Promise<Conversation> {
    const conversation = await this.findById(conversationId);
    const tags = conversation.tags || [];
    if (!tags.includes(tag)) {
      tags.push(tag);
      conversation.tags = tags;
      return await this.conversationsRepository.save(conversation);
    }
    return conversation;
  }

  async setRating(
    conversationId: number,
    clientId: number,
    rating: number,
    comment?: string,
  ): Promise<Conversation> {
    const conversation = await this.findById(conversationId);

    if (conversation.client_id !== clientId) {
      throw new ForbiddenException('Conversation does not belong to this client');
    }

    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // One-time: do not overwrite an existing rating
    if (conversation.rating !== null && conversation.rating !== undefined) {
      return conversation;
    }

    conversation.rating = rating;
    conversation.rating_comment = comment;
    return await this.conversationsRepository.save(conversation);
  }

  // Метод для Supervisor/Admin - видеть все диалоги
  async findAll(status?: ConversationStatus): Promise<Conversation[]> {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    return await this.conversationsRepository.find({
      where,
      relations: ['client', 'assigned_operator', 'queue'],
      order: { created_at: 'DESC' },
    });
  }

  // Метод для Supervisor/Admin - переназначить диалог другому оператору
  async reassign(conversationId: number, newOperatorId: number): Promise<Conversation> {
    console.log('🔄 [ConversationsService.reassign] called with:', {
      conversationId,
      newOperatorId,
    });

    const conversation = await this.findById(conversationId);
    const previousOperatorId = conversation.assigned_operator_id;
    console.log('🔄 [ConversationsService.reassign] current conversation state:', {
      previousOperatorId,
      status: conversation.status,
    });

    // КРИТИЧНО: Используем update() для прямого UPDATE запроса к БД
    // Это гарантирует, что изменения будут сохранены в БД
    const updateResult = await this.conversationsRepository.update(
      { conversation_id: conversationId },
      {
        assigned_operator_id: newOperatorId,
        assigned_at: new Date(),
      },
    );
    
    console.log('✅ [ConversationsService.reassign] update result:', {
      affected: updateResult.affected,
      conversationId,
      newOperatorId,
    });

    if (updateResult.affected === 0) {
      throw new NotFoundException('Conversation not found or update failed');
    }

    // Перезагружаем диалог из БД с актуальными данными
    const reloadedConversation = await this.conversationsRepository
      .createQueryBuilder('conversation')
      .where('conversation.conversation_id = :id', { id: conversationId })
      .leftJoinAndSelect('conversation.client', 'client')
      .leftJoinAndSelect('conversation.assigned_operator', 'assigned_operator')
      .leftJoinAndSelect('conversation.queue', 'queue')
      .getOne();
    
    if (!reloadedConversation) {
      throw new NotFoundException('Conversation not found after reassignment');
    }
    
    console.log('✅ [ConversationsService.reassign] reloaded conversation from DB:', {
      conversationId: reloadedConversation.conversation_id,
      assigned_operator_id: reloadedConversation.assigned_operator_id,
      status: reloadedConversation.status,
    });
    
    // Проверяем, что диалог действительно переназначен
    if (reloadedConversation.assigned_operator_id !== newOperatorId) {
      console.error('❌ [ConversationsService.reassign] CRITICAL: Conversation was not reassigned correctly!', {
        expected: newOperatorId,
        actual: reloadedConversation.assigned_operator_id,
        updateAffected: updateResult.affected,
      });
      throw new Error('Failed to reassign conversation: assigned_operator_id mismatch');
    }

    // Уведомляем нового оператора о переназначенном диалоге (диалог + история)
    if (newOperatorId) {
      try {
        console.log('📨 [ConversationsService.reassign] notifying new operator about reassigned conversation', {
          conversationId,
          newOperatorId,
        });
        // Используем перезагруженный диалог для уведомления
        await this.chatGateway.notifyConversationReassigned(conversationId, newOperatorId);
      } catch (err) {
        console.error('Failed to notify new operator about reassigned conversation:', {
          conversationId,
          operatorId: newOperatorId,
          error: (err as any)?.message,
        });
      }
    }

    // После переназначения нужно обновить списки активных диалогов у операторов
    // ВАЖНО: Делаем это ПОСЛЕ того, как убедились, что диалог сохранен в БД
    // 1) Новый оператор должен увидеть этот диалог в своих активных
    if (newOperatorId) {
      try {
        console.log('📡 [ConversationsService.reassign] updating active conversations for new operator', {
          newOperatorId,
        });
        await this.chatGateway.updateOperatorActiveConversations(newOperatorId);
      } catch (err) {
        console.error('Failed to update active conversations for new operator:', {
          operatorId: newOperatorId,
          error: (err as any)?.message,
        });
      }
    }

    // 2) Старый оператор (если был) должен больше не видеть этот диалог в активных
    if (previousOperatorId && previousOperatorId !== newOperatorId) {
      try {
        console.log('📡 [ConversationsService.reassign] updating active conversations for previous operator', {
          previousOperatorId,
        });
        await this.chatGateway.updateOperatorActiveConversations(previousOperatorId);
      } catch (err) {
        console.error('Failed to update active conversations for previous operator:', {
          operatorId: previousOperatorId,
          error: (err as any)?.message,
        });
      }
    }

    // Возвращаем свежую версию диалога с актуальными связями
    return reloadedConversation;
  }
}

