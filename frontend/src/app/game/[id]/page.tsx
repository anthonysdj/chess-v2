'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Chess, Square, PieceSymbol } from 'chess.js';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { Game } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { ChessBoard, PlayerInfo, Timer, MoveHistory, CapturedPieces } from '@/components/game';

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

  // Chess state
  const [chess] = useState(() => new Chess());
  const [, setChessUpdate] = useState(0); // Force re-render when chess state changes
  const [whiteTime, setWhiteTime] = useState<number | null>(null);
  const [blackTime, setBlackTime] = useState<number | null>(null);
  const turnTimerRef = useRef<NodeJS.Timeout | null>(null);

  const gameId = params.id as string;

  // Determine player colors and info
  const isWhite = game?.whitePlayerId === user?.id;
  const playerColor = isWhite ? 'white' : 'black';
  const opponent = isWhite ? game?.blackPlayer : game?.whitePlayer;
  const currentPlayer = isWhite ? game?.whitePlayer : game?.blackPlayer;

  // Chess game state
  const moves = useMemo(() => chess.history({ verbose: true }), [chess, chess.history().length]);
  const isWhiteTurn = chess.turn() === 'w';
  const isMyTurn = (isWhiteTurn && isWhite) || (!isWhiteTurn && !isWhite);

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

      // Initialize timers if time control is set
      if (data.game.timeControl) {
        setWhiteTime(data.game.timeControl);
        setBlackTime(data.game.timeControl);
      }

      // Load existing moves if any (for reconnection)
      if (data.game.pgn) {
        chess.loadPgn(data.game.pgn);
        setChessUpdate(prev => prev + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game');
    } finally {
      setIsLoading(false);
    }
  };

  // Timer effect
  useEffect(() => {
    if (!game?.timeControl || gameEnded) return;

    // Clear existing timer
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current);
    }

    // Start timer for current player
    turnTimerRef.current = setInterval(() => {
      if (isWhiteTurn) {
        setWhiteTime(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            // Time's up - will be handled by server
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBlackTime(prev => {
          if (prev === null) return null;
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => {
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current);
      }
    };
  }, [isWhiteTurn, game?.timeControl, gameEnded]);

  // Join game room and set up socket listeners
  useEffect(() => {
    if (!socket || !isConnected || !gameId || !user || !game) return;

    // Join the game room
    socket.emit('game:join', { gameId, userId: user.id });

    // Listen for moves from opponent
    const handleMove = (data: { from: string; to: string; promotion?: string; fen: string; pgn: string }) => {
      chess.load(data.fen);
      setChessUpdate(prev => prev + 1);

      // Reset timer for the player who just moved
      if (game.timeControl) {
        if (chess.turn() === 'w') {
          // Black just moved, reset black's timer
          setBlackTime(game.timeControl);
        } else {
          // White just moved, reset white's timer
          setWhiteTime(game.timeControl);
        }
      }
    };

    // Listen for game ended event
    const handleGameEnded = (data: GameEndedInfo) => {
      if (disconnectTimerRef.current) {
        clearInterval(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current);
        turnTimerRef.current = null;
      }
      setOpponentDisconnected(null);
      setGameEnded(data);
    };

    // Listen for opponent disconnect
    const handlePlayerDisconnected = (data: { color: 'white' | 'black'; reconnectTimeout: number }) => {
      const myColor = isWhite ? 'white' : 'black';
      if (data.color !== myColor) {
        setOpponentDisconnected({
          color: data.color,
          reconnectTimeout: data.reconnectTimeout,
          timeRemaining: Math.ceil(data.reconnectTimeout / 1000),
        });

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
      const myColor = isWhite ? 'white' : 'black';
      if (data.color !== myColor) {
        if (disconnectTimerRef.current) {
          clearInterval(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
        setOpponentDisconnected(null);
      }
    };

    // Draw offer events
    const handleDrawOffered = () => setDrawOfferState('received');
    const handleDrawOfferSent = () => setDrawOfferState('sent');
    const handleDrawDeclined = () => setDrawOfferState('none');
    const handleDrawOfferCancelled = () => setDrawOfferState('none');

    socket.on('game:move', handleMove);
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
      socket.off('game:move', handleMove);
      socket.off(`game:${gameId}:ended`, handleGameEnded);
      socket.off('game:playerDisconnected', handlePlayerDisconnected);
      socket.off('game:playerReconnected', handlePlayerReconnected);
      socket.off('game:drawOffered', handleDrawOffered);
      socket.off('game:drawOfferSent', handleDrawOfferSent);
      socket.off('game:drawDeclined', handleDrawDeclined);
      socket.off('game:drawOfferDeclined', handleDrawDeclined);
      socket.off('game:drawOfferCancelled', handleDrawOfferCancelled);
      socket.off('game:drawOfferCancelledConfirm', handleDrawOfferCancelled);

      if (disconnectTimerRef.current) {
        clearInterval(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
    };
  }, [socket, isConnected, gameId, user, game, isWhite, chess]);

  const handleBackToLobby = useCallback(() => {
    router.push('/lobby');
  }, [router]);

  // Handle chess move
  const handleMove = useCallback((from: Square, to: Square, promotion?: PieceSymbol) => {
    if (!socket || !isConnected || gameEnded) return;

    try {
      const move = chess.move({ from, to, promotion });
      if (move) {
        setChessUpdate(prev => prev + 1);

        // Reset my timer
        if (game?.timeControl) {
          if (isWhite) {
            setWhiteTime(game.timeControl);
          } else {
            setBlackTime(game.timeControl);
          }
        }

        // Send move to server
        socket.emit('game:move', {
          gameId,
          from,
          to,
          promotion,
          fen: chess.fen(),
          pgn: chess.pgn(),
        });
      }
    } catch (e) {
      console.error('Invalid move:', e);
    }
  }, [socket, isConnected, gameEnded, chess, game?.timeControl, isWhite, gameId]);

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
    } else if (gameEnded.reason === 'checkmate') {
      reasonText = userWon ? 'Checkmate! You win!' : 'Checkmate! You lost.';
    } else if (gameEnded.reason === 'stalemate') {
      reasonText = 'Stalemate - Draw!';
    } else if (gameEnded.reason === 'timeout') {
      reasonText = userWon ? 'Opponent ran out of time.' : 'You ran out of time.';
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

  // Opponent info (top of board)
  const opponentInfo = {
    username: opponent?.username || 'Opponent',
    color: (isWhite ? 'black' : 'white') as 'white' | 'black',
    isCurrentTurn: isWhite ? !isWhiteTurn : isWhiteTurn,
    timer: isWhite ? blackTime : whiteTime,
  };

  // Player info (bottom of board)
  const playerInfo = {
    username: currentPlayer?.username || 'You',
    color: playerColor as 'white' | 'black',
    isCurrentTurn: isMyTurn,
    timer: isWhite ? whiteTime : blackTime,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left sidebar - captured pieces and move history */}
        <div className="order-3 lg:order-1 space-y-4">
          <MoveHistory moves={moves} />
        </div>

        {/* Center - Chess board */}
        <div className="order-1 lg:order-2 lg:col-span-1">
          {/* Opponent info + timer */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1">
              <PlayerInfo
                username={opponentInfo.username}
                color={opponentInfo.color}
                isCurrentTurn={opponentInfo.isCurrentTurn}
                isOnline={!opponentDisconnected}
              />
            </div>
            {opponentInfo.timer !== null && (
              <div className="ml-2">
                <Timer
                  timeRemaining={opponentInfo.timer}
                  isActive={opponentInfo.isCurrentTurn}
                />
              </div>
            )}
          </div>

          {/* Captured pieces by opponent */}
          <div className="h-6 mb-1">
            <CapturedPieces moves={moves} color={opponentInfo.color} />
          </div>

          {/* Chess board */}
          <ChessBoard
            chess={chess}
            playerColor={playerColor}
            onMove={handleMove}
            disabled={!!gameEnded || !!opponentDisconnected}
          />

          {/* Captured pieces by player */}
          <div className="h-6 mt-1">
            <CapturedPieces moves={moves} color={playerColor} />
          </div>

          {/* Player info + timer */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex-1">
              <PlayerInfo
                username={playerInfo.username}
                color={playerInfo.color}
                isCurrentTurn={playerInfo.isCurrentTurn}
                isOnline={true}
              />
            </div>
            {playerInfo.timer !== null && (
              <div className="ml-2">
                <Timer
                  timeRemaining={playerInfo.timer}
                  isActive={playerInfo.isCurrentTurn}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar - game controls */}
        <div className="order-2 lg:order-3 space-y-4">
          <Card>
            <h3 className="font-medium text-gray-900 dark:text-white mb-4">Game Controls</h3>

            {/* Draw offer received banner */}
            {drawOfferState === 'received' && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                  {opponent?.username || 'Opponent'} offers a draw
                </p>
                <div className="flex gap-2">
                  <Button onClick={handleAcceptDraw} size="sm" className="bg-blue-600 hover:bg-blue-700">
                    Accept
                  </Button>
                  <Button onClick={handleDeclineDraw} size="sm" variant="secondary">
                    Decline
                  </Button>
                </div>
              </div>
            )}

            {/* Draw offer sent banner */}
            {drawOfferState === 'sent' && (
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Draw offer sent...
                </p>
                <Button onClick={handleCancelDrawOffer} size="sm" variant="secondary">
                  Cancel
                </Button>
              </div>
            )}

            <div className="space-y-2">
              {drawOfferState === 'none' && (
                <Button
                  onClick={handleOfferDraw}
                  variant="secondary"
                  className="w-full"
                  disabled={!!opponentDisconnected}
                >
                  Offer Draw
                </Button>
              )}
              <Button
                onClick={() => setShowResignConfirm(true)}
                variant="secondary"
                className="w-full text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
              >
                Resign
              </Button>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Game ID: {game.id.slice(0, 8)}...
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Time Control: {game.timeControl ? `${game.timeControl / 60} min/turn` : 'No limit'}
              </p>
            </div>
          </Card>
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
              <Button onClick={() => setShowResignConfirm(false)} variant="secondary">
                Cancel
              </Button>
              <Button onClick={handleResign} className="bg-red-600 hover:bg-red-700">
                Resign
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
