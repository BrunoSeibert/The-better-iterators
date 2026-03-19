import { Request, Response } from 'express';
import * as authService from '../services/authService';
import { AuthRequest } from '../middleware/auth';

export async function completeOnboarding(req: Request, res: Response) {
  try {
    const { level, universityId, studyProgramId, degreeType, fieldIds } = req.body;
    const userId = (req as AuthRequest).userId;
    await authService.completeOnboarding(userId, level, universityId, studyProgramId, degreeType, fieldIds);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function register(req: Request, res: Response) {
  try {

    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    const result = await authService.register(name, email, password);
    res.status(201).json(result);
  } catch (err: any) {

    res.status(400).json({ error: err.message || err.toString() || 'Unknown error' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
}
