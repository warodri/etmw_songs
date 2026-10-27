import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class EmailService {
    private transporter: Transporter;

    constructor(transporter?: Transporter) {
        this.transporter =
            transporter ??
            nodemailer.createTransport({
                host: env.SMTP_HOST,
                port: env.SMTP_PORT,
                secure: env.SMTP_SECURE,
                auth: {
                    user: env.SMTP_USERNAME,
                    pass: env.SMTP_PASSWORD,
                },
                tls: {
                    rejectUnauthorized: false,
                },
            });
    }

    async sendLoginCode(toEmail: string, code: string): Promise<void> {
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin:0; padding:40px 16px; background:#0b0a09; color:#f5f0ea; font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .card { max-width:520px; margin:0 auto; background:#151210; border:1px solid #2a231d; border-radius:20px; padding:40px; }
    .brand { font-size:13px; letter-spacing:3px; text-transform:uppercase; color:#f97316; font-weight:700; text-align:center; margin-bottom:22px; }
    h1 { font-size:26px; margin:0 0 12px; text-align:center; }
    p { color:#b8aca0; font-size:15px; line-height:1.65; text-align:center; margin:0 0 24px; }
    .code { font-size:38px; font-weight:800; letter-spacing:10px; color:#fff; text-align:center; background:#221a14; border:1px dashed #f97316; border-radius:14px; padding:18px 10px 18px 20px; margin:0 auto 24px; max-width:300px; }
    .footer { margin-top:28px; padding-top:18px; border-top:1px solid #2a231d; color:#7d7268; font-size:12px; text-align:center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">ETMW Songs</div>
    <h1>Your login code</h1>
    <p>Enter this code to open your studio and your song library. It expires in ${env.AUTH_CODE_TTL_MINUTES} minutes.</p>
    <div class="code">${code}</div>
    <p>If you did not request this code, you can safely ignore this email.</p>
    <div class="footer">&copy; ETMW Songs &middot; Enter To My World</div>
  </div>
</body>
</html>`;

        try {
            await this.transporter.sendMail({
                from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM_ADDRESS}>`,
                to: toEmail,
                subject: `ETMW Songs login code: ${code}`,
                text: `Your ETMW Songs login code is ${code}. It expires in ${env.AUTH_CODE_TTL_MINUTES} minutes.`,
                html,
            });
            logger.info('email.login_code_sent', { toEmail });
        } catch (error) {
            logger.error('email.login_code_failed', {
                toEmail,
                message: error instanceof Error ? error.message : String(error),
            });
            throw new Error('FAILED_TO_SEND_EMAIL');
        }
    }
}
