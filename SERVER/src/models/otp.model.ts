import { InferSchemaType, Schema, model } from 'mongoose';

const otpSchema = new Schema(
    {
        email: { type: String, required: true, lowercase: true, trim: true },
        codeHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        attempts: { type: Number, default: 0 },
    },
    { timestamps: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1 }, { unique: true });

export type Otp = InferSchemaType<typeof otpSchema>;
export const OtpModel = model('OtpCode', otpSchema);
