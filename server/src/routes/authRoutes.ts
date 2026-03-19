import { Router } from 'express';
import {
  register,
  login,
  completeOnboarding,
  me,
  progressLevel,
  resetLevel,
  streakSummary,
  completeLevelById,
  getLevelMetadata,
  setLevelMetadata,
} from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.patch('/complete-onboarding', requireAuth, completeOnboarding);
router.get('/me', requireAuth, me);
router.get('/streak', requireAuth, streakSummary);
router.post('/level/reset', requireAuth, resetLevel);
router.post('/level/progress', requireAuth, progressLevel);
router.post('/level/:level/complete', requireAuth, completeLevelById);
router.get('/level-metadata', requireAuth, getLevelMetadata);
router.patch('/level-metadata/:level', requireAuth, setLevelMetadata);

export default router;
