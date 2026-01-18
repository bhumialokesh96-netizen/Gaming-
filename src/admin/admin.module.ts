import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../entities/user.entity';
import { Withdrawal } from '../entities/withdrawal.entity';
import { Game } from '../entities/game.entity';
import { GameConfig } from '../entities/game-config.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { FraudAlert } from '../entities/fraud-alert.entity';
import { FraudModule } from '../fraud/fraud.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Withdrawal,
      Game,
      GameConfig,
      AuditLog,
      FraudAlert,
    ]),
    FraudModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
