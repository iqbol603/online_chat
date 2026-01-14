import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Conversation } from './conversation.entity';

export type SenderType = 'client' | 'bot' | 'operator' | 'system';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  message_id: number;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column()
  @Index()
  conversation_id: number;

  @Column({
    type: 'enum',
    enum: ['client', 'bot', 'operator', 'system'],
  })
  sender_type: SenderType;

  @Column({ nullable: true })
  @Index()
  sender_id: number; // ID клиента или оператора

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'json', nullable: true })
  attachments: any[];

  @Column({ type: 'timestamp', nullable: true })
  read_by_operator_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  read_by_client_at: Date;

  @CreateDateColumn()
  @Index()
  created_at: Date;
}

