import prisma from '../config/database';
import { GameStatus } from '@prisma/client';

export interface CreateGameInput {
  creatorId: string;
  timeControl: number | null; // seconds: 60, 180, 300, or null
}

export interface GameWithPlayers {
  id: string;
  status: GameStatus;
  timeControl: number | null;
  createdAt: Date;
  whitePlayerId: string | null;
  blackPlayerId: string | null;
  whiteTimeRemaining: number | null;
  blackTimeRemaining: number | null;
  lastMoveAt: Date | null;
  pgn: string | null;
  creator: {
    id: string;
    username: string;
  };
  whitePlayer: {
    id: string;
    username: string;
  } | null;
  blackPlayer: {
    id: string;
    username: string;
  } | null;
}

export const gameService = {
  async createGame(input: CreateGameInput): Promise<GameWithPlayers> {
    const { creatorId, timeControl } = input;

    // Check if user already has an active game
    const existingGame = await prisma.game.findFirst({
      where: {
        OR: [
          { creatorId, status: { in: ['WAITING', 'IN_PROGRESS'] } },
          { whitePlayerId: creatorId, status: 'IN_PROGRESS' },
          { blackPlayerId: creatorId, status: 'IN_PROGRESS' },
        ],
      },
    });

    if (existingGame) {
      throw new Error('You already have an active game');
    }

    const game = await prisma.game.create({
      data: {
        creatorId,
        timeControl,
        status: 'WAITING',
      },
      include: {
        creator: {
          select: { id: true, username: true },
        },
        whitePlayer: {
          select: { id: true, username: true },
        },
        blackPlayer: {
          select: { id: true, username: true },
        },
      },
    });

    return game;
  },

  async getAvailableGames(): Promise<GameWithPlayers[]> {
    const games = await prisma.game.findMany({
      where: {
        status: 'WAITING',
      },
      include: {
        creator: {
          select: { id: true, username: true },
        },
        whitePlayer: {
          select: { id: true, username: true },
        },
        blackPlayer: {
          select: { id: true, username: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return games;
  },

  async getGameById(id: string): Promise<GameWithPlayers | null> {
    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, username: true },
        },
        whitePlayer: {
          select: { id: true, username: true },
        },
        blackPlayer: {
          select: { id: true, username: true },
        },
      },
    });

    return game;
  },

  async joinGame(gameId: string, playerId: string): Promise<GameWithPlayers> {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    if (game.status !== 'WAITING') {
      throw new Error('Game is not available');
    }

    if (game.creatorId === playerId) {
      throw new Error('Cannot join your own game');
    }

    // Randomly assign colors
    const creatorIsWhite = Math.random() < 0.5;
    const now = new Date();

    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'IN_PROGRESS',
        whitePlayerId: creatorIsWhite ? game.creatorId : playerId,
        blackPlayerId: creatorIsWhite ? playerId : game.creatorId,
        startedAt: now,
        // Initialize timers if time control is set
        whiteTimeRemaining: game.timeControl,
        blackTimeRemaining: game.timeControl,
        lastMoveAt: now, // Start tracking from game start
      },
      include: {
        creator: {
          select: { id: true, username: true },
        },
        whitePlayer: {
          select: { id: true, username: true },
        },
        blackPlayer: {
          select: { id: true, username: true },
        },
      },
    });

    return updatedGame;
  },

  async cancelGame(gameId: string, userId: string): Promise<void> {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      throw new Error('Game not found');
    }

    if (game.creatorId !== userId) {
      throw new Error('Only the creator can cancel the game');
    }

    if (game.status !== 'WAITING') {
      throw new Error('Can only cancel waiting games');
    }

    await prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'CANCELLED',
      },
    });
  },

  async getUserActiveGame(userId: string): Promise<GameWithPlayers | null> {
    const game = await prisma.game.findFirst({
      where: {
        OR: [
          { creatorId: userId, status: { in: ['WAITING', 'IN_PROGRESS'] } },
          { whitePlayerId: userId, status: 'IN_PROGRESS' },
          { blackPlayerId: userId, status: 'IN_PROGRESS' },
        ],
      },
      include: {
        creator: {
          select: { id: true, username: true },
        },
        whitePlayer: {
          select: { id: true, username: true },
        },
        blackPlayer: {
          select: { id: true, username: true },
        },
      },
    });

    return game;
  },

  async cancelExpiredGames(): Promise<{ id: string; creatorId: string }[]> {
    // const fiveMinutesAgo = new Date(Date.now() - 0);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const expiredGames = await prisma.game.findMany({
      where: {
        status: 'WAITING',
        createdAt: { lt: fiveMinutesAgo },
      },
      select: { id: true, creatorId: true },
    });

    if (expiredGames.length > 0) {
      await prisma.game.updateMany({
        where: {
          id: { in: expiredGames.map((g) => g.id) },
        },
        data: {
          status: 'CANCELLED',
        },
      });
    }

    return expiredGames;
  },

  async cancelUserWaitingGame(userId: string): Promise<string | null> {
    const waitingGame = await prisma.game.findFirst({
      where: {
        creatorId: userId,
        status: 'WAITING',
      },
      select: { id: true },
    });

    if (waitingGame) {
      await prisma.game.update({
        where: { id: waitingGame.id },
        data: { status: 'CANCELLED' },
      });
      return waitingGame.id;
    }

    return null;
  },

  async forfeitUserActiveGame(userId: string): Promise<{ gameId: string; opponentId: string; result: 'WHITE_WIN' | 'BLACK_WIN' } | null> {
    // Find any in-progress game where this user is a player
    const activeGame = await prisma.game.findFirst({
      where: {
        status: 'IN_PROGRESS',
        OR: [
          { whitePlayerId: userId },
          { blackPlayerId: userId },
        ],
      },
    });

    if (activeGame) {
      // Determine the winner (opponent of the user who logged out)
      const isWhite = activeGame.whitePlayerId === userId;
      const result = isWhite ? 'BLACK_WIN' : 'WHITE_WIN';
      const winnerId = isWhite ? activeGame.blackPlayerId : activeGame.whitePlayerId;
      const opponentId = winnerId!;

      await prisma.game.update({
        where: { id: activeGame.id },
        data: {
          status: 'COMPLETED',
          result,
          winnerId,
          endedAt: new Date(),
        },
      });

      return { gameId: activeGame.id, opponentId, result };
    }

    return null;
  },

  async forfeitGame(gameId: string, forfeitingUserId: string): Promise<{ result: 'WHITE_WIN' | 'BLACK_WIN'; winnerId: string } | null> {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game || game.status !== 'IN_PROGRESS') {
      return null;
    }

    const isWhite = game.whitePlayerId === forfeitingUserId;
    const isBlack = game.blackPlayerId === forfeitingUserId;

    if (!isWhite && !isBlack) {
      return null;
    }

    const result = isWhite ? 'BLACK_WIN' : 'WHITE_WIN';
    const winnerId = isWhite ? game.blackPlayerId! : game.whitePlayerId!;

    await prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'COMPLETED',
        result,
        winnerId,
        endedAt: new Date(),
      },
    });

    return { result, winnerId };
  },

  async resignGame(gameId: string, resigningUserId: string): Promise<{ result: 'WHITE_WIN' | 'BLACK_WIN'; winnerId: string; resignedColor: 'white' | 'black' } | null> {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game || game.status !== 'IN_PROGRESS') {
      return null;
    }

    const isWhite = game.whitePlayerId === resigningUserId;
    const isBlack = game.blackPlayerId === resigningUserId;

    if (!isWhite && !isBlack) {
      return null;
    }

    const result = isWhite ? 'BLACK_WIN' : 'WHITE_WIN';
    const winnerId = isWhite ? game.blackPlayerId! : game.whitePlayerId!;
    const resignedColor = isWhite ? 'white' : 'black';

    await prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'COMPLETED',
        result,
        winnerId,
        endedAt: new Date(),
      },
    });

    return { result, winnerId, resignedColor };
  },

  async endGameAsDraw(gameId: string): Promise<boolean> {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game || game.status !== 'IN_PROGRESS') {
      return false;
    }

    await prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'COMPLETED',
        result: 'DRAW',
        endedAt: new Date(),
      },
    });

    return true;
  },

  async updateGamePgn(gameId: string, pgn: string): Promise<void> {
    await prisma.game.update({
      where: { id: gameId },
      data: { pgn },
    });
  },

  async updateGameAfterMove(
    gameId: string,
    pgn: string,
    movingColor: 'white' | 'black'
  ): Promise<{ whiteTimeRemaining: number | null; blackTimeRemaining: number | null }> {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game || game.status !== 'IN_PROGRESS') {
      throw new Error('Game not found or not in progress');
    }

    const now = new Date();
    let whiteTime = game.whiteTimeRemaining;
    let blackTime = game.blackTimeRemaining;

    // Calculate elapsed time since last move and deduct from moving player
    if (game.lastMoveAt && game.timeControl) {
      const elapsedSeconds = Math.floor((now.getTime() - game.lastMoveAt.getTime()) / 1000);

      if (movingColor === 'white' && whiteTime !== null) {
        whiteTime = Math.max(0, whiteTime - elapsedSeconds);
      } else if (movingColor === 'black' && blackTime !== null) {
        blackTime = Math.max(0, blackTime - elapsedSeconds);
      }
    }

    await prisma.game.update({
      where: { id: gameId },
      data: {
        pgn,
        whiteTimeRemaining: whiteTime,
        blackTimeRemaining: blackTime,
        lastMoveAt: now,
      },
    });

    return { whiteTimeRemaining: whiteTime, blackTimeRemaining: blackTime };
  },

  async getGameTimers(gameId: string): Promise<{
    whiteTimeRemaining: number | null;
    blackTimeRemaining: number | null;
    currentTurn: 'white' | 'black';
  } | null> {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game || game.status !== 'IN_PROGRESS') {
      return null;
    }

    let whiteTime = game.whiteTimeRemaining;
    let blackTime = game.blackTimeRemaining;

    // Calculate current time accounting for ongoing turn
    if (game.lastMoveAt && game.timeControl) {
      const now = new Date();
      const elapsedSeconds = Math.floor((now.getTime() - game.lastMoveAt.getTime()) / 1000);

      // Determine whose turn it is based on PGN (count moves)
      // If no moves or even number of half-moves, it's white's turn
      const moveCount = game.pgn ? (game.pgn.match(/\d+\./g) || []).length * 2 - (game.pgn.trim().split(' ').length % 2 === 0 ? 0 : 1) : 0;
      const isWhiteTurn = moveCount % 2 === 0;

      if (isWhiteTurn && whiteTime !== null) {
        whiteTime = Math.max(0, whiteTime - elapsedSeconds);
      } else if (!isWhiteTurn && blackTime !== null) {
        blackTime = Math.max(0, blackTime - elapsedSeconds);
      }

      return {
        whiteTimeRemaining: whiteTime,
        blackTimeRemaining: blackTime,
        currentTurn: isWhiteTurn ? 'white' : 'black',
      };
    }

    return {
      whiteTimeRemaining: whiteTime,
      blackTimeRemaining: blackTime,
      currentTurn: 'white', // Default to white if no moves yet
    };
  },

  async handleTimeOut(gameId: string, timedOutColor: 'white' | 'black'): Promise<{ result: 'WHITE_WIN' | 'BLACK_WIN'; winnerId: string } | null> {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game || game.status !== 'IN_PROGRESS') {
      return null;
    }

    const result = timedOutColor === 'white' ? 'BLACK_WIN' : 'WHITE_WIN';
    const winnerId = timedOutColor === 'white' ? game.blackPlayerId! : game.whitePlayerId!;

    await prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'COMPLETED',
        result,
        winnerId,
        endedAt: new Date(),
      },
    });

    return { result, winnerId };
  },
};
