import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
  Index,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { OperatorQueue } from './operator-queue.entity';

export type OperatorRole = 'operator' | 'admin' | 'supervisor';
export type OperatorStatus = 'online' | 'away' | 'offline';

@Entity('operators')
export class Operator {
  @PrimaryGeneratedColumn()
  operator_id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  @Index()
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 255 })
  password_hash: string;

  @Column({
    type: 'enum',
    enum: ['operator', 'admin', 'supervisor'],
    default: 'operator',
  })
  role: OperatorRole;

  @Column({
    type: 'enum',
    enum: ['online', 'away', 'offline'],
    default: 'offline',
  })
  @Index()
  status_presence: OperatorStatus;

  @Column({ type: 'int', default: 5 })
  max_active_chats: number;

  @Column({ type: 'timestamp', nullable: true })
  last_seen_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Conversation, (conversation) => conversation.assigned_operator)
  conversations: Conversation[];

  @OneToMany(() => OperatorQueue, (oq) => oq.operator)
  operator_queues: OperatorQueue[];
}

