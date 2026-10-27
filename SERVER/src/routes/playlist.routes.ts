import { Router } from 'express';
import { PlaylistController } from '../controllers/playlist.controller.js';

const controller = new PlaylistController();

export const playlistRoutes = Router();

playlistRoutes.get('/', controller.list);
playlistRoutes.post('/', controller.create);
playlistRoutes.get('/:id', controller.get);
playlistRoutes.patch('/:id', controller.update);
playlistRoutes.delete('/:id', controller.remove);
playlistRoutes.post('/:id/songs', controller.addSong);
playlistRoutes.delete('/:id/songs/:songId', controller.removeSong);
playlistRoutes.put('/:id/order', controller.reorder);
