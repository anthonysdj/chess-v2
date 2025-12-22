import { Server, Socket } from 'socket.io';
import { gameService } from '../services/gameService';

export function setupLobbyHandlers(io: Server, socket: Socket) {
  // Join lobby room
  socket.on('lobby:join', async () => {
    socket.join('lobby');

    // Send current available games
    try {
      const games = await gameService.getAvailableGames();
      socket.emit('lobby:games', { games });
    } catch (error) {
      socket.emit('lobby:error', { message: 'Failed to get games' });
    }
  });

  // Leave lobby room
  socket.on('lobby:leave', () => {
    socket.leave('lobby');
  });

  // Create a new game
  socket.on('lobby:createGame', async (data: { userId: string; timeControl: number | null }) => {
    try {
      const game = await gameService.createGame({
        creatorId: data.userId,
        timeControl: data.timeControl,
      });

      // Notify the creator
      socket.emit('lobby:gameCreated', { game });

      // Broadcast to all users in lobby
      io.to('lobby').emit('lobby:gameAdded', { game });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create game';
      socket.emit('lobby:error', { message });
    }
  });

  // Join a game
  socket.on('lobby:joinGame', async (data: { gameId: string; userId: string }) => {
    try {
      const game = await gameService.joinGame(data.gameId, data.userId);

      // Notify both players - they should redirect to game page
      socket.emit('lobby:gameJoined', { game });

      // Broadcast game removal from lobby
      io.to('lobby').emit('lobby:gameRemoved', { gameId: game.id });

      // Notify the creator that someone joined (they might be in waiting screen)
      io.emit(`game:${game.id}:started`, { game });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join game';
      socket.emit('lobby:error', { message });
    }
  });

  // Cancel a game
  socket.on('lobby:cancelGame', async (data: { gameId: string; userId: string }) => {
    try {
      await gameService.cancelGame(data.gameId, data.userId);

      // Notify the creator
      socket.emit('lobby:gameCancelled', { gameId: data.gameId });

      // Broadcast to all users in lobby
      io.to('lobby').emit('lobby:gameRemoved', { gameId: data.gameId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel game';
      socket.emit('lobby:error', { message });
    }
  });

  // Handle user logout - cancel waiting games and forfeit active games
  socket.on('user:logout', async (data: { userId: string }) => {
    try {
      // Cancel any waiting game the user created
      const cancelledGameId = await gameService.cancelUserWaitingGame(data.userId);

      if (cancelledGameId) {
        // Broadcast to all users in lobby that this game was removed
        io.to('lobby').emit('lobby:gameRemoved', { gameId: cancelledGameId });
      }

      // Forfeit any active game the user is in
      const forfeitResult = await gameService.forfeitUserActiveGame(data.userId);

      if (forfeitResult) {
        // Notify the opponent that the game ended (they won by forfeit)
        io.emit(`game:${forfeitResult.gameId}:ended`, {
          result: forfeitResult.result,
          reason: 'opponent_disconnected',
        });
      }
    } catch (error) {
      console.error('Error handling user logout:', error);
    }
  });
}

// Cleanup expired games periodically
export function startGameCleanup(io: Server) {
  setInterval(async () => {
    try {
      const cancelledGames = await gameService.cancelExpiredGames();

      if (cancelledGames.length > 0) {
        // Notify lobby about removed games and notify creators
        cancelledGames.forEach((game) => {
          io.to('lobby').emit('lobby:gameRemoved', { gameId: game.id });
          // Emit auto-cancelled event so creators know their game expired
          io.emit(`game:${game.id}:autoCancelled`, { gameId: game.id });
        });
      }
    } catch (error) {
      console.error('Failed to cleanup expired games:', error);
    }
  }, 5000); // Check every 5 seconds
}
