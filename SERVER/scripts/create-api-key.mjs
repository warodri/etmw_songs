#!/usr/bin/env node
import crypto from 'crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ quiet: true });

const emailArgIndex = process.argv.indexOf('--email');
const email = (emailArgIndex >= 0 ? process.argv[emailArgIndex + 1] : 'warodri@gmail.com')
    ?.trim()
    .toLowerCase();

if (!email) {
    console.error('Provide an email with --email user@example.com');
    process.exit(1);
}

if (!process.env.MONGODB_URI || !process.env.MONGODB_DATABASE) {
    console.error('MONGODB_URI and MONGODB_DATABASE must be configured in SERVER/.env');
    process.exit(1);
}

function generateApiKey() {
    return `etmw_sk_${crypto.randomBytes(32).toString('base64url')}`;
}

function hashApiKey(value) {
    return crypto.createHash('sha256').update(value.trim()).digest('hex');
}

await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DATABASE,
    serverSelectionTimeoutMS: 15_000,
});

try {
    const users = mongoose.connection.db.collection('users');
    const user = await users.findOne({ email });
    if (!user) {
        console.error(`No ETMW Songs user exists for ${email}.`);
        process.exit(1);
    }

    const apiKey = generateApiKey();
    const prefix = apiKey.slice(0, 16);
    const now = new Date();

    await users.updateOne(
        { _id: user._id },
        {
            $set: {
                apiKeyHash: hashApiKey(apiKey),
                apiKeyPrefix: prefix,
                apiKeyCreatedAt: now,
                apiKeyLastUsedAt: null,
            },
        }
    );

    console.error(`Private API key created for ${email} (${user._id.toString()}).`);
    console.error('Store this key securely. It will not be shown again.');
    console.log(apiKey);
} finally {
    await mongoose.disconnect();
}
