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
import { Conversation, ConversationStatus, ConversationPriority } from '../entities/conversation.entity';
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
    const conversation = await this.findById(conversationId);
    conversation.assigned_operator_id = operatorId;
    conversation.status = 'in_progress';
    conversation.assigned_at = new Date();

    return await this.conversationsRepository.save(conversation);
  }

  async close(conversationId: number): Promise<Conversation> {
    return await this.updateStatus(conversationId, 'closed');
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
    const conversation = await this.findById(conversationId);
    const previousOperatorId = conversation.assigned_operator_id;

    conversation.assigned_operator_id = newOperatorId;
    conversation.assigned_at = new Date();
    const saved = await this.conversationsRepository.save(conversation);

    // Уведомляем нового оператора о переназначенном диалоге (диалог + история)
    if (newOperatorId) {
      try {
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
    // 1) Новый оператор должен увидеть этот диалог в своих активных
    if (newOperatorId) {
      try {
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
        await this.chatGateway.updateOperatorActiveConversations(previousOperatorId);
      } catch (err) {
        console.error('Failed to update active conversations for previous operator:', {
          operatorId: previousOperatorId,
          error: (err as any)?.message,
        });
      }
    }

    return saved;
  }
}

