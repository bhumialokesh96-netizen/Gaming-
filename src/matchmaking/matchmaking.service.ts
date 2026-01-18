import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Game } from '../entities/game.entity';
import { WalletService } from '../wallet/wallet.service';
import { GameStatus, MatchmakingStatus } from '../common/enums';
import { ConfigService } from '@nestjs/config';

interface MatchmakingEntry {
  userId: string;
  stakeAmount: number;
  timestamp: number;
  status: MatchmakingStatus;
}

@Injectable()
export class MatchmakingService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    private walletService: WalletService,
    private configService: ConfigService,
  ) {
    this.startTimeoutChecker();
  }

  private getQueueKey(stakeAmount: number): string {
    return `matchmaking:queue:${stakeAmount}`;
  }

  private getUserKey(userId: string): string {
    return `matchmaking:user:${userId}`;
  }

  async joinMatchmaking(
    userId: string,
    stakeAmount: number,
  ): Promise<{ status: string; gameId?: string }> {
    // Check if user already in matchmaking
    const existing = await this.redis.get(this.getUserKey(userId));
    if (existing) {
      throw new BadRequestException('Already in matchmaking');
    }

    // Lock funds
    await this.walletService.lockFunds(userId, stakeAmount, 'PENDING');

    const entry: MatchmakingEntry = {
      userId,
      stakeAmount,
      timestamp: Date.now(),
      status: MatchmakingStatus.SEARCHING,
    };

    // Add to queue
    const queueKey = this.getQueueKey(stakeAmount);
    await this.redis.lpush(queueKey, JSON.stringify(entry));
    await this.redis.set(
      this.getUserKey(userId),
      JSON.stringify(entry),
      'EX',
      120,
    );

    // Try to match immediately
    const match = await this.tryMatch(stakeAmount);

    if (match) {
      return { status: 'matched', gameId: match.id };
    }

    return { status: 'searching' };
  }

  async cancelMatchmaking(userId: string): Promise<void> {
    const userKey = this.getUserKey(userId);
    const entryStr = await this.redis.get(userKey);

    if (!entryStr) {
      throw new BadRequestException('Not in matchmaking');
    }

    const entry: MatchmakingEntry = JSON.parse(entryStr);

    // Remove from queue
    const queueKey = this.getQueueKey(entry.stakeAmount);
    const queueEntries = await this.redis.lrange(queueKey, 0, -1);

    for (const queueEntry of queueEntries) {
      const parsedEntry: MatchmakingEntry = JSON.parse(queueEntry);
      if (parsedEntry.userId === userId) {
        await this.redis.lrem(queueKey, 1, queueEntry);
        break;
      }
    }

    // Release funds
    await this.walletService.releaseFunds(
      userId,
      entry.stakeAmount,
      'CANCELLED',
    );

    // Remove user entry
    await this.redis.del(userKey);
  }

  private async tryMatch(stakeAmount: number): Promise<Game | null> {
    const queueKey = this.getQueueKey(stakeAmount);

    // Get first two players from queue
    const entries = await this.redis.lrange(queueKey, 0, 1);

    if (entries.length < 2) {
      return null;
    }

    const player1: MatchmakingEntry = JSON.parse(entries[0]);
    const player2: MatchmakingEntry = JSON.parse(entries[1]);

    // Remove from queue
    await this.redis.lrem(queueKey, 1, entries[0]);
    await this.redis.lrem(queueKey, 1, entries[1]);

    // Create game
    const commissionPercent = this.configService.get<number>(
      'PLATFORM_COMMISSION_PERCENT',
      10,
    );
    const totalStake = stakeAmount * 2;
    const commissionAmount = (totalStake * commissionPercent) / 100;

    const game = this.gameRepository.create({
      player1Id: player1.userId,
      player2Id: player2.userId,
      stakeAmount,
      commissionAmount,
      status: GameStatus.WAITING,
      gameState: { board: [], turn: player1.userId },
    });

    const savedGame = await this.gameRepository.save(game);

    // Clean up user entries
    await this.redis.del(this.getUserKey(player1.userId));
    await this.redis.del(this.getUserKey(player2.userId));

    return savedGame;
  }

  private startTimeoutChecker() {
    setInterval(async () => {
      // TODO: Fetch stake levels from GameConfig entity for dynamic management
      // For now using common stake levels as fallback
      const stakes = [10, 50, 100, 500, 1000];

      for (const stake of stakes) {
        const queueKey = this.getQueueKey(stake);
        const entries = await this.redis.lrange(queueKey, 0, -1);

        const now = Date.now();
        const timeout =
          this.configService.get<number>('MATCHMAKING_TIMEOUT_SECONDS', 120) *
          1000;

        for (const entryStr of entries) {
          const entry: MatchmakingEntry = JSON.parse(entryStr);

          if (now - entry.timestamp > timeout) {
            // Timeout - cancel and refund
            await this.redis.lrem(queueKey, 1, entryStr);
            await this.walletService.releaseFunds(
              entry.userId,
              entry.stakeAmount,
              'TIMEOUT',
            );
            await this.redis.del(this.getUserKey(entry.userId));
          }
        }
      }
    }, 10000); // Check every 10 seconds
  }
}
