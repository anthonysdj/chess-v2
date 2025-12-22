import { Request, Response } from 'express';
import { gameService } from '../services/gameService';
import { AuthRequest } from '../types';

export const gameController = {
  async getAvailableGames(_req: Request, res: Response): Promise<void> {
    try {
      const games = await gameService.getAvailableGames();
      res.json({ games });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get games';
      res.status(500).json({ error: message });
    }
  },

  async createGame(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { timeControl } = req.body;

      // Validate time control
      const validTimeControls = [null, 60, 180, 300];
      if (timeControl !== undefined && !validTimeControls.includes(timeControl)) {
        res.status(400).json({ error: 'Invalid time control' });
        return;
      }

      const game = await gameService.createGame({
        creatorId: req.user.id,
        timeControl: timeControl ?? null,
      });

      res.status(201).json({ game });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create game';
      res.status(400).json({ error: message });
    }
  },

  async getGame(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const game = await gameService.getGameById(id);

      if (!game) {
        res.status(404).json({ error: 'Game not found' });
        return;
      }

      res.json({ game });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get game';
      res.status(500).json({ error: message });
    }
  },

  async cancelGame(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      await gameService.cancelGame(id, req.user.id);

      res.json({ message: 'Game cancelled' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel game';
      res.status(400).json({ error: message });
    }
  },

  async getActiveGame(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const game = await gameService.getUserActiveGame(req.user.id);
      res.json({ game });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get active game';
      res.status(500).json({ error: message });
    }
  },
};
