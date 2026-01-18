import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettlementService } from './settlement.service';
import { Game } from '../entities/game.entity';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [TypeOrmModule.forFeature([Game]), WalletModule],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
