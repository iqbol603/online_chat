import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Client } from './client.entity';
import { Operator } from './operator.entity';
import { Queue } from './queue.entity';
import { Message } from './message.entity';

export type ConversationStatus = 'bot' | 'queued' | 'assigned' | 'in_progress' | 'closed';
export type ConversationPriority = 'low' | 'normal' | 'high' | 'critical';
export type ConversationClosedByType = 'client' | 'operator';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn()
  conversation_id: number;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column()
  @Index()
  client_id: number;

  @Column({
    type: 'enum',
    enum: ['bot', 'queued', 'assigned', 'in_progress', 'closed'],
    default: 'bot',
  })
  @Index()
  status: ConversationStatus;

  @Column({
    type: 'enum',
    enum: ['low', 'normal', 'high', 'critical'],
    default: 'normal',
  })
  priority: ConversationPriority;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department: string;

  @ManyToOne(() => Queue, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'queue_id' })
  queue: Queue;

  @Column({ nullable: true })
  @Index()
  queue_id: number;

  @ManyToOne(() => Operator, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_operator_id' })
  assigned_operator: Operator;

  @Column({ nullable: true })
  @Index()
  assigned_operator_id: number;

  @Column({ type: 'json', nullable: true })
  tags: string[];

  @Column({ type: 'int', nullable: true })
  rating: number;

  @Column({ type: 'text', nullable: true })
  rating_comment: string;

  @CreateDateColumn()
  @Index()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  closed_at: Date;

  @Column({
    type: 'enum',
    enum: ['client', 'operator'],
    nullable: true,
  })
  closed_by_type: ConversationClosedByType;

  @Column({ type: 'int', nullable: true })
  closed_by_operator_id: number;

  @Column({ type: 'timestamp', nullable: true })
  queued_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  assigned_at: Date;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];
}

