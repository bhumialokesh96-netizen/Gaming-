import { Controller, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../entities/user.entity';

class JoinMatchmakingDto {
  stakeAmount: number;
}

@Controller('matchmaking')
@UseGuards(JwtAuthGuard)
export class MatchmakingController {
  constructor(private matchmakingService: MatchmakingService) {}

  @Post('join')
  async join(@CurrentUser() user: User, @Body() dto: JoinMatchmakingDto) {
    return this.matchmakingService.joinMatchmaking(user.id, dto.stakeAmount);
  }

  @Delete('cancel')
  async cancel(@CurrentUser() user: User) {
    await this.matchmakingService.cancelMatchmaking(user.id);
    return { message: 'Matchmaking cancelled' };
  }
}
