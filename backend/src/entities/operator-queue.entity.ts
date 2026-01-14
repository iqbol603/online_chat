import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Operator } from './operator.entity';
import { Queue } from './queue.entity';

@Entity('operator_queues')
export class OperatorQueue {
  @PrimaryColumn()
  operator_id: number;

  @PrimaryColumn()
  queue_id: number;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Operator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operator_id' })
  operator: Operator;

  @ManyToOne(() => Queue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'queue_id' })
  @Index()
  queue: Queue;
}

