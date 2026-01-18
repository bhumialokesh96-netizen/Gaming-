import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../entities/game.entity';
import { GameStatus } from '../common/enums';

interface GameState {
  board: number[];
  turn: string;
  player1Position: number[];
  player2Position: number[];
  lastDiceRoll?: number;
}

@Injectable()
export class GameService {
  constructor(
    @InjectRepository(Game)
    private gameRepository: Repository<Game>,
  ) {}

  async getGame(gameId: string): Promise<Game> {
    const game = await this.gameRepository.findOne({ where: { id: gameId } });
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    return game;
  }

  async startGame(gameId: string): Promise<Game> {
    const game = await this.getGame(gameId);

    if (game.status !== GameStatus.WAITING) {
      throw new BadRequestException('Game already started');
    }

    game.status = GameStatus.IN_PROGRESS;
    game.startedAt = new Date();
    game.gameState = {
      board: [],
      turn: game.player1Id,
      player1Position: [0, 0, 0, 0],
      player2Position: [0, 0, 0, 0],
    };

    return this.gameRepository.save(game);
  }

  async rollDice(
    gameId: string,
    userId: string,
  ): Promise<{ diceValue: number; game: Game }> {
    const game = await this.getGame(gameId);

    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new BadRequestException('Game not in progress');
    }

    const state = game.gameState as GameState;

    if (state.turn !== userId) {
      throw new BadRequestException('Not your turn');
    }

    // Server-authoritative RNG
    const diceValue = Math.floor(Math.random() * 6) + 1;

    state.lastDiceRoll = diceValue;
    game.gameState = state;

    await this.gameRepository.save(game);

    return { diceValue, game };
  }

  async makeMove(
    gameId: string,
    userId: string,
    pieceIndex: number,
  ): Promise<Game> {
    const game = await this.getGame(gameId);

    if (game.status !== GameStatus.IN_PROGRESS) {
      throw new BadRequestException('Game not in progress');
    }

    const state = game.gameState as GameState;

    if (state.turn !== userId) {
      throw new BadRequestException('Not your turn');
    }

    if (!state.lastDiceRoll) {
      throw new BadRequestException('Roll dice first');
    }

    // Validate move
    const isPlayer1 = userId === game.player1Id;
    const positions = isPlayer1 ? state.player1Position : state.player2Position;

    if (pieceIndex < 0 || pieceIndex >= positions.length) {
      throw new BadRequestException('Invalid piece index');
    }

    // Apply move (simplified Ludo logic)
    positions[pieceIndex] += state.lastDiceRoll;

    // Check for win condition
    const allPiecesHome = positions.every((pos) => pos >= 57);

    if (allPiecesHome) {
      game.status = GameStatus.COMPLETED;
      game.winnerId = userId;
      game.completedAt = new Date();
      game.finalResult = {
        winner: userId,
        positions: {
          player1: state.player1Position,
          player2: state.player2Position,
        },
      };
    } else {
      // Switch turn (unless rolled 6)
      if (state.lastDiceRoll !== 6) {
        state.turn =
          state.turn === game.player1Id ? game.player2Id : game.player1Id;
      }
      state.lastDiceRoll = undefined;
    }

    game.gameState = state;
    return this.gameRepository.save(game);
  }

  async handleDisconnect(gameId: string, userId: string): Promise<void> {
    const game = await this.getGame(gameId);

    if (game.status === GameStatus.IN_PROGRESS) {
      // Store disconnect timestamp for reconnection handling
      const state = game.gameState as any;
      state.disconnects = state.disconnects || {};
      state.disconnects[userId] = Date.now();
      game.gameState = state;
      await this.gameRepository.save(game);
    }
  }

  async handleReconnect(gameId: string, userId: string): Promise<Game> {
    const game = await this.getGame(gameId);

    // Clear disconnect timestamp
    const state = game.gameState as any;
    if (state.disconnects && state.disconnects[userId]) {
      delete state.disconnects[userId];
      game.gameState = state;
      await this.gameRepository.save(game);
    }

    return game;
  }
}
