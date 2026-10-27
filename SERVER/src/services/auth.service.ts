import crypto from 'crypto';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError, RateLimitError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { OtpModel } from '../models/otp.model.js';
import { UserModel, toPublicUser, type PublicUser, type UserDocument } from '../models/user.model.js';
import { EmailService } from './email.service.js';
import { authRateLimitService } from './auth-rate-limit.service.js';

export interface Session {
    token: string;
    user: PublicUser;
}

export interface UserTokenPayload extends JwtPayload {
    sub: string;
    email: string;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthService {
    constructor(private readonly emails = new EmailService()) {}

    normalizeEmail(email: string): string {
        const normalized = email.trim().toLowerCase();
        if (!emailPattern.test(normalized)) {
            throw new ApiError(400, 'INVALID_EMAIL', 'Please enter a valid email address.');
        }
        return normalized;
    }

    async requestCode(emailInput: string, ip?: string): Promise<{ success: true; message: string }> {
        const email = this.normalizeEmail(emailInput);
        const decision = authRateLimitService.check(email, ip);
        if (!decision.allowed) {
            throw new RateLimitError(
                'Too many login attempts. Please wait a few minutes and try again.',
                decision.retryAfterSeconds
            );
        }

        if (env.DEV_LOGIN_CODE && !env.isProduction) {
            logger.info('auth.dev_code_bypass', { email });
            return {
                success: true,
                message: `Development mode: use ${env.DEV_LOGIN_CODE} as the login code.`,
            };
        }

        const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
        const codeHash = this.hashCode(email, code);
        const expiresAt = new Date(Date.now() + env.AUTH_CODE_TTL_MINUTES * 60 * 1000);

        await OtpModel.findOneAndUpdate(
            { email },
            { email, codeHash, expiresAt, attempts: 0 },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        await this.emails.sendLoginCode(email, code);

        return {
            success: true,
            message: 'If that email is valid, a login code is on its way.',
        };
    }

    async verifyCode(emailInput: string, codeInput: string): Promise<Session> {
        const email = this.normalizeEmail(emailInput);
        const code = codeInput.trim();
        if (!/^\d{6}$/.test(code)) {
            throw new ApiError(400, 'INVALID_CODE', 'Enter the 6-digit code from your email.');
        }

        const isDevCode = Boolean(env.DEV_LOGIN_CODE && !env.isProduction && code === env.DEV_LOGIN_CODE);
        if (!isDevCode) {
            const otp = await OtpModel.findOne({ email });
            if (!otp) {
                throw new ApiError(400, 'INVALID_CODE', 'That code is invalid or has expired.');
            }

            if (otp.expiresAt.getTime() < Date.now()) {
                await OtpModel.deleteOne({ _id: otp._id });
                throw new ApiError(400, 'INVALID_CODE', 'That code has expired. Request a new one.');
            }

            if (otp.attempts >= 10) {
                await OtpModel.deleteOne({ _id: otp._id });
                throw new ApiError(429, 'TOO_MANY_ATTEMPTS', 'Too many wrong codes. Request a new one.');
            }

            const candidate = this.hashCode(email, code);
            const matches =
                candidate.length === otp.codeHash.length &&
                crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(otp.codeHash));

            if (!matches) {
                otp.attempts += 1;
                await otp.save();
                throw new ApiError(400, 'INVALID_CODE', 'That code is invalid or has expired.');
            }

            await OtpModel.deleteOne({ _id: otp._id });
        }

        const user = await UserModel.findOneAndUpdate(
            { email },
            {
                $set: { lastLoginAt: new Date() },
                $setOnInsert: {
                    email,
                    name: email.split('@')[0],
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        if (!user) {
            throw new ApiError(500, 'USER_CREATE_FAILED', 'Could not create the account.');
        }

        return this.createSession(user);
    }

    verifyToken(token: string): UserTokenPayload {
        try {
            return jwt.verify(token, env.AUTH_JWT_SECRET) as UserTokenPayload;
        } catch {
            throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication is required.');
        }
    }

    private createSession(user: UserDocument): Session {
        const payload: UserTokenPayload = {
            sub: user._id.toString(),
            email: user.email,
        };

        return {
            token: jwt.sign(payload, env.AUTH_JWT_SECRET, {
                expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
            }),
            user: toPublicUser(user),
        };
    }

    private hashCode(email: string, code: string): string {
        return crypto
            .createHash('sha256')
            .update(`${email}:${code}:${env.AUTH_JWT_SECRET}`)
            .digest('hex');
    }
}
