import { Server } from 'socket.io';
import { setupLobbyHandlers, startGameCleanup } from './lobbyHandler';
import { setupGameHandlers, handleGameDisconnect } from './gameHandler';

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Set up lobby handlers
    setupLobbyHandlers(io, socket);

    // Set up game handlers
    setupGameHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);

      // Handle game disconnection (starts reconnect timer)
      handleGameDisconnect(io, socket);
    });
  });

  // Start periodic cleanup of expired games
  startGameCleanup(io);
}
