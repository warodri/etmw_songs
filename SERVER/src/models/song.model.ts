import { HydratedDocument, InferSchemaType, Schema, Types, model } from 'mongoose';

const songSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        title: { type: String, required: true, trim: true, maxlength: 120 },
        lyrics: { type: String, required: true },
        tags: { type: [String], default: [] },
        durationSeconds: { type: Number, required: true },
        filename: { type: String, required: true },
        mimeType: { type: String, default: 'audio/mpeg' },
        sizeBytes: { type: Number, required: true },
        seed: { type: Number },
        parameters: {
            topk: Number,
            temperature: Number,
            cfgScale: Number,
        },
    },
    { timestamps: true }
);

songSchema.index({ userId: 1, createdAt: -1 });

export type Song = InferSchemaType<typeof songSchema>;
export type SongDocument = HydratedDocument<Song>;

export const SongModel = model('Song', songSchema);

export function toPublicSong(song: SongDocument) {
    const createdAt = (song.get('createdAt') as Date | undefined) ?? song._id.getTimestamp();
    return {
        id: song._id.toString(),
        title: song.title,
        lyrics: song.lyrics,
        tags: song.tags,
        durationSeconds: song.durationSeconds,
        sizeBytes: song.sizeBytes,
        seed: song.seed ?? null,
        parameters: song.parameters ?? {},
        createdAt,
        audioUrl: `/apps/songs/api/songs/${song._id.toString()}/audio`,
    };
}

export type PublicSong = ReturnType<typeof toPublicSong>;

export interface SongOwnership {
    userId: Types.ObjectId;
}
