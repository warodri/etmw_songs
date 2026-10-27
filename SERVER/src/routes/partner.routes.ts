import { Router } from 'express';
import { GenerationController } from '../controllers/generation.controller.js';
import { SongController } from '../controllers/song.controller.js';
import { ApiKeyRequest } from '../middleware/api-key.middleware.js';

const generations = new GenerationController();
const songs = new SongController();

export const partnerRoutes = Router();

partnerRoutes.get('/me', (request: ApiKeyRequest, response) => {
    response.json({ user: request.user });
});

partnerRoutes.post('/generations', generations.create);
partnerRoutes.get('/generations/:id', generations.get);
partnerRoutes.post('/generations/:id/cancel', generations.cancel);

partnerRoutes.get('/songs', songs.list);
partnerRoutes.get('/songs/:id', songs.get);
partnerRoutes.get('/songs/:id/audio', songs.audio);
