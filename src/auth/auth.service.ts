import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { OtpVerification } from '../entities/otp-verification.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(OtpVerification)
    private otpRepository: Repository<OtpVerification>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async sendOtp(phoneNumber: string): Promise<{ message: string }> {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryMinutes = this.configService.get<number>(
      'OTP_EXPIRY_MINUTES',
      5,
    );
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiryMinutes);

    // Save OTP to database
    const otpVerification = this.otpRepository.create({
      phoneNumber,
      otp,
      expiresAt,
    });
    await this.otpRepository.save(otpVerification);

    // In production, integrate with SMS service (Twilio, AWS SNS, etc.)
    console.log(`OTP for ${phoneNumber}: ${otp}`);

    return { message: 'OTP sent successfully' };
  }

  async verifyOtpAndLogin(
    phoneNumber: string,
    otp: string,
    deviceId: string,
  ): Promise<{ accessToken: string; user: User }> {
    // Find valid OTP
    const otpVerification = await this.otpRepository.findOne({
      where: { phoneNumber, otp, isVerified: false },
      order: { createdAt: 'DESC' },
    });

    if (!otpVerification) {
      throw new UnauthorizedException('Invalid OTP');
    }

    if (new Date() > otpVerification.expiresAt) {
      throw new UnauthorizedException('OTP expired');
    }

    // Mark OTP as verified
    otpVerification.isVerified = true;
    await this.otpRepository.save(otpVerification);

    // Find or create user
    let user = await this.userRepository.findOne({ where: { phoneNumber } });

    if (!user) {
      // Create new user
      user = this.userRepository.create({
        phoneNumber,
        deviceId,
      });
      await this.userRepository.save(user);
    } else {
      // Check device binding
      if (user.deviceId && user.deviceId !== deviceId) {
        throw new ConflictException(
          'This account is bound to another device. Contact support to unbind.',
        );
      }

      // Bind device if not already bound
      if (!user.deviceId) {
        user.deviceId = deviceId;
        await this.userRepository.save(user);
      }

      // Check if account is active
      if (!user.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }
    }

    // Generate JWT token
    const payload = {
      sub: user.id,
      phoneNumber: user.phoneNumber,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken, user };
  }

  async validateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid user');
    }
    return user;
  }
}
