import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Queue } from '../entities/queue.entity';

@Injectable()
export class QueuesService {
  constructor(
    @InjectRepository(Queue)
    private queuesRepository: Repository<Queue>,
  ) {}

  async create(data: {
    name: string;
    department?: string;
    routing_mode?: 'round-robin' | 'least-active' | 'skill-based';
    working_hours?: any;
  }): Promise<Queue> {
    const queue = this.queuesRepository.create({
      name: data.name,
      department: data.department,
      routing_mode: data.routing_mode || 'least-active',
      working_hours: data.working_hours,
      is_active: true,
    });

    return await this.queuesRepository.save(queue);
  }

  async findAll(): Promise<Queue[]> {
    return await this.queuesRepository.find({
      where: { is_active: true },
    });
  }

  async findById(queueId: number): Promise<Queue> {
    const queue = await this.queuesRepository.findOne({
      where: { queue_id: queueId },
      relations: ['operator_queues', 'operator_queues.operator'],
    });

    if (!queue) {
      throw new NotFoundException('Queue not found');
    }

    return queue;
  }

  async update(queueId: number, data: Partial<Queue>): Promise<Queue> {
    const queue = await this.findById(queueId);
    Object.assign(queue, data);
    return await this.queuesRepository.save(queue);
  }
}

