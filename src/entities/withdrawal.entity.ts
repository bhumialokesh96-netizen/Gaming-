import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { WithdrawalStatus } from '../common/enums';

@Entity('withdrawals')
@Index(['userId', 'status'])
export class Withdrawal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  user: User;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: WithdrawalStatus })
  status: WithdrawalStatus;

  @Column({ nullable: true })
  bankAccount: string;

  @Column({ nullable: true })
  ifscCode: string;

  @Column({ nullable: true })
  rejectionReason: string;

  @Column({ type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ nullable: true })
  approvedAt: Date;

  @Column({ nullable: true })
  processedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
