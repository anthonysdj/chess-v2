import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { AuthRequest, RegisterInput, LoginInput, ResetPasswordInput } from '../types';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { username, email, password } = req.body as RegisterInput;

      // Validate required fields
      if (!username || !email || !password) {
        res.status(400).json({ error: 'All fields are required' });
        return;
      }

      const user = await authService.register({ username, email, password });

      res.status(201).json({
        message: 'Registration successful',
        user,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      res.status(400).json({ error: message });
    }
  },

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, rememberMe } = req.body as LoginInput;

      // Validate required fields
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      const { user, token } = await authService.login({ email, password });

      // Set cookie with token
      const cookieOptions = {
        ...COOKIE_OPTIONS,
        maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : undefined, // 7 days or session
      };

      res.cookie('token', token, cookieOptions);

      res.json({
        message: 'Login successful',
        user,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      res.status(401).json({ error: message });
    }
  },

  async logout(_req: Request, res: Response): Promise<void> {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.json({ message: 'Logout successful' });
  },

  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email, newPassword } = req.body as ResetPasswordInput;

      // Validate required fields
      if (!email || !newPassword) {
        res.status(400).json({ error: 'Email and new password are required' });
        return;
      }

      await authService.resetPassword({ email, newPassword });

      res.json({ message: 'Password reset successful' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password reset failed';
      res.status(400).json({ error: message });
    }
  },

  async me(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      res.json({ user: req.user });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user info' });
    }
  },
};
