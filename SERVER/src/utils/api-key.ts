import crypto from 'crypto';

export const API_KEY_PREFIX = 'etmw_sk_';

export function generateApiKey(): string {
    return `${API_KEY_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
}

export function hashApiKey(value: string): string {
    return crypto.createHash('sha256').update(value.trim()).digest('hex');
}

export function apiKeyPrefix(value: string): string {
    return value.trim().slice(0, 16);
}
