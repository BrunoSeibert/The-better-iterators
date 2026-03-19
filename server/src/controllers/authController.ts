import { Request, Response } from 'express';
import * as authService from '../services/authService';
import { AuthRequest } from '../middleware/auth';

export async function completeOnboarding(req: Request, res: Response) {
  try {
    const { currentLevel, completedStages, universityId, studyProgramId, degreeType, fieldIds } = req.body;
    const userId = (req as AuthRequest).userId;
    const result = await authService.completeOnboarding(userId, currentLevel, completedStages, universityId, studyProgramId, degreeType, fieldIds);
    res.json({ token: result.token });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

type AuthedRequest = Request & { userId?: string };

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

export async function me(req: AuthedRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await authService.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Unknown error' });
  }
}

export async function resetLevel(req: AuthedRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await authService.resetLevel(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Unknown error' });
  }
}

export async function progressLevel(req: AuthedRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await authService.progressLevel(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Unknown error' });
  }
}

export async function streakSummary(req: AuthedRequest, res: Response) {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const summary = await authService.getStreakSummary(req.userId);
    if (!summary) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(summary);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Unknown error' });
  }
}
