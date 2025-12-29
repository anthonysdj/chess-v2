import { Server, Socket } from 'socket.io';
import { gameService } from '../services/gameService';

// Track active game connections: gameId -> { whiteSocketId, blackSocketId }
const gameConnections = new Map<string, { white?: string; black?: string }>();

// Track disconnection timers: `${gameId}:${color}` -> timeout
const disconnectTimers = new Map<string, NodeJS.Timeout>();

// Track pending draw offers: gameId -> color that offered
const pendingDrawOffers = new Map<string, 'white' | 'black'>();

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

      // Get current timer state
      const timerState = await gameService.getGameTimers(gameId);

      // Notify that player has joined with timer info
      socket.emit('game:joined', {
        color,
        gameId,
        whiteTimeRemaining: timerState?.whiteTimeRemaining ?? null,
        blackTimeRemaining: timerState?.blackTimeRemaining ?? null,
        pgn: game.pgn ?? '',
      });

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
    handlePlayerLeave(socket);
  });

  // Player resigns
  socket.on('game:resign', async () => {
    const { gameId, userId, color } = socket.data;

    if (!gameId || !userId || !color) {
      socket.emit('game:error', { message: 'Not in a game' });
      return;
    }

    try {
      const result = await gameService.resignGame(gameId, userId);

      if (result) {
        // Clear any pending draw offer
        pendingDrawOffers.delete(gameId);

        // Notify both players
        io.to(`game:${gameId}`).emit(`game:${gameId}:ended`, {
          result: result.result,
          reason: 'resignation',
          resignedColor: result.resignedColor,
        });

        // Cleanup
        gameConnections.delete(gameId);
      }
    } catch (error) {
      console.error('Error resigning game:', error);
      socket.emit('game:error', { message: 'Failed to resign' });
    }
  });

  // Player offers a draw
  socket.on('game:offerDraw', () => {
    const { gameId, color } = socket.data;

    if (!gameId || !color) {
      socket.emit('game:error', { message: 'Not in a game' });
      return;
    }

    // Check if there's already a pending offer from opponent
    const existingOffer = pendingDrawOffers.get(gameId);

    if (existingOffer && existingOffer !== color) {
      // Both players have offered - accept the draw
      acceptDraw(io, gameId);
    } else {
      // Store the offer and notify opponent
      pendingDrawOffers.set(gameId, color as 'white' | 'black');
      socket.to(`game:${gameId}`).emit('game:drawOffered', { offeredBy: color });
      socket.emit('game:drawOfferSent');
    }
  });

  // Player accepts a draw offer
  socket.on('game:acceptDraw', () => {
    const { gameId, color } = socket.data;

    if (!gameId || !color) {
      socket.emit('game:error', { message: 'Not in a game' });
      return;
    }

    // Verify there's a pending offer from the opponent
    const existingOffer = pendingDrawOffers.get(gameId);

    if (existingOffer && existingOffer !== color) {
      acceptDraw(io, gameId);
    } else {
      socket.emit('game:error', { message: 'No draw offer to accept' });
    }
  });

  // Player declines a draw offer
  socket.on('game:declineDraw', () => {
    const { gameId, color } = socket.data;

    if (!gameId || !color) {
      socket.emit('game:error', { message: 'Not in a game' });
      return;
    }

    // Clear the pending offer
    const existingOffer = pendingDrawOffers.get(gameId);

    if (existingOffer && existingOffer !== color) {
      pendingDrawOffers.delete(gameId);
      socket.to(`game:${gameId}`).emit('game:drawDeclined', { declinedBy: color });
      socket.emit('game:drawOfferDeclined');
    }
  });

  // Player cancels their own draw offer
  socket.on('game:cancelDrawOffer', () => {
    const { gameId, color } = socket.data;

    if (!gameId || !color) return;

    const existingOffer = pendingDrawOffers.get(gameId);

    if (existingOffer === color) {
      pendingDrawOffers.delete(gameId);
      socket.to(`game:${gameId}`).emit('game:drawOfferCancelled');
      socket.emit('game:drawOfferCancelledConfirm');
    }
  });

  // Player makes a move
  socket.on('game:move', async (data: { gameId: string; from: string; to: string; promotion?: string; fen: string; pgn: string }) => {
    const { gameId, color } = socket.data;

    if (!gameId || !color) {
      socket.emit('game:error', { message: 'Not in a game' });
      return;
    }

    try {
      // Save the game state and update timers
      const timerUpdate = await gameService.updateGameAfterMove(
        data.gameId,
        data.pgn,
        color as 'white' | 'black'
      );

      // Broadcast move to opponent with updated timer info
      socket.to(`game:${gameId}`).emit('game:move', {
        from: data.from,
        to: data.to,
        promotion: data.promotion,
        fen: data.fen,
        pgn: data.pgn,
        whiteTimeRemaining: timerUpdate.whiteTimeRemaining,
        blackTimeRemaining: timerUpdate.blackTimeRemaining,
      });

      // Also send timer update to the player who made the move
      socket.emit('game:timerSync', {
        whiteTimeRemaining: timerUpdate.whiteTimeRemaining,
        blackTimeRemaining: timerUpdate.blackTimeRemaining,
      });

      console.log(`Move in game ${gameId}: ${data.from} -> ${data.to}`);
    } catch (error) {
      console.error('Error processing move:', error);
      socket.emit('game:error', { message: 'Failed to process move' });
    }
  });

  // Player reports timeout
  socket.on('game:timeout', async (data: { timedOutColor: 'white' | 'black' }) => {
    const { gameId } = socket.data;

    if (!gameId) {
      socket.emit('game:error', { message: 'Not in a game' });
      return;
    }

    try {
      const result = await gameService.handleTimeOut(gameId, data.timedOutColor);

      if (result) {
        // Notify both players
        io.to(`game:${gameId}`).emit(`game:${gameId}:ended`, {
          result: result.result,
          reason: 'timeout',
          timedOutColor: data.timedOutColor,
        });

        // Cleanup
        gameConnections.delete(gameId);
      }
    } catch (error) {
      console.error('Error handling timeout:', error);
    }
  });
}

async function acceptDraw(io: Server, gameId: string) {
  try {
    const success = await gameService.endGameAsDraw(gameId);

    if (success) {
      pendingDrawOffers.delete(gameId);

      io.to(`game:${gameId}`).emit(`game:${gameId}:ended`, {
        result: 'DRAW',
        reason: 'agreement',
      });

      gameConnections.delete(gameId);
    }
  } catch (error) {
    console.error('Error accepting draw:', error);
  }
}

function handlePlayerLeave(socket: Socket) {
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
