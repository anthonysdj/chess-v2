'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import { User, RegisterInput, LoginInput } from '@/types';
import { api, ApiError } from '@/lib/api';
import { emitLogout } from '@/lib/socket';

const USER_STORAGE_KEY = 'chess-user';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function setStoredUser(user: User | null): void {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Check authentication status on mount
  useEffect(() => {
    const storedUser = getStoredUser();

    if (storedUser) {
      // Use stored user immediately
      setUser(storedUser);
      setIsLoading(false);

      // Verify session is still valid in background
      api.auth.me()
        .then(({ user }) => {
          setUser(user);
          setStoredUser(user);
        })
        .catch(() => {
          // Session expired, clear stored user
          setUser(null);
          setStoredUser(null);
        });
    } else {
      // No stored user, assume not logged in
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const login = async (input: LoginInput) => {
    setIsLoading(true);
    setError(null);

    try {
      const { user } = await api.auth.login(input);
      setUser(user);
      setStoredUser(user);
      router.push('/lobby');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (input: RegisterInput) => {
    setIsLoading(true);
    setError(null);

    try {
      await api.auth.register(input);
      // Auto login after registration
      await login({ email: input.email, password: input.password });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);

    try {
      // Emit logout event to cancel any waiting games before disconnecting
      if (user) {
        emitLogout(user.id);
      }

      await api.auth.logout();
      setUser(null);
      setStoredUser(null);
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
      // Clear local state even if server logout fails
      setUser(null);
      setStoredUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
