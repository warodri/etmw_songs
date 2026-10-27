export interface User {
    id: string;
    email: string;
    name: string;
}

export interface SongParameters {
    topk?: number;
    temperature?: number;
    cfgScale?: number;
}

export interface Song {
    id: string;
    title: string;
    lyrics: string;
    tags: string[];
    durationSeconds: number;
    sizeBytes: number;
    seed: number | null;
    parameters: SongParameters;
    createdAt: string;
    audioUrl: string;
}

export interface PlaylistSummary {
    id: string;
    name: string;
    songCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface Playlist {
    id: string;
    name: string;
    songs: Song[];
    createdAt: string;
    updatedAt: string;
}

export type GenerationStatus = 'queued' | 'generating' | 'completed' | 'failed';

export interface GenerationJob {
    id: string;
    status: GenerationStatus;
    title: string;
    durationSeconds: number;
    tags: string[];
    error: string | null;
    songId: string | null;
    queuePosition: number;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
}

export interface GeneratePayload {
    title?: string;
    lyrics: string;
    tags: string[];
    durationSeconds: number;
    topk: number;
    temperature: number;
    cfgScale: number;
    seed?: number | null;
}

export interface SystemStatus {
    engineOnline: boolean;
    engineUrl: string;
    checkedAt: string;
    modelLoaded?: boolean;
}

export function formatDuration(seconds: number): string {
    const total = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

const COVER_PALETTES: Array<[string, string]> = [
    ['#7c3aed', '#2563eb'],
    ['#db2777', '#f97316'],
    ['#0891b2', '#22c55e'],
    ['#e11d48', '#7c3aed'],
    ['#ea580c', '#f59e0b'],
    ['#2563eb', '#06b6d4'],
    ['#9333ea', '#db2777'],
    ['#0d9488', '#84cc16'],
];

export function coverStyle(id: string): Record<string, string> {
    let hash = 0;
    for (const character of id) {
        hash = (hash * 31 + character.charCodeAt(0)) % 100000;
    }
    const [a, b] = COVER_PALETTES[hash % COVER_PALETTES.length];
    return { '--cover-a': a, '--cover-b': b };
}
