import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export async function connectDatabase(): Promise<void> {
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.MONGODB_URI, {
        dbName: env.MONGODB_DATABASE,
        serverSelectionTimeoutMS: 15_000,
    });
    logger.info('database.connected', { database: env.MONGODB_DATABASE });
}

export async function disconnectDatabase(): Promise<void> {
    await mongoose.disconnect();
}
