import { Response } from 'express';
import { Types, isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { PlaylistModel, type PlaylistDocument } from '../models/playlist.model.js';
import { SongModel, toPublicSong } from '../models/song.model.js';
import { ApiError } from '../utils/errors.js';

const createSchema = z.object({
    name: z.string().trim().min(1).max(80),
});

const updateSchema = z.object({
    name: z.string().trim().min(1).max(80),
});

const songSchema = z.object({
    songId: z.string(),
});

const reorderSchema = z.object({
    songIds: z.array(z.string()).max(500),
});

export class PlaylistController {
    list = async (request: AuthenticatedRequest, response: Response) => {
        const playlists = await PlaylistModel.find({ userId: request.user!.id }).sort({ createdAt: -1 });
        response.json({
            playlists: playlists.map(playlist => ({
                id: playlist._id.toString(),
                name: playlist.name,
                songCount: playlist.songIds.length,
                createdAt: (playlist.get('createdAt') as Date | undefined) ?? playlist._id.getTimestamp(),
                updatedAt: (playlist.get('updatedAt') as Date | undefined) ?? playlist._id.getTimestamp(),
            })),
        });
    };

    get = async (request: AuthenticatedRequest, response: Response) => {
        const playlist = await this.findOwnedPlaylist(request);
        const songs = await SongModel.find({
            _id: { $in: playlist.songIds },
            userId: request.user!.id,
        });
        const byId = new Map(songs.map(song => [song._id.toString(), song]));
        const ordered = playlist.songIds
            .map(id => byId.get(id.toString()))
            .filter((song): song is NonNullable<typeof song> => Boolean(song));

        response.json({
            playlist: {
                id: playlist._id.toString(),
                name: playlist.name,
                songs: ordered.map(toPublicSong),
                createdAt: (playlist.get('createdAt') as Date | undefined) ?? playlist._id.getTimestamp(),
                updatedAt: (playlist.get('updatedAt') as Date | undefined) ?? playlist._id.getTimestamp(),
            },
        });
    };

    create = async (request: AuthenticatedRequest, response: Response) => {
        const body = createSchema.parse(request.body);
        const playlist = await PlaylistModel.create({
            userId: request.user!.id,
            name: body.name,
            songIds: [],
        });
        response.status(201).json({
            playlist: {
                id: playlist._id.toString(),
                name: playlist.name,
                songCount: 0,
                createdAt: (playlist.get('createdAt') as Date | undefined) ?? playlist._id.getTimestamp(),
                updatedAt: (playlist.get('updatedAt') as Date | undefined) ?? playlist._id.getTimestamp(),
            },
        });
    };

    update = async (request: AuthenticatedRequest, response: Response) => {
        const body = updateSchema.parse(request.body);
        const playlist = await this.findOwnedPlaylist(request);
        playlist.name = body.name;
        await playlist.save();
        response.json({ playlist: { id: playlist._id.toString(), name: playlist.name } });
    };

    remove = async (request: AuthenticatedRequest, response: Response) => {
        const playlist = await this.findOwnedPlaylist(request);
        await PlaylistModel.deleteOne({ _id: playlist._id, userId: request.user!.id });
        response.json({ deleted: true });
    };

    addSong = async (request: AuthenticatedRequest, response: Response) => {
        const body = songSchema.parse(request.body);
        if (!isValidObjectId(body.songId)) {
            throw new ApiError(404, 'SONG_NOT_FOUND', 'Song not found.');
        }

        const song = await SongModel.findOne({ _id: body.songId, userId: request.user!.id });
        if (!song) {
            throw new ApiError(404, 'SONG_NOT_FOUND', 'Song not found.');
        }

        const playlist = await this.findOwnedPlaylist(request);
        if (!playlist.songIds.some(id => id.toString() === body.songId)) {
            playlist.songIds.push(song._id);
            await playlist.save();
        }

        response.json({ playlist: { id: playlist._id.toString(), name: playlist.name, songCount: playlist.songIds.length } });
    };

    removeSong = async (request: AuthenticatedRequest, response: Response) => {
        const songId = request.params.songId;
        const playlist = await this.findOwnedPlaylist(request);
        playlist.songIds = playlist.songIds.filter(id => id.toString() !== songId);
        await playlist.save();
        response.json({ playlist: { id: playlist._id.toString(), name: playlist.name, songCount: playlist.songIds.length } });
    };

    reorder = async (request: AuthenticatedRequest, response: Response) => {
        const body = reorderSchema.parse(request.body);
        const playlist = await this.findOwnedPlaylist(request);
        const existing = new Set(playlist.songIds.map(id => id.toString()));
        const ordered: Types.ObjectId[] = [];
        const used = new Set<string>();

        for (const id of body.songIds) {
            if (existing.has(id) && !used.has(id)) {
                ordered.push(new Types.ObjectId(id));
                used.add(id);
            }
        }

        for (const id of playlist.songIds) {
            const key = id.toString();
            if (!used.has(key)) {
                ordered.push(id);
            }
        }

        playlist.songIds = ordered;
        await playlist.save();
        response.json({ playlist: { id: playlist._id.toString(), name: playlist.name, songCount: playlist.songIds.length } });
    };

    private async findOwnedPlaylist(request: AuthenticatedRequest): Promise<PlaylistDocument> {
        const id = request.params.id;
        if (!isValidObjectId(id)) {
            throw new ApiError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found.');
        }

        const playlist = await PlaylistModel.findOne({ _id: id, userId: request.user!.id });
        if (!playlist) {
            throw new ApiError(404, 'PLAYLIST_NOT_FOUND', 'Playlist not found.');
        }

        return playlist;
    }
}
