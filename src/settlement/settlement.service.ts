import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Game } from '../entities/game.entity';
import { WalletService } from '../wallet/wallet.service';
import { GameStatus } from '../common/enums';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SettlementService {
  private settledGames: Set<string> = new Set(); // Idempotency tracking

  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    private walletService: WalletService,
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {}

  async settleGame(gameId: string): Promise<void> {
    // Idempotency check
    if (this.settledGames.has(gameId)) {
      console.log(`Game ${gameId} already settled`);
      return;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const game = await queryRunner.manager.findOne(Game, {
        where: { id: gameId },
      });

      if (!game) {
        throw new BadRequestException('Game not found');
      }

      if (game.status !== GameStatus.COMPLETED) {
        throw new BadRequestException('Game not completed');
      }

      if (!game.winnerId) {
        throw new BadRequestException('No winner determined');
      }

      // Validate winner
      if (game.winnerId !== game.player1Id && game.winnerId !== game.player2Id) {
        throw new BadRequestException('Invalid winner');
      }

      const loserId = game.winnerId === game.player1Id ? game.player2Id : game.player1Id;

      // Calculate amounts
      const totalStake = parseFloat(game.stakeAmount.toString()) * 2;
      const commission = parseFloat(game.commissionAmount.toString());
      const winnerAmount = totalStake - commission;

      // Credit winner (locked funds are released and winnings added)
      await this.walletService.creditWinnings(
        game.winnerId,
        winnerAmount,
        game.id,
      );

      // Deduct commission from winner's winnings (already calculated above)
      // The commission is implicitly taken by giving winner less than totalStake

      // Loser's stake remains locked and is transferred to winner
      // No need to explicitly debit loser as funds were already locked

      await queryRunner.commitTransaction();

      // Mark as settled
      this.settledGames.add(gameId);

      console.log(`Game ${gameId} settled: Winner ${game.winnerId} receives ${winnerAmount}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async validateAndSettleGame(
    gameId: string,
    winnerId: string,
    gameResult: any,
  ): Promise<void> {
    const game = await this.gameRepository.findOne({ where: { id: gameId } });

    if (!game) {
      throw new BadRequestException('Game not found');
    }

    // Validate result
    if (winnerId !== game.player1Id && winnerId !== game.player2Id) {
      throw new BadRequestException('Invalid winner');
    }

    // Additional validation logic can be added here
    // e.g., verify game state, moves, etc.

    // Update game with final result
    game.status = GameStatus.COMPLETED;
    game.winnerId = winnerId;
    game.completedAt = new Date();
    game.finalResult = gameResult;

    await this.gameRepository.save(game);

    // Settle
    await this.settleGame(gameId);
  }

  async cancelGameAndRefund(gameId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const game = await queryRunner.manager.findOne(Game, {
        where: { id: gameId },
      });

      if (!game) {
        throw new BadRequestException('Game not found');
      }

      if (game.status === GameStatus.COMPLETED) {
        throw new BadRequestException('Game already completed');
      }

      // Refund both players
      await this.walletService.releaseFunds(
        game.player1Id,
        parseFloat(game.stakeAmount.toString()),
        game.id,
      );

      await this.walletService.releaseFunds(
        game.player2Id,
        parseFloat(game.stakeAmount.toString()),
        game.id,
      );

      // Update game status
      game.status = GameStatus.CANCELLED;
      await queryRunner.manager.save(game);

      await queryRunner.commitTransaction();

      console.log(`Game ${gameId} cancelled and refunded`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
