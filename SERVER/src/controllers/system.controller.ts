import { Response } from 'express';
import { env } from '../config/env.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

interface EngineStatus {
    engineOnline: boolean;
    engineUrl: string;
    checkedAt: string;
    modelLoaded?: boolean;
}

let cached: { value: EngineStatus; expiresAt: number } | null = null;

export async function systemStatus(_request: AuthenticatedRequest, response: Response): Promise<void> {
    if (cached && cached.expiresAt > Date.now()) {
        response.json(cached.value);
        return;
    }

    let engineOnline = false;
    let modelLoaded = false;
    try {
        const res = await fetch(`${env.generationApiUrl}/health`, {
            signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
            const body = (await res.json()) as { model_loaded?: boolean };
            engineOnline = true;
            modelLoaded = body.model_loaded === true;
        }
    } catch {
        engineOnline = false;
    }

    const value: EngineStatus = {
        engineOnline,
        engineUrl: env.generationApiUrl,
        checkedAt: new Date().toISOString(),
        modelLoaded,
    };
    cached = { value, expiresAt: Date.now() + 15_000 };
    response.json(value);
}
