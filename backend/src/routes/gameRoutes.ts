import { Router } from 'express';
import { gameController } from '../controllers/gameController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.get('/', gameController.getAvailableGames);
router.get('/:id', gameController.getGame);

// Protected routes
router.post('/', authMiddleware, gameController.createGame);
router.delete('/:id', authMiddleware, gameController.cancelGame);
router.get('/user/active', authMiddleware, gameController.getActiveGame);

export default router;
