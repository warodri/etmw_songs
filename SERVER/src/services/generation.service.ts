import { env } from '../config/env.js';
import { GenerationJobModel } from '../models/generation.model.js';
import { SongModel } from '../models/song.model.js';
import { logger } from '../utils/logger.js';
import { storage } from './storage.service.js';

interface EngineJob {
    id: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    error?: string | null;
    audio_url?: string | null;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class GenerationQueue {
    private readonly queue: string[] = [];
    private running = false;

    async start(): Promise<void> {
        await storage.ensure();
        await GenerationJobModel.updateMany(
            { status: 'generating' },
            {
                $set: {
                    status: 'failed',
                    error: 'The server restarted while this song was generating. Please try again.',
                },
            }
        );

        const queued = await GenerationJobModel.find({ status: 'queued' })
            .sort({ createdAt: 1 })
            .select('_id');
        for (const job of queued) {
            this.queue.push(job._id.toString());
        }

        if (this.queue.length > 0) {
            logger.info('generation.queue_resumed', { count: this.queue.length });
        }
        void this.drain();
    }

    enqueue(jobId: string): void {
        this.queue.push(jobId);
        void this.drain();
    }

    private async drain(): Promise<void> {
        if (this.running) {
            return;
        }

        this.running = true;
        try {
            while (this.queue.length > 0) {
                const jobId = this.queue.shift();
                if (jobId) {
                    await this.run(jobId);
                }
            }
        } finally {
            this.running = false;
        }
    }

    private async run(jobId: string): Promise<void> {
        const job = await GenerationJobModel.findById(jobId);
        if (!job || job.status !== 'queued') {
            return;
        }

        job.status = 'generating';
        job.startedAt = new Date();
        await job.save();
        logger.info('generation.started', { jobId, userId: job.userId.toString() });

        let engineJobId: string | null = null;
        try {
            const count = await SongModel.countDocuments({ userId: job.userId });
            if (count >= env.MAX_SONGS_PER_USER) {
                throw new Error(
                    `You have reached the limit of ${env.MAX_SONGS_PER_USER} songs. Delete a few songs and try again.`
                );
            }

            const created = await this.engineRequest('/jobs', {
                method: 'POST',
                body: JSON.stringify({
                    lyrics: job.lyrics,
                    tags: job.tags,
                    duration_seconds: job.durationSeconds,
                    topk: job.topk,
                    temperature: job.temperature,
                    cfg_scale: job.cfgScale,
                    seed: job.seed ?? undefined,
                }),
            });
            const createdJob = (await created.json()) as EngineJob;
            engineJobId = createdJob.id;

            const deadline = Date.now() + env.GENERATION_TIMEOUT_MS;
            let completed = false;

            while (Date.now() < deadline) {
                await sleep(env.GENERATION_POLL_INTERVAL_MS);
                const response = await this.engineRequest(`/jobs/${engineJobId}`);
                const state = (await response.json()) as EngineJob;

                if (state.status === 'completed') {
                    completed = true;
                    break;
                }

                if (state.status === 'failed') {
                    throw new Error(state.error || 'The music engine could not generate this song.');
                }
            }

            if (!completed) {
                throw new Error('Timed out waiting for the music engine. Please try again.');
            }

            const audioResponse = await this.engineRequest(`/jobs/${engineJobId}/audio`, undefined, 5 * 60 * 1000);
            const audio = Buffer.from(await audioResponse.arrayBuffer());
            if (audio.length < 1024) {
                throw new Error('The music engine returned an empty audio file.');
            }

            const filename = `${job.userId.toString()}/${job._id.toString()}.mp3`;
            await storage.save(filename, audio);

            const song = await SongModel.create({
                userId: job.userId,
                title: job.title,
                lyrics: job.lyrics,
                tags: job.tags,
                durationSeconds: job.durationSeconds,
                filename,
                mimeType: 'audio/mpeg',
                sizeBytes: audio.length,
                seed: job.seed,
                parameters: {
                    topk: job.topk,
                    temperature: job.temperature,
                    cfgScale: job.cfgScale,
                },
            });

            job.status = 'completed';
            job.songId = song._id;
            job.completedAt = new Date();
            await job.save();
            logger.info('generation.completed', {
                jobId,
                songId: song._id.toString(),
                bytes: audio.length,
            });

            if (engineJobId) {
                await this.engineRequest(`/jobs/${engineJobId}`, { method: 'DELETE' }).catch(() => undefined);
            }
        } catch (error) {
            const raw = error instanceof Error ? error.message : String(error);
            const message = /fetch failed|ECONN|ENOTFOUND|EAI_AGAIN|timed out|network/i.test(raw)
                ? 'The music engine is offline or unreachable. Please try again in a moment.'
                : raw;

            job.status = 'failed';
            job.error = message;
            job.completedAt = new Date();
            await job.save();
            logger.error('generation.failed', { jobId, message: raw });

            if (engineJobId) {
                await this.engineRequest(`/jobs/${engineJobId}`, { method: 'DELETE' }).catch(() => undefined);
            }
        }
    }

    private async engineRequest(
        path: string,
        init?: RequestInit,
        timeoutMs = 30_000
    ): Promise<Response> {
        const response = await fetch(`${env.generationApiUrl}${path}`, {
            ...init,
            headers: {
                'content-type': 'application/json',
                'x-api-key': env.GENERATION_API_KEY,
                ...(init?.headers ?? {}),
            },
            signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`Music engine error ${response.status}: ${text.slice(0, 240)}`);
        }

        return response;
    }
}

export const generationQueue = new GenerationQueue();
