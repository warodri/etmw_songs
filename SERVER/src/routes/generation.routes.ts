import { Router } from 'express';
import { GenerationController } from '../controllers/generation.controller.js';

const controller = new GenerationController();

export const generationRoutes = Router();

generationRoutes.post('/', controller.create);
generationRoutes.get('/active', controller.listActive);
generationRoutes.get('/:id', controller.get);
generationRoutes.post('/:id/cancel', controller.cancel);
