import { HydratedDocument, InferSchemaType, Schema, model } from 'mongoose';

const generationSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        status: {
            type: String,
            enum: ['queued', 'generating', 'completed', 'failed'],
            default: 'queued',
            index: true,
        },
        title: { type: String, required: true, trim: true, maxlength: 120 },
        lyrics: { type: String, required: true },
        tags: { type: [String], default: [] },
        durationSeconds: { type: Number, required: true },
        topk: { type: Number, default: 50 },
        temperature: { type: Number, default: 1 },
        cfgScale: { type: Number, default: 3 },
        seed: { type: Number },
        error: { type: String },
        songId: { type: Schema.Types.ObjectId, ref: 'Song' },
        startedAt: { type: Date },
        completedAt: { type: Date },
    },
    { timestamps: true }
);

generationSchema.index({ userId: 1, createdAt: -1 });
generationSchema.index({ status: 1, createdAt: 1 });

export type GenerationJob = InferSchemaType<typeof generationSchema>;
export type GenerationJobDocument = HydratedDocument<GenerationJob>;

export const GenerationJobModel = model('GenerationJob', generationSchema);

export function toPublicJob(job: GenerationJobDocument, queuePosition = 0) {
    return {
        id: job._id.toString(),
        status: job.status,
        title: job.title,
        durationSeconds: job.durationSeconds,
        tags: job.tags,
        error: job.error ?? null,
        songId: job.songId?.toString() ?? null,
        queuePosition,
        createdAt: (job.get('createdAt') as Date | undefined) ?? job._id.getTimestamp(),
        startedAt: job.startedAt ?? null,
        completedAt: job.completedAt ?? null,
    };
}
