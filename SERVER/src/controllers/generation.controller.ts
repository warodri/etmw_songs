import { Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { GenerationJobModel, toPublicJob } from '../models/generation.model.js';
import { generationQueue } from '../services/generation.service.js';
import { ApiError } from '../utils/errors.js';

const generateSchema = z.object({
    lyrics: z.string().trim().min(10, 'Write at least a few lines of lyrics.').max(20000),
    tags: z
        .union([z.string().max(600), z.array(z.string().max(60)).max(30)])
        .default(['pop']),
    durationSeconds: z.coerce.number().int().min(5).max(env.GENERATION_MAX_DURATION_SECONDS).default(60),
    topk: z.coerce.number().int().min(1).max(200).default(50),
    temperature: z.coerce.number().min(0.1).max(2).default(1),
    cfgScale: z.coerce.number().min(1).max(10).default(3),
    seed: z.number().int().optional().nullable(),
    title: z.string().trim().max(120).optional(),
});

function normalizeTags(input: string | string[]): string[] {
    const list = typeof input === 'string' ? input.split(',') : input;
    return Array.from(
        new Set(
            list
                .map(tag => tag.trim().toLowerCase())
                .filter(Boolean)
        )
    ).slice(0, 30);
}

function deriveTitle(lyrics: string): string {
    const line = lyrics
        .split('\n')
        .map(value => value.trim())
        .find(value => value.length > 0 && !/^\[.+\]$/.test(value));
    return (line ?? 'Untitled song').slice(0, 80);
}

export class GenerationController {
    create = async (request: AuthenticatedRequest, response: Response) => {
        const body = generateSchema.parse(request.body);
        const tags = normalizeTags(body.tags);
        if (tags.length === 0) {
            throw new ApiError(400, 'TAGS_REQUIRED', 'Add at least one style tag (for example: pop, female voice).');
        }

        const job = await GenerationJobModel.create({
            userId: request.user!.id,
            status: 'queued',
            title: body.title?.trim() || deriveTitle(body.lyrics),
            lyrics: body.lyrics,
            tags,
            durationSeconds: body.durationSeconds,
            topk: body.topk,
            temperature: body.temperature,
            cfgScale: body.cfgScale,
            seed: body.seed ?? undefined,
        });

        generationQueue.enqueue(job._id.toString());
        response.status(202).json({ job: toPublicJob(job, 1) });
    };

    get = async (request: AuthenticatedRequest, response: Response) => {
        const job = await this.findOwnedJob(request);
        let queuePosition = 0;
        if (job.status === 'queued') {
            const generating = await GenerationJobModel.countDocuments({ status: 'generating' });
            const queuedAhead = await GenerationJobModel.countDocuments({
                status: 'queued',
                createdAt: { $lt: (job.get('createdAt') as Date | undefined) ?? job._id.getTimestamp() },
            });
            queuePosition = generating + queuedAhead + 1;
        }

        response.json({ job: toPublicJob(job, queuePosition) });
    };

    listActive = async (request: AuthenticatedRequest, response: Response) => {
        const jobs = await GenerationJobModel.find({
            userId: request.user!.id,
            status: { $in: ['queued', 'generating'] },
        }).sort({ createdAt: 1 });

        response.json({ jobs: jobs.map(job => toPublicJob(job, job.status === 'queued' ? 1 : 0)) });
    };

    cancel = async (request: AuthenticatedRequest, response: Response) => {
        const job = await this.findOwnedJob(request);
        if (job.status !== 'queued') {
            throw new ApiError(409, 'CANNOT_CANCEL', 'Only queued songs can be cancelled.');
        }

        job.status = 'failed';
        job.error = 'Cancelled.';
        job.completedAt = new Date();
        await job.save();
        response.json({ job: toPublicJob(job) });
    };

    private async findOwnedJob(request: AuthenticatedRequest) {
        const id = request.params.id;
        if (!isValidObjectId(id)) {
            throw new ApiError(404, 'JOB_NOT_FOUND', 'Generation not found.');
        }

        const job = await GenerationJobModel.findOne({ _id: id, userId: request.user!.id });
        if (!job) {
            throw new ApiError(404, 'JOB_NOT_FOUND', 'Generation not found.');
        }

        return job;
    }
}
