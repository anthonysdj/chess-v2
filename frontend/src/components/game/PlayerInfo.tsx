'use client';

interface PlayerInfoProps {
  username: string;
  color: 'white' | 'black';
  isCurrentTurn: boolean;
  isOnline?: boolean;
}

export default function PlayerInfo({ username, color, isCurrentTurn, isOnline = true }: PlayerInfoProps) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
        isCurrentTurn
          ? 'bg-primary-100 dark:bg-primary-900/30 border-2 border-primary-500'
          : 'bg-gray-100 dark:bg-gray-800 border-2 border-transparent'
      }`}
    >
      {/* Player avatar/icon */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${
          color === 'white' ? 'bg-white border-2 border-gray-300' : 'bg-gray-900'
        }`}
      >
        <span className={`text-xl ${color === 'white' ? 'text-gray-900' : 'text-white'}`}>
          {color === 'white' ? '♔' : '♚'}
        </span>
      </div>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-white truncate">
            {username}
          </span>
          {/* Online indicator */}
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-green-500' : 'bg-gray-400'
            }`}
            title={isOnline ? 'Online' : 'Offline'}
          />
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">
          {color}
        </span>
      </div>

      {/* Turn indicator */}
      {isCurrentTurn && (
        <div className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
          <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
          <span className="text-sm font-medium">Turn</span>
        </div>
      )}
    </div>
  );
}
