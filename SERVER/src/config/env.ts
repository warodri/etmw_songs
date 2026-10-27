import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const booleanFromString = z
    .string()
    .default('true')
    .transform(value => ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase()));

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3025),
    HOST: z.string().default('127.0.0.1'),
    PUBLIC_BASE_URL: z.string().url().default('https://entertomyworld.com/apps/songs'),
    CORS_ALLOWED_ORIGINS: z
        .string()
        .default('http://localhost:4200,http://127.0.0.1:4200,https://entertomyworld.com'),
    AUTH_JWT_SECRET: z.string().min(16, 'AUTH_JWT_SECRET must be configured'),
    JWT_EXPIRES_IN: z.string().default('30d'),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    MONGODB_DATABASE: z.string().min(1).default('etmw_songs'),
    SMTP_HOST: z.string().default('smtppro.zoho.eu'),
    SMTP_PORT: z.coerce.number().int().default(465),
    SMTP_SECURE: booleanFromString,
    SMTP_USERNAME: z.string().min(1, 'SMTP_USERNAME is required'),
    SMTP_PASSWORD: z.string().min(1, 'SMTP_PASSWORD is required'),
    EMAIL_FROM_NAME: z.string().default('ETMW Songs'),
    EMAIL_FROM_ADDRESS: z.string().email().default('info@entertomyworld.com'),
    ADMIN_EMAIL: z.string().email().optional().or(z.literal('')),
    AUTH_CODE_TTL_MINUTES: z.coerce.number().int().positive().default(10),
    AUTH_CODE_RATE_EMAIL_MAX: z.coerce.number().int().positive().default(5),
    AUTH_CODE_RATE_IP_MAX: z.coerce.number().int().positive().default(20),
    AUTH_CODE_RATE_WINDOW_MINUTES: z.coerce.number().int().positive().default(60),
    DEV_LOGIN_CODE: z.string().length(6).optional().or(z.literal('')),
    GENERATION_API_URL: z.string().url().default('https://songs--warodri.entertomyworld.com'),
    GENERATION_API_KEY: z.string().min(16, 'GENERATION_API_KEY must be configured'),
    GENERATION_MAX_DURATION_SECONDS: z.coerce.number().int().positive().default(240),
    GENERATION_TIMEOUT_MS: z.coerce.number().int().positive().default(3_600_000),
    GENERATION_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5_000),
    STORAGE_DIR: z.string().default('./storage/songs'),
    MAX_SONGS_PER_USER: z.coerce.number().int().positive().default(250),
});

const parsed = envSchema.parse(process.env);

export const env = {
    ...parsed,
    corsOrigins: parsed.CORS_ALLOWED_ORIGINS.split(',')
        .map(origin => origin.trim())
        .filter(Boolean),
    isProduction: parsed.NODE_ENV === 'production',
    generationApiUrl: parsed.GENERATION_API_URL.replace(/\/$/, ''),
};
