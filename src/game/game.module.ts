import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { Game } from '../entities/game.entity';
import { WalletModule } from '../wallet/wallet.module';
import { SettlementModule } from '../settlement/settlement.module';

@Module({
  imports: [TypeOrmModule.forFeature([Game]), WalletModule, SettlementModule],
  providers: [GameGateway, GameService],
  exports: [GameService],
})
export class GameModule {}
