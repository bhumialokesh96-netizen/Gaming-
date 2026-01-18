import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('game_configs')
export class GameConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  gameType: string; // 'LUDO', 'POKER', etc.

  @Column({ type: 'jsonb' })
  stakeLevels: number[]; // [10, 50, 100, 500, 1000]

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  commissionPercent: number;

  @Column({ type: 'int', default: 120 })
  matchmakingTimeoutSeconds: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  rules: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
