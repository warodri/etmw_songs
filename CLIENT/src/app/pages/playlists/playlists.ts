import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/api.service';
import { PlayerService } from '../../core/player.service';
import { PlaylistSummary, coverStyle } from '../../core/models';

@Component({
    selector: 'app-playlists',
    imports: [FormsModule, RouterLink],
    templateUrl: './playlists.html',
    styleUrl: './playlists.scss',
})
export class PlaylistsPage {
    private readonly api = inject(ApiService);
    private readonly destroyRef = inject(DestroyRef);
    readonly player = inject(PlayerService);

    readonly playlists = signal<PlaylistSummary[]>([]);
    readonly loading = signal(true);
    readonly error = signal<string | null>(null);
    readonly newName = signal('');
    readonly creating = signal(false);
    readonly pendingDelete = signal<PlaylistSummary | null>(null);
    readonly toast = signal<string | null>(null);
    private toastTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        this.destroyRef.onDestroy(() => {
            if (this.toastTimer) {
                clearTimeout(this.toastTimer);
            }
        });
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.error.set(null);
        this.api
            .getPlaylists()
            .pipe(catchError(() => of({ playlists: [] as PlaylistSummary[] })))
            .subscribe({
                next: response => {
                    this.playlists.set(response.playlists);
                    this.loading.set(false);
                },
                error: () => {
                    this.loading.set(false);
                    this.error.set('Could not load your playlists.');
                },
            });
    }

    create(): void {
        const name = this.newName().trim();
        if (!name) {
            return;
        }

        this.creating.set(true);
        this.api.createPlaylist(name).subscribe({
            next: response => {
                this.playlists.update(list => [response.playlist, ...list]);
                this.newName.set('');
                this.creating.set(false);
                this.notify('Playlist created.');
            },
            error: error => {
                this.creating.set(false);
                this.notify(error?.error?.message ?? 'Could not create that playlist.');
            },
        });
    }

    playAll(playlist: PlaylistSummary): void {
        this.api.getPlaylist(playlist.id).subscribe({
            next: response => {
                if (response.playlist.songs.length === 0) {
                    this.notify('That playlist is still empty.');
                    return;
                }
                this.player.play(response.playlist.songs[0], response.playlist.songs);
            },
            error: () => this.notify('Could not open that playlist.'),
        });
    }

    confirmDelete(): void {
        const playlist = this.pendingDelete();
        if (!playlist) {
            return;
        }

        this.api.deletePlaylist(playlist.id).subscribe({
            next: () => {
                this.playlists.update(list => list.filter(item => item.id !== playlist.id));
                this.pendingDelete.set(null);
                this.notify('Playlist deleted.');
            },
            error: () => {
                this.pendingDelete.set(null);
                this.notify('Could not delete that playlist.');
            },
        });
    }

    artStyle(playlist: PlaylistSummary): Record<string, string> {
        return coverStyle(playlist.id);
    }

    createdLabel(playlist: PlaylistSummary): string {
        return new Date(playlist.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }

    private notify(message: string): void {
        this.toast.set(message);
        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
        }
        this.toastTimer = setTimeout(() => this.toast.set(null), 3200);
    }
}
