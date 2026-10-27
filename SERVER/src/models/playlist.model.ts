import { HydratedDocument, InferSchemaType, Schema, model } from 'mongoose';

const playlistSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        name: { type: String, required: true, trim: true, maxlength: 80 },
        songIds: { type: [Schema.Types.ObjectId], ref: 'Song', default: [] },
    },
    { timestamps: true }
);

playlistSchema.index({ userId: 1, createdAt: -1 });

export type Playlist = InferSchemaType<typeof playlistSchema>;
export type PlaylistDocument = HydratedDocument<Playlist>;

export const PlaylistModel = model('Playlist', playlistSchema);
