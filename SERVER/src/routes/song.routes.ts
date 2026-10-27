import { Router } from 'express';
import { SongController } from '../controllers/song.controller.js';

const controller = new SongController();

export const songRoutes = Router();

songRoutes.get('/', controller.list);
songRoutes.get('/:id', controller.get);
songRoutes.get('/:id/audio', controller.audio);
songRoutes.patch('/:id', controller.rename);
songRoutes.delete('/:id', controller.remove);
