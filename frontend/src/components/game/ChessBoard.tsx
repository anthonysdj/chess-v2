'use client';

import { useState, useCallback } from 'react';
import { Chess, Square, PieceSymbol, Color } from 'chess.js';

interface ChessBoardProps {
  chess: Chess;
  playerColor: 'white' | 'black';
  onMove: (from: Square, to: Square, promotion?: PieceSymbol) => void;
  disabled?: boolean;
}

const PIECE_SYMBOLS: Record<PieceSymbol, Record<Color, string>> = {
  p: { w: '♙', b: '♟' },
  n: { w: '♘', b: '♞' },
  b: { w: '♗', b: '♝' },
  r: { w: '♖', b: '♜' },
  q: { w: '♕', b: '♛' },
  k: { w: '♔', b: '♚' },
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export default function ChessBoard({ chess, playerColor, onMove, disabled = false }: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [showPromotion, setShowPromotion] = useState<{ from: Square; to: Square } | null>(null);

  const isFlipped = playerColor === 'black';
  const turn = chess.turn();
  const isMyTurn = (turn === 'w' && playerColor === 'white') || (turn === 'b' && playerColor === 'black');

  // Get last move for highlighting
  const history = chess.history({ verbose: true });
  const lastMove = history.length > 0 ? history[history.length - 1] : null;

  const handleSquareClick = useCallback((square: Square) => {
    if (disabled || !isMyTurn) return;

    const piece = chess.get(square);

    // If clicking on own piece, select it
    if (piece && piece.color === turn) {
      setSelectedSquare(square);
      const moves = chess.moves({ square, verbose: true });
      setLegalMoves(moves.map(m => m.to as Square));
      return;
    }

    // If a piece is selected and clicking on a legal move target
    if (selectedSquare && legalMoves.includes(square)) {
      const movingPiece = chess.get(selectedSquare);

      // Check for pawn promotion
      if (movingPiece?.type === 'p') {
        const isPromotion =
          (movingPiece.color === 'w' && square[1] === '8') ||
          (movingPiece.color === 'b' && square[1] === '1');

        if (isPromotion) {
          setShowPromotion({ from: selectedSquare, to: square });
          return;
        }
      }

      onMove(selectedSquare, square);
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    // Deselect
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [chess, disabled, isMyTurn, legalMoves, onMove, selectedSquare, turn]);

  const handlePromotion = useCallback((piece: PieceSymbol) => {
    if (showPromotion) {
      onMove(showPromotion.from, showPromotion.to, piece);
      setShowPromotion(null);
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [onMove, showPromotion]);

  const isSquareHighlighted = (square: Square): boolean => {
    return square === selectedSquare;
  };

  const isLegalMoveSquare = (square: Square): boolean => {
    return legalMoves.includes(square);
  };

  const isLastMoveSquare = (square: Square): boolean => {
    return lastMove ? (lastMove.from === square || lastMove.to === square) : false;
  };

  const isCheckSquare = (square: Square): boolean => {
    if (!chess.isCheck()) return false;
    const piece = chess.get(square);
    return piece?.type === 'k' && piece.color === turn;
  };

  // Generate squares array based on player perspective
  const squares: { square: Square; row: number; col: number }[] = [];

  for (let visualRow = 0; visualRow < 8; visualRow++) {
    for (let visualCol = 0; visualCol < 8; visualCol++) {
      // For white: top row (visualRow=0) is rank 8, bottom row (visualRow=7) is rank 1
      // For black: top row (visualRow=0) is rank 1, bottom row (visualRow=7) is rank 8
      const rank = isFlipped ? visualRow + 1 : 8 - visualRow;
      // For white: left col (visualCol=0) is file a, right col (visualCol=7) is file h
      // For black: left col (visualCol=0) is file h, right col (visualCol=7) is file a
      const fileIndex = isFlipped ? 7 - visualCol : visualCol;
      const file = FILES[fileIndex];
      const square = `${file}${rank}` as Square;

      squares.push({ square, row: visualRow, col: visualCol });
    }
  }

  return (
    <div className="relative w-full max-w-[400px] mx-auto">
      <div className="grid grid-cols-8 grid-rows-8 aspect-square border-2 border-board-dark rounded overflow-hidden shadow-lg">
        {squares.map(({ square, row, col }) => {
          // Get piece from chess.js using the square name directly
          const piece = chess.get(square);

          // Calculate square color: a1 is dark, h1 is light, etc.
          const file = square.charCodeAt(0) - 'a'.charCodeAt(0); // 0-7
          const rank = parseInt(square[1]) - 1; // 0-7
          const isLight = (file + rank) % 2 === 1;

          let squareClasses = `relative ${isLight ? 'bg-board-light' : 'bg-board-dark'}`;

          if (isSquareHighlighted(square)) {
            squareClasses += ' ring-2 ring-inset ring-yellow-400';
          }

          if (isLastMoveSquare(square)) {
            squareClasses += ' after:absolute after:inset-0 after:bg-yellow-300/30';
          }

          if (isCheckSquare(square)) {
            squareClasses += ' !bg-red-500/70';
          }

          // Display rank number on left edge (col === 0)
          const showRank = col === 0;
          // Display file letter on bottom edge (row === 7)
          const showFile = row === 7;

          return (
            <div
              key={square}
              className={`${squareClasses} w-full h-full`}
              onClick={() => handleSquareClick(square)}
            >
              {/* Coordinate labels */}
              {showRank && (
                <span className={`absolute top-0 left-0.5 text-[10px] font-medium ${isLight ? 'text-board-dark' : 'text-board-light'} opacity-70 pointer-events-none`}>
                  {square[1]}
                </span>
              )}
              {showFile && (
                <span className={`absolute bottom-0 right-0.5 text-[10px] font-medium ${isLight ? 'text-board-dark' : 'text-board-light'} opacity-70 pointer-events-none`}>
                  {square[0]}
                </span>
              )}

              {/* Piece */}
              {piece && (
                <span
                  className={`absolute inset-0 flex items-center justify-center text-3xl sm:text-4xl cursor-pointer select-none ${
                    piece.color === 'w' ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : 'text-gray-900'
                  }`}
                >
                  {PIECE_SYMBOLS[piece.type][piece.color]}
                </span>
              )}

              {/* Legal move indicator */}
              {isLegalMoveSquare(square) && (
                <div className={`absolute ${piece ? 'inset-0 border-2 border-green-500/60 rounded' : 'inset-0 flex items-center justify-center'}`}>
                  {!piece && <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Promotion modal */}
      {showPromotion && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-xl">
            <p className="text-center mb-3 font-medium text-gray-900 dark:text-white">
              Choose promotion
            </p>
            <div className="flex gap-2">
              {(['q', 'r', 'b', 'n'] as PieceSymbol[]).map((piece) => (
                <button
                  key={piece}
                  onClick={() => handlePromotion(piece)}
                  className="w-14 h-14 text-4xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded flex items-center justify-center"
                >
                  {PIECE_SYMBOLS[piece][playerColor === 'white' ? 'w' : 'b']}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Turn indicator overlay when not your turn */}
      {!isMyTurn && !disabled && (
        <div className="absolute inset-0 bg-black/10 flex items-center justify-center pointer-events-none">
          <span className="bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium">
            Opponent&apos;s turn
          </span>
        </div>
      )}
    </div>
  );
}
