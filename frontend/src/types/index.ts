export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  message: string;
  user: User;
}

export interface ErrorResponse {
  error: string;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface ResetPasswordInput {
  email: string;
  newPassword: string;
}

// Game types (for future use)
export type GameStatus = 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type GameResult = 'WHITE_WIN' | 'BLACK_WIN' | 'DRAW';

export interface Game {
  id: string;
  status: GameStatus;
  timeControl: number | null;
  result: GameResult | null;
  creatorId: string;
  creator: User;
  whitePlayerId: string | null;
  whitePlayer: User | null;
  blackPlayerId: string | null;
  blackPlayer: User | null;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface PlayerStats {
  id: string;
  wins: number;
  losses: number;
  draws: number;
  totalPlayTimeSeconds: number;
}
