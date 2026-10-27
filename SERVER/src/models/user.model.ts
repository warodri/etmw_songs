import { HydratedDocument, InferSchemaType, Schema, model } from 'mongoose';

const userSchema = new Schema(
    {
        email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
        name: { type: String, trim: true, default: '' },
        lastLoginAt: { type: Date },
        apiKeyHash: { type: String, unique: true, sparse: true, index: true, select: false },
        apiKeyPrefix: { type: String },
        apiKeyCreatedAt: { type: Date },
        apiKeyLastUsedAt: { type: Date },
    },
    { timestamps: true }
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;

export const UserModel = model('User', userSchema);

export interface PublicUser {
    id: string;
    email: string;
    name: string;
}

export function toPublicUser(user: UserDocument): PublicUser {
    return {
        id: user._id.toString(),
        email: user.email,
        name: user.name || user.email.split('@')[0],
    };
}
