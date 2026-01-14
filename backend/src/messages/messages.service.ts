import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message, SenderType } from '../entities/message.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messagesRepository: Repository<Message>,
  ) {}

  async create(data: {
    conversation_id: number;
    sender_type: SenderType;
    sender_id?: number;
    text: string;
    attachments?: any[];
  }): Promise<Message> {
    const message = this.messagesRepository.create({
      conversation_id: data.conversation_id,
      sender_type: data.sender_type,
      sender_id: data.sender_id,
      text: data.text,
      attachments: data.attachments || [],
    });

    return await this.messagesRepository.save(message);
  }

  async findByConversation(conversationId: number): Promise<Message[]> {
    return await this.messagesRepository.find({
      where: { conversation_id: conversationId },
      order: { created_at: 'ASC' },
    });
  }

  async markAsReadByOperator(messageId: number): Promise<Message> {
    const message = await this.messagesRepository.findOne({
      where: { message_id: messageId },
    });
    if (message) {
      message.read_by_operator_at = new Date();
      return await this.messagesRepository.save(message);
    }
    return message;
  }

  async markAsReadByClient(messageId: number): Promise<Message> {
    const message = await this.messagesRepository.findOne({
      where: { message_id: messageId },
    });
    if (message) {
      message.read_by_client_at = new Date();
      return await this.messagesRepository.save(message);
    }
    return message;
  }

  async markConversationAsReadByOperator(conversationId: number): Promise<void> {
    await this.messagesRepository
      .createQueryBuilder()
      .update(Message)
      .set({ read_by_operator_at: new Date() })
      .where('conversation_id = :conversationId', { conversationId })
      .andWhere('read_by_operator_at IS NULL')
      .andWhere('sender_type != :type', { type: 'operator' })
      .execute();
  }

  async markConversationAsReadByClient(conversationId: number): Promise<void> {
    await this.messagesRepository
      .createQueryBuilder()
      .update(Message)
      .set({ read_by_client_at: new Date() })
      .where('conversation_id = :conversationId', { conversationId })
      .andWhere('read_by_client_at IS NULL')
      .andWhere('sender_type != :type', { type: 'client' })
      .execute();
  }
}

