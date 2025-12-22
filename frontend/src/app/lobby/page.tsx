'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { Game } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import GameList from '@/components/lobby/GameList';
import CreateGameModal from '@/components/lobby/CreateGameModal';
import WaitingScreen from '@/components/lobby/WaitingScreen';

export default function LobbyPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { socket, isConnected } = useSocket();
  const router = useRouter();

  const [games, setGames] = useState<Game[]>([]);
  const [myWaitingGame, setMyWaitingGame] = useState<Game | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [joiningGameId, setJoiningGameId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track the current waiting game ID in a ref to avoid stale closures
  const myWaitingGameRef = useRef<string | null>(null);

  // Update ref when myWaitingGame changes
  useEffect(() => {
    myWaitingGameRef.current = myWaitingGame?.id || null;
  }, [myWaitingGame]);

  // Join lobby and set up socket listeners
  useEffect(() => {
    if (!socket || !isConnected || !user) return;

    // Join lobby room
    socket.emit('lobby:join');

    // Listen for game list
    const handleGames = ({ games }: { games: Game[] }) => {
      setGames(games);
      // Check if user has a waiting game
      const myGame = games.find(g => g.creatorId === user.id);
      if (myGame) {
        setMyWaitingGame(myGame);
      }
    };

    // Listen for new games
    const handleGameAdded = ({ game }: { game: Game }) => {
      setGames(prev => [game, ...prev]);
      if (game.creatorId === user.id) {
        setMyWaitingGame(game);
        setIsCreateModalOpen(false);
        setIsCreating(false);
      }
    };

    // Listen for removed games (only clear myWaitingGame if it wasn't started)
    const handleGameRemoved = ({ gameId }: { gameId: string }) => {
      setGames(prev => prev.filter(g => g.id !== gameId));
      // Note: Don't clear myWaitingGame here - let the game:started event handle redirect
      // Only clear if the game was cancelled (not started)
    };

    // Listen for successful join (for the joiner)
    const handleGameJoined = ({ game }: { game: Game }) => {
      setJoiningGameId(null);
      router.push(`/game/${game.id}`);
    };

    // Listen for game cancelled (explicit cancel by creator)
    const handleGameCancelled = () => {
      setMyWaitingGame(null);
      setIsCancelling(false);
    };

    // Listen for errors
    const handleError = ({ message }: { message: string }) => {
      setError(message);
      setIsCreating(false);
      setIsCancelling(false);
      setJoiningGameId(null);
    };

    socket.on('lobby:games', handleGames);
    socket.on('lobby:gameAdded', handleGameAdded);
    socket.on('lobby:gameRemoved', handleGameRemoved);
    socket.on('lobby:gameJoined', handleGameJoined);
    socket.on('lobby:gameCancelled', handleGameCancelled);
    socket.on('lobby:error', handleError);

    return () => {
      socket.emit('lobby:leave');
      socket.off('lobby:games', handleGames);
      socket.off('lobby:gameAdded', handleGameAdded);
      socket.off('lobby:gameRemoved', handleGameRemoved);
      socket.off('lobby:gameJoined', handleGameJoined);
      socket.off('lobby:gameCancelled', handleGameCancelled);
      socket.off('lobby:error', handleError);
    };
  }, [socket, isConnected, user, router]);

  // Separate effect for listening to game events (started or auto-cancelled)
  useEffect(() => {
    if (!socket || !isConnected || !myWaitingGame || !user) return;

    const gameId = myWaitingGame.id;

    // When opponent joins our game
    const handleGameStarted = ({ game }: { game: Game }) => {
      if (game.whitePlayerId === user.id || game.blackPlayerId === user.id) {
        setMyWaitingGame(null);
        router.push(`/game/${game.id}`);
      }
    };

    // When our game is auto-cancelled due to timeout
    const handleAutoCancelled = () => {
      setMyWaitingGame(null);
    };

    socket.on(`game:${gameId}:started`, handleGameStarted);
    socket.on(`game:${gameId}:autoCancelled`, handleAutoCancelled);

    return () => {
      socket.off(`game:${gameId}:started`, handleGameStarted);
      socket.off(`game:${gameId}:autoCancelled`, handleAutoCancelled);
    };
  }, [socket, isConnected, myWaitingGame, user, router]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleCreateGame = useCallback((timeControl: number | null) => {
    if (!socket || !user) return;
    setIsCreating(true);
    setError(null);
    socket.emit('lobby:createGame', { userId: user.id, timeControl });
  }, [socket, user]);

  const handleJoinGame = useCallback((gameId: string) => {
    if (!socket || !user) return;
    setJoiningGameId(gameId);
    setError(null);
    socket.emit('lobby:joinGame', { gameId, userId: user.id });
  }, [socket, user]);

  const handleCancelGame = useCallback(() => {
    if (!socket || !user || !myWaitingGame) return;
    setIsCancelling(true);
    setError(null);
    socket.emit('lobby:cancelGame', { gameId: myWaitingGame.id, userId: user.id });
  }, [socket, user, myWaitingGame]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  // Show waiting screen if user has created a game
  if (myWaitingGame) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <WaitingScreen
          game={myWaitingGame}
          onCancel={handleCancelGame}
          isCancelling={isCancelling}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Game Lobby
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Welcome back, {user.username}! Create a new game or join an existing one.
        </p>
        {!isConnected && (
          <p className="mt-2 text-yellow-600 dark:text-yellow-400 text-sm">
            Connecting to server...
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-400 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create Game Section */}
        <Card className="lg:col-span-1">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Create Game
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Start a new game and wait for an opponent to join.
          </p>
          <Button
            className="w-full"
            onClick={() => setIsCreateModalOpen(true)}
            disabled={!isConnected}
          >
            Create Game
          </Button>
        </Card>

        {/* Available Games Section */}
        <Card className="lg:col-span-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Available Games ({games.length})
          </h2>
          <GameList
            games={games}
            currentUserId={user.id}
            onJoin={handleJoinGame}
            onCancel={() => {}}
            joiningGameId={joiningGameId}
          />
        </Card>
      </div>

      <CreateGameModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateGame}
        isCreating={isCreating}
      />
    </div>
  );
}
