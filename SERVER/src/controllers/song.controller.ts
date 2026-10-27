import { Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { PlaylistModel } from '../models/playlist.model.js';
import { SongModel, toPublicSong } from '../models/song.model.js';
import { storage } from '../services/storage.service.js';
import { ApiError } from '../utils/errors.js';

const renameSchema = z.object({
    title: z.string().trim().min(1).max(120),
});

export class SongController {
    list = async (request: AuthenticatedRequest, response: Response) => {
        const songs = await SongModel.find({ userId: request.user!.id }).sort({ createdAt: -1 });
        response.json({ songs: songs.map(toPublicSong) });
    };

    get = async (request: AuthenticatedRequest, response: Response) => {
        const song = await this.findOwnedSong(request);
        response.json({ song: toPublicSong(song) });
    };

    audio = async (request: AuthenticatedRequest, response: Response) => {
        const song = await this.findOwnedSong(request);
        response.setHeader('Content-Type', song.mimeType || 'audio/mpeg');
        response.setHeader('Cache-Control', 'private, max-age=3600');
        response.sendFile(storage.absolute(song.filename));
    };

    rename = async (request: AuthenticatedRequest, response: Response) => {
        const body = renameSchema.parse(request.body);
        const song = await this.findOwnedSong(request);
        song.title = body.title;
        await song.save();
        response.json({ song: toPublicSong(song) });
    };

    remove = async (request: AuthenticatedRequest, response: Response) => {
        const song = await this.findOwnedSong(request);
        await storage.remove(song.filename);
        await SongModel.deleteOne({ _id: song._id, userId: request.user!.id });
        await PlaylistModel.updateMany(
            { userId: request.user!.id },
            { $pull: { songIds: song._id } }
        );
        response.json({ deleted: true });
    };

    private async findOwnedSong(request: AuthenticatedRequest) {
        const id = request.params.id;
        if (!isValidObjectId(id)) {
            throw new ApiError(404, 'SONG_NOT_FOUND', 'Song not found.');
        }

        const song = await SongModel.findOne({ _id: id, userId: request.user!.id });
        if (!song) {
            throw new ApiError(404, 'SONG_NOT_FOUND', 'Song not found.');
        }

        return song;
    }
}
