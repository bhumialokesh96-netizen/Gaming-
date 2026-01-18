import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { GameService } from './game.service';
import { SettlementService } from '../settlement/settlement.service';

@WebSocketGateway({ cors: true })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private activeSockets: Map<string, string> = new Map(); // socketId -> userId

  constructor(
    private gameService: GameService,
    private settlementService: SettlementService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const userId = this.activeSockets.get(client.id);
    if (userId) {
      // Handle graceful disconnect
      console.log(`User ${userId} disconnected`);
      this.activeSockets.delete(client.id);
    }
  }

  @SubscribeMessage('join_game')
  async handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; userId: string },
  ) {
    try {
      const game = await this.gameService.getGame(data.gameId);
      
      // Verify user is part of this game
      if (game.player1Id !== data.userId && game.player2Id !== data.userId) {
        return { error: 'Unauthorized' };
      }

      // Join game room
      client.join(data.gameId);
      this.activeSockets.set(client.id, data.userId);

      // Handle reconnection
      await this.gameService.handleReconnect(data.gameId, data.userId);

      // Notify other player
      client.to(data.gameId).emit('player_joined', { userId: data.userId });

      return { success: true, game };
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('start_game')
  async handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
  ) {
    try {
      const game = await this.gameService.startGame(data.gameId);
      this.server.to(data.gameId).emit('game_started', game);
      return { success: true, game };
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('roll_dice')
  async handleRollDice(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; userId: string },
  ) {
    try {
      const result = await this.gameService.rollDice(data.gameId, data.userId);
      this.server.to(data.gameId).emit('dice_rolled', {
        userId: data.userId,
        diceValue: result.diceValue,
        gameState: result.game.gameState,
      });
      return { success: true, diceValue: result.diceValue };
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('make_move')
  async handleMakeMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; userId: string; pieceIndex: number },
  ) {
    try {
      const game = await this.gameService.makeMove(
        data.gameId,
        data.userId,
        data.pieceIndex,
      );

      this.server.to(data.gameId).emit('move_made', {
        userId: data.userId,
        pieceIndex: data.pieceIndex,
        gameState: game.gameState,
      });

      // Check if game completed
      if (game.status === 'COMPLETED') {
        // Settle the game
        await this.settlementService.settleGame(game.id);
        this.server.to(data.gameId).emit('game_completed', {
          winnerId: game.winnerId,
          finalResult: game.finalResult,
        });
      }

      return { success: true, game };
    } catch (error) {
      return { error: error.message };
    }
  }
}
