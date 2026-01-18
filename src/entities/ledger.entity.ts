import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { TransactionType } from '../common/enums';

@Entity('ledger')
@Index(['userId', 'createdAt'])
@Index(['transactionType', 'createdAt'])
export class Ledger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User)
  user: User;

  @Column({ type: 'enum', enum: TransactionType })
  transactionType: TransactionType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  balanceAfter: number;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  referenceId: string; // Game ID, Withdrawal ID, etc.

  @Column({ type: 'varchar', nullable: true })
  referenceType: string; // 'GAME', 'WITHDRAWAL', 'DEPOSIT'

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ default: false })
  isReversed: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
