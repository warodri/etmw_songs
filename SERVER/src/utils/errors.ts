export class ApiError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string
    ) {
        super(message);
    }
}

export class RateLimitError extends ApiError {
    constructor(
        message: string,
        public readonly retryAfterSeconds: number
    ) {
        super(429, 'TOO_MANY_REQUESTS', message);
    }
}
