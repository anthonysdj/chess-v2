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

    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'IN_PROGRESS',
        whitePlayerId: creatorIsWhite ? game.creatorId : playerId,
        blackPlayerId: creatorIsWhite ? playerId : game.creatorId,
        startedAt: new Date(),
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
};
