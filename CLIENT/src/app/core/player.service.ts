import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Song } from './models';

@Injectable({ providedIn: 'root' })
export class PlayerService {
    private readonly api = inject(ApiService);
    private readonly audio = new Audio();
    private objectUrl: string | null = null;

    readonly currentSong = signal<Song | null>(null);
    readonly queue = signal<Song[]>([]);
    readonly queueIndex = signal(-1);
    readonly isPlaying = signal(false);
    readonly isLoading = signal(false);
    readonly currentTime = signal(0);
    readonly duration = signal(0);
    readonly volume = signal(0.9);
    readonly error = signal<string | null>(null);

    readonly hasNext = computed(() => this.queueIndex() < this.queue().length - 1);
    readonly hasPrevious = computed(() => this.queueIndex() > 0 || this.currentTime() > 3);

    constructor() {
        this.audio.preload = 'auto';
        this.audio.volume = this.volume();
        this.audio.addEventListener('timeupdate', () => this.currentTime.set(this.audio.currentTime || 0));
        this.audio.addEventListener('loadedmetadata', () => {
            this.duration.set(Number.isFinite(this.audio.duration) ? this.audio.duration : 0);
        });
        this.audio.addEventListener('play', () => this.isPlaying.set(true));
        this.audio.addEventListener('pause', () => this.isPlaying.set(false));
        this.audio.addEventListener('ended', () => this.next());
        this.audio.addEventListener('error', () => {
            if (this.currentSong()) {
                this.error.set('This audio could not be played.');
                this.isPlaying.set(false);
            }
        });
    }

    play(song: Song, queue: Song[] = [song]): void {
        if (this.currentSong()?.id === song.id && this.objectUrl) {
            this.toggle();
            return;
        }

        const ordered = queue.length > 0 ? queue : [song];
        const index = Math.max(0, ordered.findIndex(item => item.id === song.id));
        this.queue.set(ordered);
        this.queueIndex.set(index);
        this.load(song);
    }

    toggle(): void {
        if (!this.currentSong()) {
            return;
        }

        if (this.audio.paused) {
            void this.audio.play().catch(() => {
                this.error.set('Your browser blocked playback. Press play again.');
            });
        } else {
            this.audio.pause();
        }
    }

    next(): void {
        const nextIndex = this.queueIndex() + 1;
        const queue = this.queue();
        if (nextIndex < queue.length) {
            this.queueIndex.set(nextIndex);
            this.load(queue[nextIndex]);
        } else {
            this.audio.pause();
            this.audio.currentTime = 0;
            this.currentTime.set(0);
        }
    }

    previous(): void {
        if (this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
            this.currentTime.set(0);
            return;
        }

        const previousIndex = this.queueIndex() - 1;
        const queue = this.queue();
        if (previousIndex >= 0) {
            this.queueIndex.set(previousIndex);
            this.load(queue[previousIndex]);
        }
    }

    seek(seconds: number): void {
        if (Number.isFinite(seconds)) {
            this.audio.currentTime = Math.max(0, Math.min(seconds, this.duration()));
            this.currentTime.set(this.audio.currentTime);
        }
    }

    setVolume(value: number): void {
        const clamped = Math.max(0, Math.min(1, value));
        this.volume.set(clamped);
        this.audio.volume = clamped;
    }

    close(): void {
        this.audio.pause();
        this.audio.removeAttribute('src');
        this.audio.load();
        this.revokeObjectUrl();
        this.currentSong.set(null);
        this.queue.set([]);
        this.queueIndex.set(-1);
        this.isPlaying.set(false);
        this.isLoading.set(false);
        this.currentTime.set(0);
        this.duration.set(0);
        this.error.set(null);
    }

    private load(song: Song): void {
        this.isLoading.set(true);
        this.error.set(null);
        this.currentTime.set(0);
        this.duration.set(0);

        this.api.getSongAudio(song.id).subscribe({
            next: blob => {
                this.revokeObjectUrl();
                this.objectUrl = URL.createObjectURL(blob);
                this.audio.src = this.objectUrl;
                this.audio.load();
                this.audio.volume = this.volume();
                this.currentSong.set(song);
                void this.audio.play().catch(() => {
                    this.error.set('Your browser blocked playback. Press play again.');
                });
                this.isLoading.set(false);
            },
            error: () => {
                this.isLoading.set(false);
                this.error.set('Could not load this song. It may have been deleted.');
            },
        });
    }

    private revokeObjectUrl(): void {
        if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl);
            this.objectUrl = null;
        }
    }
}
