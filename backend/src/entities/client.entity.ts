import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn()
  client_id: number;

  @Column({ type: 'varchar', length: 13, unique: true })
  phone: string; // +992987654321

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'enum', enum: ['web', 'mobile'], default: 'web' })
  channel: 'web' | 'mobile';

  @Column({ type: 'varchar', length: 100, nullable: true })
  account_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  contract: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  personal_account: string;

  @Column({ type: 'enum', enum: ['ru', 'tj'], default: 'ru' })
  language: 'ru' | 'tj';

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Conversation, (conversation) => conversation.client)
  conversations: Conversation[];
}

