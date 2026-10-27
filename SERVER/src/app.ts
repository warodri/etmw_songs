import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { systemStatus } from './controllers/system.controller.js';
import { requireAuth } from './middleware/auth.middleware.js';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware.js';
import { requireApiKey } from './middleware/api-key.middleware.js';
import { authRoutes } from './routes/auth.routes.js';
import { partnerRoutes } from './routes/partner.routes.js';
import { generationRoutes } from './routes/generation.routes.js';
import { playlistRoutes } from './routes/playlist.routes.js';
import { songRoutes } from './routes/song.routes.js';

export function createApp() {
    const app = express();

    app.disable('x-powered-by');
    app.set('trust proxy', 1);

    app.use(
        cors({
            origin: (origin, callback) => {
                if (!origin || env.corsOrigins.includes(origin)) {
                    callback(null, true);
                    return;
                }
                callback(new Error('Origin is not allowed by ETMW Songs CORS configuration.'));
            },
        })
    );

    app.use((_request, response, next) => {
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('Referrer-Policy', 'no-referrer');
        response.setHeader('X-Frame-Options', 'DENY');
        next();
    });

    app.use(express.json({ limit: '1mb' }));

    app.get('/api/health', (_request, response) => {
        response.json({
            ok: true,
            service: 'etmw-songs',
            timestamp: new Date().toISOString(),
        });
    });

    app.use('/api/auth', authRoutes);
    app.use('/api/partner', requireApiKey, partnerRoutes);
    app.get('/api/system/status', requireAuth, systemStatus);
    app.use('/api/songs', requireAuth, songRoutes);
    app.use('/api/playlists', requireAuth, playlistRoutes);
    app.use('/api/generations', requireAuth, generationRoutes);

    app.use(notFoundMiddleware);
    app.use(errorMiddleware);

    return app;
}
