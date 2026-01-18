import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { IsNumber, IsString, IsPositive, Min } from 'class-validator';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { TransactionType } from '../common/enums';

class DepositDto {
  @IsNumber()
  @IsPositive()
  @Min(1)
  amount: number;

  @IsString()
  paymentMethod: string;

  @IsString()
  transactionId: string;
}

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get('balance')
  async getBalance(@CurrentUser() user: User) {
    return this.walletService.getBalance(user.id);
  }

  @Post('deposit')
  async deposit(@CurrentUser() user: User, @Body() dto: DepositDto) {
    // In production, verify payment with payment gateway
    const ledger = await this.walletService.createTransaction(
      user.id,
      TransactionType.DEPOSIT,
      dto.amount,
      dto.transactionId,
      'PAYMENT',
      { paymentMethod: dto.paymentMethod },
    );

    return {
      message: 'Deposit successful',
      transaction: ledger,
    };
  }
}
