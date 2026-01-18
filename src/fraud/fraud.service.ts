import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { FraudAlert } from '../entities/fraud-alert.entity';
import { User } from '../entities/user.entity';
import { Game } from '../entities/game.entity';
import { FraudAlertType, FraudAlertStatus, GameStatus } from '../common/enums';

@Injectable()
export class FraudService {
  constructor(
    @InjectRepository(FraudAlert)
    private fraudAlertRepository: Repository<FraudAlert>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
  ) {}

  async checkDeviceFingerprint(
    userId: string,
    deviceInfo: any,
  ): Promise<void> {
    // Check for emulator indicators
    const isEmulator = this.detectEmulator(deviceInfo);
    if (isEmulator) {
      await this.createAlert(
        userId,
        FraudAlertType.EMULATOR_DETECTED,
        'Emulator detected in device fingerprint',
        { deviceInfo },
      );
    }

    // Check for rooted device
    const isRooted = this.detectRootedDevice(deviceInfo);
    if (isRooted) {
      await this.createAlert(
        userId,
        FraudAlertType.ROOTED_DEVICE,
        'Rooted device detected',
        { deviceInfo },
      );
    }
  }

  private detectEmulator(deviceInfo: any): boolean {
    // Simplified emulator detection logic
    const emulatorIndicators = [
      'generic',
      'emulator',
      'sdk_google',
      'Android SDK built for x86',
    ];

    const deviceModel = deviceInfo?.model?.toLowerCase() || '';
    const deviceBrand = deviceInfo?.brand?.toLowerCase() || '';

    return emulatorIndicators.some(
      indicator =>
        deviceModel.includes(indicator) || deviceBrand.includes(indicator),
    );
  }

  private detectRootedDevice(deviceInfo: any): boolean {
    // Simplified root detection
    return deviceInfo?.isRooted === true || deviceInfo?.hasRoot === true;
  }

  async checkWinRatio(userId: string): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const games = await this.gameRepository.find({
      where: [
        {
          player1Id: userId,
          status: GameStatus.COMPLETED,
          completedAt: Between(thirtyDaysAgo, new Date()),
        },
        {
          player2Id: userId,
          status: GameStatus.COMPLETED,
          completedAt: Between(thirtyDaysAgo, new Date()),
        },
      ],
    });

    if (games.length < 10) {
      return; // Not enough data
    }

    const wins = games.filter(game => game.winnerId === userId).length;
    const winRatio = wins / games.length;

    // Flag if win ratio is suspiciously high (>75%)
    if (winRatio > 0.75) {
      await this.createAlert(
        userId,
        FraudAlertType.ABNORMAL_WIN_RATIO,
        `Abnormal win ratio detected: ${(winRatio * 100).toFixed(2)}%`,
        { winRatio, totalGames: games.length, wins },
      );
    }
  }

  async checkCollusion(userId: string, opponentId: string): Promise<void> {
    // Check how many times these users have played together
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const games = await this.gameRepository
      .createQueryBuilder('game')
      .where(
        '((game.player1Id = :userId AND game.player2Id = :opponentId) OR (game.player1Id = :opponentId AND game.player2Id = :userId))',
        { userId, opponentId },
      )
      .andWhere('game.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo })
      .getMany();

    // Flag if users play together too frequently (>5 times in 30 days)
    if (games.length > 5) {
      const userWins = games.filter(game => game.winnerId === userId).length;
      const opponentWins = games.filter(game => game.winnerId === opponentId).length;

      // Check for suspicious win patterns
      if (Math.abs(userWins - opponentWins) > games.length * 0.7) {
        await this.createAlert(
          userId,
          FraudAlertType.COLLUSION,
          `Possible collusion detected with user ${opponentId}`,
          {
            opponentId,
            gamesPlayed: games.length,
            userWins,
            opponentWins,
          },
        );

        await this.createAlert(
          opponentId,
          FraudAlertType.COLLUSION,
          `Possible collusion detected with user ${userId}`,
          {
            opponentId: userId,
            gamesPlayed: games.length,
            userWins: opponentWins,
            opponentWins: userWins,
          },
        );
      }
    }
  }

  async checkMultipleAccounts(phoneNumber: string, deviceId: string): Promise<void> {
    // Check if this device has been used with multiple phone numbers
    const usersWithSameDevice = await this.userRepository.find({
      where: { deviceId },
    });

    if (usersWithSameDevice.length > 1) {
      for (const user of usersWithSameDevice) {
        await this.createAlert(
          user.id,
          FraudAlertType.MULTIPLE_ACCOUNTS,
          'Multiple accounts detected on same device',
          { deviceId, affectedUsers: usersWithSameDevice.map(u => u.id) },
        );
      }
    }
  }

  private async createAlert(
    userId: string,
    alertType: FraudAlertType,
    description: string,
    evidence: Record<string, any>,
  ): Promise<FraudAlert> {
    const alert = this.fraudAlertRepository.create({
      userId,
      alertType,
      status: FraudAlertStatus.FLAGGED,
      description,
      evidence,
    });

    const savedAlert = await this.fraudAlertRepository.save(alert);

    // Auto-lock wallet for critical alerts
    if (
      alertType === FraudAlertType.EMULATOR_DETECTED ||
      alertType === FraudAlertType.COLLUSION
    ) {
      await this.lockUserWallet(userId);
    }

    return savedAlert;
  }

  private async lockUserWallet(userId: string): Promise<void> {
    await this.userRepository.update(userId, { isWalletLocked: true });
    console.log(`Wallet locked for user ${userId} due to fraud alert`);
  }

  async reviewAlert(
    alertId: string,
    adminId: string,
    status: FraudAlertStatus,
    notes: string,
  ): Promise<FraudAlert> {
    const alert = await this.fraudAlertRepository.findOne({
      where: { id: alertId },
    });

    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.status = status;
    alert.reviewedBy = adminId;
    alert.reviewedAt = new Date();
    alert.reviewNotes = notes;

    // Unlock wallet if cleared
    if (status === FraudAlertStatus.CLEARED) {
      await this.userRepository.update(alert.userId, { isWalletLocked: false });
    }

    return this.fraudAlertRepository.save(alert);
  }
}
