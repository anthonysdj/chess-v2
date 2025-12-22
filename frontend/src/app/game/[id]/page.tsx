'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { Game } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface GameEndedInfo {
  result: 'WHITE_WIN' | 'BLACK_WIN' | 'DRAW';
  reason: string;
}

interface DisconnectInfo {
  color: 'white' | 'black';
  reconnectTimeout: number;
  timeRemaining: number;
}

type DrawOfferState = 'none' | 'sent' | 'received';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [game, setGame] = useState<Game | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameEnded, setGameEnded] = useState<GameEndedInfo | null>(null);
  const [opponentDisconnected, setOpponentDisconnected] = useState<DisconnectInfo | null>(null);
  const [drawOfferState, setDrawOfferState] = useState<DrawOfferState>('none');
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  const gameId = params.id as string;

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }

    if (!authLoading && isAuthenticated && gameId) {
      fetchGame();
    }
  }, [authLoading, isAuthenticated, gameId]);

  const fetchGame = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/games/${gameId}`,
        { credentials: 'include' }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load game');
      }

      setGame(data.game);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game');
    } finally {
      setIsLoading(false);
    }
  };

  // Join game room and set up socket listeners
  useEffect(() => {
    if (!socket || !isConnected || !gameId || !user || !game) return;

    // Join the game room
    socket.emit('game:join', { gameId, userId: user.id });

    // Listen for game ended event
    const handleGameEnded = (data: GameEndedInfo) => {
      // Clear any disconnect timer
      if (disconnectTimerRef.current) {
        clearInterval(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      setOpponentDisconnected(null);
      setGameEnded(data);
    };

    // Listen for opponent disconnect
    const handlePlayerDisconnected = (data: { color: 'white' | 'black'; reconnectTimeout: number }) => {
      const isWhite = game.whitePlayerId === user.id;
      const myColor = isWhite ? 'white' : 'black';

      // Only show if opponent disconnected, not us
      if (data.color !== myColor) {
        setOpponentDisconnected({
          color: data.color,
          reconnectTimeout: data.reconnectTimeout,
          timeRemaining: Math.ceil(data.reconnectTimeout / 1000),
        });

        // Start countdown timer
        disconnectTimerRef.current = setInterval(() => {
          setOpponentDisconnected(prev => {
            if (!prev) return null;
            const newTime = prev.timeRemaining - 1;
            if (newTime <= 0) {
              if (disconnectTimerRef.current) {
                clearInterval(disconnectTimerRef.current);
                disconnectTimerRef.current = null;
              }
              return null;
            }
            return { ...prev, timeRemaining: newTime };
          });
        }, 1000);
      }
    };

    // Listen for opponent reconnect
    const handlePlayerReconnected = (data: { color: 'white' | 'black' }) => {
      const isWhite = game.whitePlayerId === user.id;
      const myColor = isWhite ? 'white' : 'black';

      if (data.color !== myColor) {
        // Clear timer and disconnect state
        if (disconnectTimerRef.current) {
          clearInterval(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        setOpponentDisconnected(null);
      }
    };

    // Draw offer events
    const handleDrawOffered = () => {
      setDrawOfferState('received');
    };

    const handleDrawOfferSent = () => {
      setDrawOfferState('sent');
    };

    const handleDrawDeclined = () => {
      setDrawOfferState('none');
    };

    const handleDrawOfferCancelled = () => {
      setDrawOfferState('none');
    };

    socket.on(`game:${gameId}:ended`, handleGameEnded);
    socket.on('game:playerDisconnected', handlePlayerDisconnected);
    socket.on('game:playerReconnected', handlePlayerReconnected);
    socket.on('game:drawOffered', handleDrawOffered);
    socket.on('game:drawOfferSent', handleDrawOfferSent);
    socket.on('game:drawDeclined', handleDrawDeclined);
    socket.on('game:drawOfferDeclined', handleDrawDeclined);
    socket.on('game:drawOfferCancelled', handleDrawOfferCancelled);
    socket.on('game:drawOfferCancelledConfirm', handleDrawOfferCancelled);

    return () => {
      socket.emit('game:leave');
      socket.off(`game:${gameId}:ended`, handleGameEnded);
      socket.off('game:playerDisconnected', handlePlayerDisconnected);
      socket.off('game:playerReconnected', handlePlayerReconnected);
      socket.off('game:drawOffered', handleDrawOffered);
      socket.off('game:drawOfferSent', handleDrawOfferSent);
      socket.off('game:drawDeclined', handleDrawDeclined);
      socket.off('game:drawOfferDeclined', handleDrawDeclined);
      socket.off('game:drawOfferCancelled', handleDrawOfferCancelled);
      socket.off('game:drawOfferCancelledConfirm', handleDrawOfferCancelled);

      // Clear timer on cleanup
      if (disconnectTimerRef.current) {
        clearInterval(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
    };
  }, [socket, isConnected, gameId, user, game]);

  const handleBackToLobby = useCallback(() => {
    router.push('/lobby');
  }, [router]);

  // Game action handlers
  const handleResign = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('game:resign');
      setShowResignConfirm(false);
    }
  }, [socket, isConnected]);

  const handleOfferDraw = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('game:offerDraw');
    }
  }, [socket, isConnected]);

  const handleAcceptDraw = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('game:acceptDraw');
    }
  }, [socket, isConnected]);

  const handleDeclineDraw = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('game:declineDraw');
    }
  }, [socket, isConnected]);

  const handleCancelDrawOffer = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('game:cancelDrawOffer');
    }
  }, [socket, isConnected]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card className="text-center">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
            Error
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/lobby')}
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            Back to Lobby
          </button>
        </Card>
      </div>
    );
  }

  if (!game) {
    return null;
  }

  const isWhite = game.whitePlayerId === user?.id;
  const opponent = isWhite ? game.blackPlayer : game.whitePlayer;

  // Determine if current user won
  const userWon = gameEnded && (
    (isWhite && gameEnded.result === 'WHITE_WIN') ||
    (!isWhite && gameEnded.result === 'BLACK_WIN')
  );

  // Show game ended overlay
  if (gameEnded) {
    let reasonText = 'The game has ended.';
    if (gameEnded.reason === 'opponent_disconnected') {
      reasonText = 'Your opponent has disconnected.';
    } else if (gameEnded.reason === 'resignation') {
      reasonText = userWon ? 'Your opponent resigned.' : 'You resigned.';
    } else if (gameEnded.reason === 'agreement') {
      reasonText = 'Draw by mutual agreement.';
    }

    const isDraw = gameEnded.result === 'DRAW';

    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card className="text-center">
          <div className="mb-6">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
              userWon ? 'bg-green-100 dark:bg-green-900/30' : isDraw ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-red-100 dark:bg-red-900/30'
            }`}>
              {userWon ? (
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : isDraw ? (
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 5h8m-8 5h8" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <h2 className={`text-2xl font-bold mb-2 ${
              userWon ? 'text-green-600 dark:text-green-400' : isDraw ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {userWon ? 'You Win!' : isDraw ? 'Draw!' : 'You Lost'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {reasonText}
            </p>
          </div>
          <Button onClick={handleBackToLobby} className="w-full sm:w-auto">
            Back to Lobby
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Opponent disconnected banner */}
      {opponentDisconnected && (
        <div className="mb-4 p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="animate-pulse">
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  {opponent?.username || 'Opponent'} has disconnected
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Waiting for reconnection...
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
                {Math.floor(opponentDisconnected.timeRemaining / 60)}:{(opponentDisconnected.timeRemaining % 60).toString().padStart(2, '0')}
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                until forfeit
              </p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Game In Progress
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Playing as {isWhite ? 'White' : 'Black'} vs {opponent?.username || 'Unknown'}
          </p>
        </div>

        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-8 text-center">
          <div className="w-64 h-64 mx-auto bg-board-light border-4 border-board-dark rounded flex items-center justify-center">
            <p className="text-gray-600 dark:text-gray-400">
              Chess board coming soon...
            </p>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Game ID: {game.id}</p>
          <p>Time Control: {game.timeControl ? `${game.timeControl / 60} min/turn` : 'No limit'}</p>
        </div>

        {/* Draw offer received banner */}
        {drawOfferState === 'received' && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-center text-blue-800 dark:text-blue-200 mb-3">
              {opponent?.username || 'Opponent'} offers a draw
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={handleAcceptDraw} className="bg-blue-600 hover:bg-blue-700">
                Accept
              </Button>
              <Button onClick={handleDeclineDraw} variant="secondary">
                Decline
              </Button>
            </div>
          </div>
        )}

        {/* Draw offer sent banner */}
        {drawOfferState === 'sent' && (
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <p className="text-center text-gray-700 dark:text-gray-300 mb-3">
              Draw offer sent. Waiting for response...
            </p>
            <div className="flex justify-center">
              <Button onClick={handleCancelDrawOffer} variant="secondary" size="sm">
                Cancel Offer
              </Button>
            </div>
          </div>
        )}

        {/* Game controls */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-center gap-4">
            {drawOfferState === 'none' && (
              <Button
                onClick={handleOfferDraw}
                variant="secondary"
                disabled={opponentDisconnected !== null}
              >
                Offer Draw
              </Button>
            )}
            <Button
              onClick={() => setShowResignConfirm(true)}
              variant="secondary"
              className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
            >
              Resign
            </Button>
          </div>
        </div>

        {/* Resign confirmation modal */}
        {showResignConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Resign Game?
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to resign? This will count as a loss.
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => setShowResignConfirm(false)}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleResign}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Resign
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
