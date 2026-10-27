import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { AuthService } from '../services/auth.service.js';
import { getClientIp } from '../utils/request.js';

const requestCodeSchema = z.object({
    email: z.string().email('Please enter a valid email address.'),
});

const verifyCodeSchema = z.object({
    email: z.string().email('Please enter a valid email address.'),
    code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your email.'),
});

export class AuthController {
    private readonly auth = new AuthService();

    requestCode = async (request: AuthenticatedRequest, response: Response) => {
        const body = requestCodeSchema.parse(request.body);
        const result = await this.auth.requestCode(body.email, getClientIp(request));
        response.json(result);
    };

    verifyCode = async (request: AuthenticatedRequest, response: Response) => {
        const body = verifyCodeSchema.parse(request.body);
        const session = await this.auth.verifyCode(body.email, body.code);
        response.json(session);
    };

    me = async (request: AuthenticatedRequest, response: Response) => {
        response.json({ user: request.user });
    };
}
