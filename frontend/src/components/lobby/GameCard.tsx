'use client';

import { Game } from '@/types';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

interface GameCardProps {
  game: Game;
  currentUserId: string;
  onJoin: (gameId: string) => void;
  onCancel: (gameId: string) => void;
  isJoining?: boolean;
}

function formatTimeControl(seconds: number | null): string {
  if (seconds === null) return 'No limit';
  const minutes = seconds / 60;
  return `${minutes} min/turn`;
}

export default function GameCard({
  game,
  currentUserId,
  onJoin,
  onCancel,
  isJoining,
}: GameCardProps) {
  const isCreator = game.creatorId === currentUserId;
  const playerCount = game.whitePlayer && game.blackPlayer ? 2 : 1;

  return (
    <Card className="flex items-center justify-between p-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 dark:text-white">
            {game.creator.username}
          </span>
          {isCreator && (
            <span className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded">
              You
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatTimeControl(game.timeControl)}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {playerCount}/2
          </span>
        </div>
      </div>

      <div>
        {isCreator ? (
          <Button
            variant="danger"
            size="sm"
            onClick={() => onCancel(game.id)}
          >
            Cancel
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onJoin(game.id)}
            isLoading={isJoining}
            disabled={isJoining}
          >
            Join
          </Button>
        )}
      </div>
    </Card>
  );
}
