import { Server, Socket } from 'socket.io';
import { gameService } from '../services/gameService';

// Track active game connections: gameId -> { odifiedwhiteSocketId, blackSocketId }
const gameConnections = new Map<string, { white?: string; black?: string }>();

// Track disconnection timers: `${gameId}:${color}` -> timeout
const disconnectTimers = new Map<string, NodeJS.Timeout>();

// Reconnection timeout in milliseconds (1 minute)
const RECONNECT_TIMEOUT = 60 * 1000;

export function setupGameHandlers(io: Server, socket: Socket) {
  // Player joins a game room
  socket.on('game:join', async (data: { gameId: string; userId: string }) => {
    try {
      const game = await gameService.getGameById(data.gameId);

      if (!game) {
        socket.emit('game:error', { message: 'Game not found' });
        return;
      }

      if (game.status !== 'IN_PROGRESS') {
        socket.emit('game:error', { message: 'Game is not in progress' });
        return;
      }

      // Determine player color
      const isWhite = game.whitePlayerId === data.userId;
      const isBlack = game.blackPlayerId === data.userId;

      if (!isWhite && !isBlack) {
        socket.emit('game:error', { message: 'You are not a player in this game' });
        return;
      }

      const color = isWhite ? 'white' : 'black';
      const gameId = data.gameId;

      // Join the game room
      socket.join(`game:${gameId}`);

      // Store socket info for tracking
      socket.data.gameId = gameId;
      socket.data.userId = data.userId;
      socket.data.color = color;

      // Update game connections
      const connections = gameConnections.get(gameId) || {};
      connections[color] = socket.id;
      gameConnections.set(gameId, connections);

      // Cancel any existing disconnect timer for this player
      const timerKey = `${gameId}:${color}`;
      const existingTimer = disconnectTimers.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
        disconnectTimers.delete(timerKey);

        // Notify opponent that player has reconnected
        socket.to(`game:${gameId}`).emit('game:playerReconnected', { color });
      }

      // Notify that player has joined
      socket.emit('game:joined', { color, gameId });

      // Notify opponent if they're connected
      socket.to(`game:${gameId}`).emit('game:playerConnected', { color });

      console.log(`Player ${data.userId} joined game ${gameId} as ${color}`);
    } catch (error) {
      console.error('Error joining game:', error);
      socket.emit('game:error', { message: 'Failed to join game' });
    }
  });

  // Player leaves a game room (navigating away, not disconnect)
  socket.on('game:leave', () => {
    handlePlayerLeave(io, socket);
  });
}

function handlePlayerLeave(io: Server, socket: Socket) {
  const { gameId, color } = socket.data;

  if (!gameId || !color) return;

  socket.leave(`game:${gameId}`);

  // Remove from connections
  const connections = gameConnections.get(gameId);
  if (connections && connections[color as 'white' | 'black'] === socket.id) {
    delete connections[color as 'white' | 'black'];
    if (!connections.white && !connections.black) {
      gameConnections.delete(gameId);
    }
  }

  // Clear socket data
  socket.data.gameId = undefined;
  socket.data.userId = undefined;
  socket.data.color = undefined;
}

export function handleGameDisconnect(io: Server, socket: Socket) {
  const { gameId, userId, color } = socket.data;

  if (!gameId || !userId || !color) return;

  // Verify this socket is still the active one for this player
  const connections = gameConnections.get(gameId);
  if (!connections || connections[color as 'white' | 'black'] !== socket.id) {
    return;
  }

  console.log(`Player ${userId} (${color}) disconnected from game ${gameId}`);

  // Notify opponent that player has disconnected
  io.to(`game:${gameId}`).emit('game:playerDisconnected', {
    color,
    reconnectTimeout: RECONNECT_TIMEOUT
  });

  // Start reconnection timer
  const timerKey = `${gameId}:${color}`;
  const timer = setTimeout(async () => {
    disconnectTimers.delete(timerKey);

    // Check if player is still disconnected
    const currentConnections = gameConnections.get(gameId);
    if (currentConnections && currentConnections[color as 'white' | 'black']) {
      // Player has reconnected, do nothing
      return;
    }

    // Forfeit the game
    try {
      const result = await gameService.forfeitGame(gameId, userId);

      if (result) {
        // Notify remaining player they won
        io.to(`game:${gameId}`).emit(`game:${gameId}:ended`, {
          result: result.result,
          reason: 'opponent_disconnected',
        });

        // Also emit a global event for the specific game
        io.emit(`game:${gameId}:ended`, {
          result: result.result,
          reason: 'opponent_disconnected',
        });
      }

      // Cleanup
      gameConnections.delete(gameId);
    } catch (error) {
      console.error('Error forfeiting game after disconnect:', error);
    }
  }, RECONNECT_TIMEOUT);

  disconnectTimers.set(timerKey, timer);
}

// Export for cleanup
export function getGameConnections() {
  return gameConnections;
}
