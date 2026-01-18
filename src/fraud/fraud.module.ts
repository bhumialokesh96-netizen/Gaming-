import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FraudService } from './fraud.service';
import { FraudAlert } from '../entities/fraud-alert.entity';
import { User } from '../entities/user.entity';
import { Game } from '../entities/game.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FraudAlert, User, Game])],
  providers: [FraudService],
  exports: [FraudService],
})
export class FraudModule {}
