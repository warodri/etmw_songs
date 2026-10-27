import { NextFunction, Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { UserModel, toPublicUser, type PublicUser } from '../models/user.model.js';
import { ApiError } from '../utils/errors.js';

export interface AuthenticatedRequest extends Request {
    user?: PublicUser;
}

const authService = new AuthService();

export async function requireAuth(
    request: AuthenticatedRequest,
    _response: Response,
    next: NextFunction
): Promise<void> {
    const header = request.header('authorization') ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
        next(new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue.'));
        return;
    }

    try {
        const payload = authService.verifyToken(token);
        const user = await UserModel.findById(payload.sub);
        if (!user) {
            next(new ApiError(401, 'AUTH_REQUIRED', 'Sign in to continue.'));
            return;
        }

        request.user = toPublicUser(user);
        next();
    } catch (error) {
        next(error);
    }
}
