import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { AuthController } from '../controllers/auth.controller.js';

const controller = new AuthController();

export const authRoutes = Router();

authRoutes.post('/request-code', controller.requestCode);
authRoutes.post('/verify-code', controller.verifyCode);
authRoutes.get('/me', requireAuth, controller.me);
