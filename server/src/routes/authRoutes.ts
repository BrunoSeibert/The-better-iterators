import { Router } from 'express';
import { register, login, completeOnboarding } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.patch('/complete-onboarding', requireAuth, completeOnboarding);

export default router;
