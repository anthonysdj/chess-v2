'use client';

import { useEffect, useRef } from 'react';
import { Move } from 'chess.js';

interface MoveHistoryProps {
  moves: Move[];
}

export default function MoveHistory({ moves }: MoveHistoryProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new moves are added
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [moves.length]);

  // Group moves into pairs (white, black)
  const movePairs: { number: number; white?: Move; black?: Move }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  if (moves.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 dark:text-white mb-2">Move History</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">No moves yet</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <h3 className="font-medium text-gray-900 dark:text-white">Move History</h3>
      </div>
      <div
        ref={containerRef}
        className="max-h-64 overflow-y-auto p-2"
      >
        <table className="w-full text-sm">
          <tbody>
            {movePairs.map((pair) => (
              <tr
                key={pair.number}
                className="hover:bg-gray-100 dark:hover:bg-gray-700/50"
              >
                <td className="w-8 px-2 py-1 text-gray-500 dark:text-gray-400 font-medium">
                  {pair.number}.
                </td>
                <td className="px-2 py-1 font-mono text-gray-900 dark:text-white">
                  {pair.white?.san || ''}
                </td>
                <td className="px-2 py-1 font-mono text-gray-900 dark:text-white">
                  {pair.black?.san || ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
