import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { GameStatus } from '../common/enums';

@Entity('games')
@Index(['status', 'createdAt'])
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  player1Id: string;

  @Column({ type: 'uuid' })
  @Index()
  player2Id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  stakeAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  commissionAmount: number;

  @Column({ type: 'enum', enum: GameStatus })
  status: GameStatus;

  @Column({ type: 'uuid', nullable: true })
  winnerId: string;

  @Column({ type: 'jsonb', nullable: true })
  gameState: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  finalResult: Record<string, any>;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
