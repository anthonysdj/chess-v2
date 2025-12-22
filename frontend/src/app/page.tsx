'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import Button from '@/components/ui/Button';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/lobby');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4">
      <div className="text-center max-w-2xl mx-auto">
        {/* Chess Icon */}
        <div className="mb-8">
          <svg
            className="w-24 h-24 mx-auto text-primary-600"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M19 22H5v-2h14v2M17.16 8.26A2.99 2.99 0 0 0 15 7H9a2.99 2.99 0 0 0-2.16 1.26L3 13h18l-3.84-4.74M12 2c1.1 0 2 .9 2 2a2 2 0 0 1-2 2 2 2 0 0 1-2-2c0-1.1.9-2 2-2m-5 9h10l-1 5H8l-1-5Z" />
          </svg>
        </div>

        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Play Chess Online
        </h1>

        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
          Challenge players from around the world in real-time multiplayer chess.
          Create a game, invite friends, and start playing!
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/register">
            <Button size="lg">Get Started</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="lg">
              Sign In
            </Button>
          </Link>
        </div>

        {/* Features */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Real-time Play
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Instant move updates with WebSocket technology
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Time Controls
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Choose from 1, 3, or 5 minute per turn limits
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Track Stats
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Keep track of wins, losses, and play time
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
