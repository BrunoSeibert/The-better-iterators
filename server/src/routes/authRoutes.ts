import { Router } from 'express';
import {
  register,
  login,
  me,
  progressLevel,
  resetLevel,
  streakSummary,
} from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', requireAuth, me);
router.get('/streak', requireAuth, streakSummary);
router.post('/level/reset', requireAuth, resetLevel);
router.post('/level/progress', requireAuth, progressLevel);

export default router;
