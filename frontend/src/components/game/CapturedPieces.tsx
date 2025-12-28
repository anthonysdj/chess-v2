'use client';

import { Move, PieceSymbol } from 'chess.js';

interface CapturedPiecesProps {
  moves: Move[];
  color: 'white' | 'black'; // Which color's captured pieces to show
}

const PIECE_SYMBOLS: Record<PieceSymbol, string> = {
  p: '♟',
  n: '♞',
  b: '♝',
  r: '♜',
  q: '♛',
  k: '♚',
};

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export default function CapturedPieces({ moves, color }: CapturedPiecesProps) {
  // Get captured pieces for the specified color
  // If color is 'white', we want pieces captured BY white (black pieces that were taken)
  const capturedPieces: PieceSymbol[] = [];

  moves.forEach((move) => {
    if (move.captured) {
      // If move was made by white (move.color === 'w'), white captured a black piece
      const capturedByWhite = move.color === 'w';
      if ((color === 'white' && capturedByWhite) || (color === 'black' && !capturedByWhite)) {
        capturedPieces.push(move.captured);
      }
    }
  });

  // Sort by piece value (high to low)
  capturedPieces.sort((a, b) => PIECE_VALUES[b] - PIECE_VALUES[a]);

  // Calculate material advantage
  const totalValue = capturedPieces.reduce((sum, piece) => sum + PIECE_VALUES[piece], 0);

  if (capturedPieces.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {capturedPieces.map((piece, index) => (
        <span
          key={`${piece}-${index}`}
          className={`text-lg ${
            color === 'white' ? 'text-gray-900' : 'text-gray-700'
          }`}
        >
          {PIECE_SYMBOLS[piece]}
        </span>
      ))}
      {totalValue > 0 && (
        <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
          +{totalValue}
        </span>
      )}
    </div>
  );
}
