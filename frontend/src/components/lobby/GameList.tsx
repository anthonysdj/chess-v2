'use client';

import { Game } from '@/types';
import GameCard from './GameCard';

interface GameListProps {
  games: Game[];
  currentUserId: string;
  onJoin: (gameId: string) => void;
  onCancel: (gameId: string) => void;
  joiningGameId?: string | null;
}

export default function GameList({
  games,
  currentUserId,
  onJoin,
  onCancel,
  joiningGameId,
}: GameListProps) {
  if (games.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <svg
          className="w-16 h-16 mx-auto mb-4 opacity-50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <p className="text-lg mb-2">No games available</p>
        <p className="text-sm">Create a new game to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          currentUserId={currentUserId}
          onJoin={onJoin}
          onCancel={onCancel}
          isJoining={joiningGameId === game.id}
        />
      ))}
    </div>
  );
}
