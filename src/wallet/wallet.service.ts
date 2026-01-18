import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Ledger } from '../entities/ledger.entity';
import { User } from '../entities/user.entity';
import { TransactionType } from '../common/enums';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Ledger)
    private ledgerRepository: Repository<Ledger>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private dataSource: DataSource,
  ) {}

  async getBalance(userId: string): Promise<{
    available: number;
    locked: number;
    withdrawable: number;
    total: number;
  }> {
    const transactions = await this.ledgerRepository.find({
      where: { userId, isReversed: false },
      order: { createdAt: 'ASC' },
    });

    let available = 0;
    let locked = 0;

    for (const txn of transactions) {
      const amount = parseFloat(txn.amount.toString());

      switch (txn.transactionType) {
        case TransactionType.DEPOSIT:
        case TransactionType.WIN_CREDIT:
        case TransactionType.BET_RELEASE:
          available += amount;
          break;
        case TransactionType.BET_LOCK:
          available -= amount;
          locked += amount;
          break;
        case TransactionType.WITHDRAW_REQUEST:
        case TransactionType.WITHDRAW_SUCCESS:
        case TransactionType.PENALTY:
        case TransactionType.COMMISSION:
          available -= amount;
          break;
      }
    }

    const total = available + locked;
    const withdrawable = available; // Can add additional business logic

    return {
      available: Math.max(0, available),
      locked: Math.max(0, locked),
      withdrawable: Math.max(0, withdrawable),
      total: Math.max(0, total),
    };
  }

  async createTransaction(
    userId: string,
    transactionType: TransactionType,
    amount: number,
    referenceId?: string,
    referenceType?: string,
    metadata?: Record<string, any>,
  ): Promise<Ledger> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get current balance
      const balance = await this.getBalance(userId);

      // Validate transaction
      this.validateTransaction(transactionType, amount, balance);

      // Calculate new balance
      let balanceAfter = balance.total;
      switch (transactionType) {
        case TransactionType.DEPOSIT:
        case TransactionType.WIN_CREDIT:
        case TransactionType.BET_RELEASE:
          balanceAfter += amount;
          break;
        case TransactionType.BET_LOCK:
        case TransactionType.WITHDRAW_REQUEST:
        case TransactionType.WITHDRAW_SUCCESS:
        case TransactionType.PENALTY:
        case TransactionType.COMMISSION:
          balanceAfter -= amount;
          break;
      }

      // Create ledger entry
      const ledger = queryRunner.manager.create(Ledger, {
        userId,
        transactionType,
        amount,
        balanceAfter,
        referenceId,
        referenceType,
        metadata,
      });

      const savedLedger = await queryRunner.manager.save(ledger);
      await queryRunner.commitTransaction();

      return savedLedger;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private validateTransaction(
    type: TransactionType,
    amount: number,
    balance: any,
  ): void {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    switch (type) {
      case TransactionType.BET_LOCK:
        if (balance.available < amount) {
          throw new BadRequestException('Insufficient balance');
        }
        break;
      case TransactionType.WITHDRAW_REQUEST:
        if (balance.withdrawable < amount) {
          throw new BadRequestException('Insufficient withdrawable balance');
        }
        break;
    }
  }

  async lockFunds(
    userId: string,
    amount: number,
    gameId: string,
  ): Promise<Ledger> {
    return this.createTransaction(
      userId,
      TransactionType.BET_LOCK,
      amount,
      gameId,
      'GAME',
      { action: 'lock_for_game' },
    );
  }

  async releaseFunds(
    userId: string,
    amount: number,
    gameId: string,
  ): Promise<Ledger> {
    return this.createTransaction(
      userId,
      TransactionType.BET_RELEASE,
      amount,
      gameId,
      'GAME',
      { action: 'release_after_cancel' },
    );
  }

  async creditWinnings(
    userId: string,
    amount: number,
    gameId: string,
  ): Promise<Ledger> {
    return this.createTransaction(
      userId,
      TransactionType.WIN_CREDIT,
      amount,
      gameId,
      'GAME',
      { action: 'win_credit' },
    );
  }

  async deductCommission(
    userId: string,
    amount: number,
    gameId: string,
  ): Promise<Ledger> {
    return this.createTransaction(
      userId,
      TransactionType.COMMISSION,
      amount,
      gameId,
      'GAME',
      { action: 'platform_commission' },
    );
  }
}
