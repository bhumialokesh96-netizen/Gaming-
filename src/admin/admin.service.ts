import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Withdrawal } from '../entities/withdrawal.entity';
import { Game } from '../entities/game.entity';
import { GameConfig } from '../entities/game-config.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { FraudAlert } from '../entities/fraud-alert.entity';
import { WithdrawalStatus, GameStatus } from '../common/enums';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Withdrawal)
    private withdrawalRepository: Repository<Withdrawal>,
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
    @InjectRepository(GameConfig)
    private gameConfigRepository: Repository<GameConfig>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    @InjectRepository(FraudAlert)
    private fraudAlertRepository: Repository<FraudAlert>,
  ) {}

  async createAuditLog(
    adminId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata: any,
    ipAddress: string,
  ): Promise<void> {
    const log = this.auditLogRepository.create({
      adminId,
      action,
      resourceType,
      resourceId,
      metadata,
      ipAddress,
    });
    await this.auditLogRepository.save(log);
  }

  // Game Configuration
  async createGameConfig(
    adminId: string,
    gameType: string,
    stakeLevels: number[],
    commissionPercent: number,
    rules: any,
    ipAddress: string,
  ): Promise<GameConfig> {
    const config = this.gameConfigRepository.create({
      gameType,
      stakeLevels,
      commissionPercent,
      rules,
    });

    const saved = await this.gameConfigRepository.save(config);

    await this.createAuditLog(
      adminId,
      'CREATE_GAME_CONFIG',
      'GAME_CONFIG',
      saved.id,
      { gameType, stakeLevels, commissionPercent },
      ipAddress,
    );

    return saved;
  }

  async updateGameConfig(
    adminId: string,
    configId: string,
    updates: Partial<GameConfig>,
    ipAddress: string,
  ): Promise<GameConfig> {
    const config = await this.gameConfigRepository.findOne({
      where: { id: configId },
    });

    if (!config) {
      throw new NotFoundException('Game config not found');
    }

    Object.assign(config, updates);
    const updated = await this.gameConfigRepository.save(config);

    await this.createAuditLog(
      adminId,
      'UPDATE_GAME_CONFIG',
      'GAME_CONFIG',
      configId,
      updates,
      ipAddress,
    );

    return updated;
  }

  async getGameConfigs(): Promise<GameConfig[]> {
    return this.gameConfigRepository.find();
  }

  // Withdrawal Management
  async getPendingWithdrawals(): Promise<Withdrawal[]> {
    return this.withdrawalRepository.find({
      where: { status: WithdrawalStatus.PENDING },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async approveWithdrawal(
    adminId: string,
    withdrawalId: string,
    ipAddress: string,
  ): Promise<Withdrawal> {
    const withdrawal = await this.withdrawalRepository.findOne({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException('Withdrawal already processed');
    }

    withdrawal.status = WithdrawalStatus.APPROVED;
    withdrawal.approvedBy = adminId;
    withdrawal.approvedAt = new Date();

    const updated = await this.withdrawalRepository.save(withdrawal);

    await this.createAuditLog(
      adminId,
      'APPROVE_WITHDRAWAL',
      'WITHDRAWAL',
      withdrawalId,
      { amount: withdrawal.amount, userId: withdrawal.userId },
      ipAddress,
    );

    return updated;
  }

  async rejectWithdrawal(
    adminId: string,
    withdrawalId: string,
    reason: string,
    ipAddress: string,
  ): Promise<Withdrawal> {
    const withdrawal = await this.withdrawalRepository.findOne({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException('Withdrawal already processed');
    }

    withdrawal.status = WithdrawalStatus.REJECTED;
    withdrawal.rejectionReason = reason;
    withdrawal.approvedBy = adminId;
    withdrawal.approvedAt = new Date();

    const updated = await this.withdrawalRepository.save(withdrawal);

    await this.createAuditLog(
      adminId,
      'REJECT_WITHDRAWAL',
      'WITHDRAWAL',
      withdrawalId,
      { amount: withdrawal.amount, userId: withdrawal.userId, reason },
      ipAddress,
    );

    return updated;
  }

  // Live Match Monitoring
  async getLiveMatches(): Promise<Game[]> {
    return this.gameRepository.find({
      where: { status: GameStatus.IN_PROGRESS },
      order: { startedAt: 'DESC' },
      take: 100,
    });
  }

  async getGameDetails(gameId: string): Promise<Game> {
    const game = await this.gameRepository.findOne({
      where: { id: gameId },
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    return game;
  }

  // User Management
  async lockUserAccount(
    adminId: string,
    userId: string,
    ipAddress: string,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isActive = false;
    const updated = await this.userRepository.save(user);

    await this.createAuditLog(
      adminId,
      'LOCK_USER_ACCOUNT',
      'USER',
      userId,
      { phoneNumber: user.phoneNumber },
      ipAddress,
    );

    return updated;
  }

  async unlockUserAccount(
    adminId: string,
    userId: string,
    ipAddress: string,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isActive = true;
    const updated = await this.userRepository.save(user);

    await this.createAuditLog(
      adminId,
      'UNLOCK_USER_ACCOUNT',
      'USER',
      userId,
      { phoneNumber: user.phoneNumber },
      ipAddress,
    );

    return updated;
  }

  // Fraud Management
  async getFraudAlerts(status?: string): Promise<FraudAlert[]> {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    return this.fraudAlertRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  // Audit Logs
  async getAuditLogs(
    adminId?: string,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    const where: any = {};
    if (adminId) {
      where.adminId = adminId;
    }

    return this.auditLogRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
