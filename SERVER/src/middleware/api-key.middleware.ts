import { NextFunction, Request, Response } from 'express';
import { UserModel, toPublicUser } from '../models/user.model.js';
import { ApiError } from '../utils/errors.js';
import { hashApiKey } from '../utils/api-key.js';

export interface ApiKeyRequest extends Request {
    user?: ReturnType<typeof toPublicUser>;
}

function readApiKey(request: Request): string {
    const direct = request.header('x-api-key')?.trim();
    if (direct) {
        return direct;
    }

    const authorization = request.header('authorization') ?? '';
    const match = /^ApiKey\s+(.+)$/i.exec(authorization);
    return match?.[1]?.trim() ?? '';
}

export async function requireApiKey(
    request: ApiKeyRequest,
    _response: Response,
    next: NextFunction
): Promise<void> {
    const key = readApiKey(request);
    if (!key) {
        next(new ApiError(401, 'API_KEY_REQUIRED', 'A private API key is required.'));
        return;
    }

    try {
        const user = await UserModel.findOne({ apiKeyHash: hashApiKey(key) });
        if (!user) {
            next(new ApiError(401, 'INVALID_API_KEY', 'The private API key is invalid.'));
            return;
        }

        request.user = toPublicUser(user);
        void UserModel.updateOne(
            { _id: user._id },
            { $set: { apiKeyLastUsedAt: new Date() } }
        ).catch(() => undefined);
        next();
    } catch (error) {
        next(error);
    }
}
