import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { touchDailyLogin } from '../services/authService';

export interface AuthRequest extends Request {
  userId: string;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    (req as AuthRequest).userId = payload.userId;
    await touchDailyLogin(payload.userId);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
