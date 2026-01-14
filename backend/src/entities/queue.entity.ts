import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { OperatorQueue } from './operator-queue.entity';

export type RoutingMode = 'round-robin' | 'least-active' | 'skill-based';

@Entity('queues')
export class Queue {
  @PrimaryGeneratedColumn()
  queue_id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department: string;

  @Column({
    type: 'enum',
    enum: ['round-robin', 'least-active', 'skill-based'],
    default: 'least-active',
  })
  routing_mode: RoutingMode;

  @Column({ type: 'json', nullable: true })
  working_hours: any;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Conversation, (conversation) => conversation.queue)
  conversations: Conversation[];

  @OneToMany(() => OperatorQueue, (oq) => oq.queue)
  operator_queues: OperatorQueue[];
}

