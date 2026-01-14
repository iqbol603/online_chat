import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Operator, OperatorStatus } from '../entities/operator.entity';
import { OperatorQueue } from '../entities/operator-queue.entity';

@Injectable()
export class OperatorsService {
  constructor(
    @InjectRepository(Operator)
    private operatorsRepository: Repository<Operator>,
    @InjectRepository(OperatorQueue)
    private operatorQueuesRepository: Repository<OperatorQueue>,
  ) {}

  async create(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: 'operator' | 'admin' | 'supervisor';
    max_active_chats?: number;
  }): Promise<Operator> {
    const passwordHash = await bcrypt.hash(data.password, 10);

    const operator = this.operatorsRepository.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      password_hash: passwordHash,
      role: data.role || 'operator',
      max_active_chats: data.max_active_chats || 5,
      status_presence: 'offline',
    });

    return await this.operatorsRepository.save(operator);
  }

  async findByEmail(email: string): Promise<Operator | null> {
    return await this.operatorsRepository.findOne({
      where: { email },
      relations: ['operator_queues', 'operator_queues.queue'],
    });
  }

  async findById(operatorId: number): Promise<Operator> {
    const operator = await this.operatorsRepository.findOne({
      where: { operator_id: operatorId },
      relations: ['operator_queues', 'operator_queues.queue'],
    });

    if (!operator) {
      throw new NotFoundException('Operator not found');
    }

    return operator;
  }

  async findAll(): Promise<Operator[]> {
    return await this.operatorsRepository.find({
      relations: ['operator_queues', 'operator_queues.queue'],
    });
  }

  async findOnline(): Promise<Operator[]> {
    return await this.operatorsRepository.find({
      where: { status_presence: 'online' },
      relations: ['operator_queues', 'operator_queues.queue'],
    });
  }

  async updateStatus(operatorId: number, status: OperatorStatus): Promise<Operator> {
    const operator = await this.findById(operatorId);
    operator.status_presence = status;
    operator.last_seen_at = new Date();
    return await this.operatorsRepository.save(operator);
  }

  async getActiveChatsCount(operatorId: number): Promise<number> {
    const result = await this.operatorsRepository
      .createQueryBuilder('operator')
      .leftJoin('operator.conversations', 'conversation')
      .where('operator.operator_id = :operatorId', { operatorId })
      .andWhere('conversation.status IN (:...statuses)', {
        statuses: ['assigned', 'in_progress'],
      })
      .getCount();

    return result;
  }

  async canAcceptMoreChats(operatorId: number): Promise<boolean> {
    const operator = await this.findById(operatorId);
    const activeCount = await this.getActiveChatsCount(operatorId);
    return activeCount < operator.max_active_chats;
  }

  async addToQueue(operatorId: number, queueId: number, priority: number = 0): Promise<void> {
    const exists = await this.operatorQueuesRepository.findOne({
      where: { operator_id: operatorId, queue_id: queueId },
    });

    if (!exists) {
      const operatorQueue = this.operatorQueuesRepository.create({
        operator_id: operatorId,
        queue_id: queueId,
        priority,
      });
      await this.operatorQueuesRepository.save(operatorQueue);
    }
  }

  async removeFromQueue(operatorId: number, queueId: number): Promise<void> {
    await this.operatorQueuesRepository.delete({
      operator_id: operatorId,
      queue_id: queueId,
    });
  }

  async getQueuesForOperator(operatorId: number): Promise<number[]> {
    const operatorQueues = await this.operatorQueuesRepository.find({
      where: { operator_id: operatorId },
    });
    return operatorQueues.map((oq) => oq.queue_id);
  }

  async validatePassword(operator: Operator, password: string): Promise<boolean> {
    return await bcrypt.compare(password, operator.password_hash);
  }

  async update(operatorId: number, data: {
    name?: string;
    email?: string;
    password?: string;
    role?: 'operator' | 'admin' | 'supervisor';
    max_active_chats?: number;
    phone?: string;
  }): Promise<Operator> {
    const operator = await this.findById(operatorId);
    
    // Обновляем только переданные поля
    if (data.name !== undefined) {
      operator.name = data.name;
    }
    if (data.email !== undefined) {
      operator.email = data.email;
    }
    if (data.role !== undefined) {
      operator.role = data.role;
    }
    if (data.max_active_chats !== undefined) {
      operator.max_active_chats = data.max_active_chats;
    }
    if (data.phone !== undefined) {
      operator.phone = data.phone;
    }
    
    // Пароль хешируем только если он передан и не пустой
    if (data.password !== undefined && data.password !== null && data.password.trim() !== '') {
      operator.password_hash = await bcrypt.hash(data.password, 10);
    }
    
    return await this.operatorsRepository.save(operator);
  }

  async delete(operatorId: number): Promise<void> {
    await this.operatorsRepository.delete(operatorId);
  }
}

