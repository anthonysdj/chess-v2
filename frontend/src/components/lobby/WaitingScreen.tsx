'use client';

import { useEffect, useState } from 'react';
import { Game } from '@/types';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

interface WaitingScreenProps {
  game: Game;
  onCancel: () => void;
  isCancelling: boolean;
}

function formatTimeControl(seconds: number | null): string {
  if (seconds === null) return 'No limit';
  const minutes = seconds / 60;
  return `${minutes} min/turn`;
}

function formatElapsedTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function WaitingScreen({
  game,
  onCancel,
  isCancelling,
}: WaitingScreenProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const startTime = new Date(game.createdAt).getTime();

    const updateElapsed = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      setElapsedSeconds(elapsed);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [game.createdAt]);

  const timeRemaining = Math.max(0, 300 - elapsedSeconds); // 5 min timeout

  return (
    <div className="max-w-md mx-auto">
      <Card className="text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-primary-600 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Waiting for opponent...
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Your game is visible in the lobby
          </p>
        </div>

        <div className="space-y-3 mb-6 text-left bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Time Control</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatTimeControl(game.timeControl)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Waiting Time</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatElapsedTime(elapsedSeconds)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Auto-cancel in</span>
            <span className={`font-medium ${timeRemaining < 60 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
              {formatElapsedTime(timeRemaining)}
            </span>
          </div>
        </div>

        <Button
          variant="danger"
          className="w-full"
          onClick={onCancel}
          isLoading={isCancelling}
          disabled={isCancelling}
        >
          Cancel Game
        </Button>
      </Card>
    </div>
  );
}
