'use client';

interface TimerProps {
  timeRemaining: number; // in seconds
  isActive: boolean;
  isLow?: boolean; // Show warning when time is low
}

export default function Timer({ timeRemaining, isActive, isLow = false }: TimerProps) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  const isWarning = isLow || timeRemaining <= 30;
  const isCritical = timeRemaining <= 10;

  return (
    <div
      className={`px-4 py-2 rounded-lg font-mono text-2xl font-bold transition-colors ${
        isActive
          ? isCritical
            ? 'bg-red-600 text-white animate-pulse'
            : isWarning
            ? 'bg-yellow-500 text-gray-900'
            : 'bg-primary-600 text-white'
          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
      }`}
    >
      {minutes}:{seconds.toString().padStart(2, '0')}
    </div>
  );
}
