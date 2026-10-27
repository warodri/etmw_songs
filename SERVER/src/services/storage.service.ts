import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env.js';

class StorageService {
    readonly root = path.resolve(env.STORAGE_DIR);

    async ensure(): Promise<void> {
        await fs.mkdir(this.root, { recursive: true });
    }

    absolute(filename: string): string {
        const resolved = path.resolve(this.root, filename);
        if (!resolved.startsWith(`${this.root}${path.sep}`)) {
            throw new Error('Invalid storage path.');
        }
        return resolved;
    }

    async save(filename: string, data: Buffer): Promise<void> {
        const target = this.absolute(filename);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, data);
    }

    async remove(filename: string): Promise<void> {
        await fs.rm(this.absolute(filename), { force: true });
    }

    async removeUserDirectory(userId: string): Promise<void> {
        await fs.rm(path.join(this.root, userId), { recursive: true, force: true });
    }
}

export const storage = new StorageService();
