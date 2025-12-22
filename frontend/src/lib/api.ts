import {
  User,
  AuthResponse,
  RegisterInput,
  LoginInput,
  ResetPasswordInput,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Important for cookies
  };

  const response = await fetch(url, config);

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, data.error || 'An error occurred');
  }

  return data;
}

export const api = {
  auth: {
    async register(input: RegisterInput): Promise<AuthResponse> {
      return request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    async login(input: LoginInput): Promise<AuthResponse> {
      return request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    async logout(): Promise<{ message: string }> {
      return request<{ message: string }>('/auth/logout', {
        method: 'POST',
      });
    },

    async resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
      return request<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },

    async me(): Promise<{ user: User }> {
      return request<{ user: User }>('/auth/me');
    },
  },
};

export { ApiError };
