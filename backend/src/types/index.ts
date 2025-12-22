import { Request } from 'express';

export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRequest extends Request {
  user?: User;
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

export interface JwtPayload {
  userId: string;
  email: string;
}
