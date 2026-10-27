type LogLevel = 'info' | 'warn' | 'error';

export const logger = {
    info(event: string, meta: Record<string, unknown> = {}) {
        writeLog('info', event, meta);
    },
    warn(event: string, meta: Record<string, unknown> = {}) {
        writeLog('warn', event, meta);
    },
    error(event: string, meta: Record<string, unknown> = {}) {
        writeLog('error', event, meta);
    },
};

function writeLog(level: LogLevel, event: string, meta: Record<string, unknown>): void {
    const safeMeta = Object.fromEntries(
        Object.entries(meta).filter(
            ([key]) =>
                !key.toLowerCase().includes('token') &&
                !key.toLowerCase().includes('secret') &&
                !key.toLowerCase().includes('password')
        )
    );

    console.log(
        JSON.stringify({
            timestamp: new Date().toISOString(),
            level,
            event,
            ...safeMeta,
        })
    );
}
