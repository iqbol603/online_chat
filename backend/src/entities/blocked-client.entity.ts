import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Operator } from './operator.entity';

@Entity('blocked_clients')
export class BlockedClient {
  @PrimaryGeneratedColumn()
  blocked_id: number;

  @Column({ type: 'varchar', length: 13 })
  phone: string; // +992987654321

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  reason: string; // Причина блокировки

  @Column({ nullable: true })
  blocked_by_operator_id: number; // Кто заблокировал

  @ManyToOne(() => Operator, { nullable: true })
  @JoinColumn({ name: 'blocked_by_operator_id' })
  blocked_by_operator: Operator;

  @CreateDateColumn()
  blocked_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  unblocked_at: Date | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean; // Активна ли блокировка
}
