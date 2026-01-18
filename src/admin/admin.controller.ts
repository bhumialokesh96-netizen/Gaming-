import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FraudService } from '../fraud/fraud.service';

// Simple admin guard - in production, check user role
class AdminGuard extends JwtAuthGuard {}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private fraudService: FraudService,
  ) {}

  // Game Configuration
  @Post('game-config')
  async createGameConfig(@Body() dto: any, @Req() req: any) {
    return this.adminService.createGameConfig(
      req.user.id,
      dto.gameType,
      dto.stakeLevels,
      dto.commissionPercent,
      dto.rules,
      req.ip,
    );
  }

  @Put('game-config/:id')
  async updateGameConfig(
    @Param('id') id: string,
    @Body() dto: any,
    @Req() req: any,
  ) {
    return this.adminService.updateGameConfig(req.user.id, id, dto, req.ip);
  }

  @Get('game-config')
  async getGameConfigs() {
    return this.adminService.getGameConfigs();
  }

  // Withdrawal Management
  @Get('withdrawals/pending')
  async getPendingWithdrawals() {
    return this.adminService.getPendingWithdrawals();
  }

  @Post('withdrawals/:id/approve')
  async approveWithdrawal(@Param('id') id: string, @Req() req: any) {
    return this.adminService.approveWithdrawal(req.user.id, id, req.ip);
  }

  @Post('withdrawals/:id/reject')
  async rejectWithdrawal(
    @Param('id') id: string,
    @Body() dto: { reason: string },
    @Req() req: any,
  ) {
    return this.adminService.rejectWithdrawal(
      req.user.id,
      id,
      dto.reason,
      req.ip,
    );
  }

  // Live Match Monitoring
  @Get('matches/live')
  async getLiveMatches() {
    return this.adminService.getLiveMatches();
  }

  @Get('matches/:id')
  async getGameDetails(@Param('id') id: string) {
    return this.adminService.getGameDetails(id);
  }

  // User Management
  @Post('users/:id/lock')
  async lockUser(@Param('id') id: string, @Req() req: any) {
    return this.adminService.lockUserAccount(req.user.id, id, req.ip);
  }

  @Post('users/:id/unlock')
  async unlockUser(@Param('id') id: string, @Req() req: any) {
    return this.adminService.unlockUserAccount(req.user.id, id, req.ip);
  }

  // Fraud Management
  @Get('fraud-alerts')
  async getFraudAlerts(@Query('status') status?: string) {
    return this.adminService.getFraudAlerts(status);
  }

  @Post('fraud-alerts/:id/review')
  async reviewFraudAlert(
    @Param('id') id: string,
    @Body() dto: { status: any; notes: string },
    @Req() req: any,
  ) {
    return this.fraudService.reviewAlert(
      id,
      req.user.id,
      dto.status,
      dto.notes,
    );
  }

  // Audit Logs
  @Get('audit-logs')
  async getAuditLogs(@Query('adminId') adminId?: string) {
    return this.adminService.getAuditLogs(adminId);
  }
}
