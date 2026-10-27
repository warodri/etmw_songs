import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/api.service';
import { PlayerService } from '../../core/player.service';
import { Playlist, Song, formatDuration } from '../../core/models';

@Component({
    selector: 'app-playlist-detail',
    imports: [FormsModule, RouterLink],
    templateUrl: './playlist-detail.html',
    styleUrl: './playlist-detail.scss',
})
export class PlaylistDetailPage {
    private readonly api = inject(ApiService);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);
    readonly player = inject(PlayerService);

    readonly playlist = signal<Playlist | null>(null);
    readonly loading = signal(true);
    readonly error = signal<string | null>(null);
    readonly toast = signal<string | null>(null);
    readonly renaming = signal(false);
    readonly nameInput = signal('');
    readonly showAdd = signal(false);
    readonly allSongs = signal<Song[]>([]);
    readonly addSearch = signal('');
    readonly pendingDelete = signal(false);
    readonly formatDuration = formatDuration;
    private toastTimer: ReturnType<typeof setTimeout> | null = null;

    readonly totalDuration = computed(() =>
        (this.playlist()?.songs ?? []).reduce((total, song) => total + song.durationSeconds, 0)
    );

    readonly availableSongs = computed(() => {
        const playlist = this.playlist();
        if (!playlist) {
            return [];
        }
        const existing = new Set(playlist.songs.map(song => song.id));
        const query = this.addSearch().trim().toLowerCase();
        return this.allSongs().filter(song => {
            if (existing.has(song.id)) {
                return false;
            }
            if (!query) {
                return true;
            }
            return (
                song.title.toLowerCase().includes(query) ||
                song.tags.some(tag => tag.includes(query))
            );
        });
    });

    constructor() {
        this.destroyRef.onDestroy(() => {
            if (this.toastTimer) {
                clearTimeout(this.toastTimer);
            }
        });

        const id = this.route.snapshot.paramMap.get('id');
        if (!id) {
            void this.router.navigate(['/playlists']);
            return;
        }
        this.load(id);
    }

    load(id: string): void {
        this.loading.set(true);
        this.error.set(null);
        this.api.getPlaylist(id).subscribe({
            next: response => {
                this.playlist.set(response.playlist);
                this.nameInput.set(response.playlist.name);
                this.loading.set(false);
            },
            error: () => {
                this.loading.set(false);
                this.error.set('That playlist could not be found.');
            },
        });
    }

    playAll(): void {
        const playlist = this.playlist();
        if (!playlist || playlist.songs.length === 0) {
            this.notify('Add a song first.');
            return;
        }
        this.player.play(playlist.songs[0], playlist.songs);
    }

    playSong(song: Song): void {
        const playlist = this.playlist();
        if (playlist) {
            this.player.play(song, playlist.songs);
        }
    }

    isCurrent(song: Song): boolean {
        return this.player.currentSong()?.id === song.id;
    }

    startRename(): void {
        this.nameInput.set(this.playlist()?.name ?? '');
        this.renaming.set(true);
    }

    saveRename(): void {
        const playlist = this.playlist();
        const name = this.nameInput().trim();
        if (!playlist || !name) {
            this.renaming.set(false);
            return;
        }

        this.api.renamePlaylist(playlist.id, name).subscribe({
            next: () => {
                this.playlist.update(current => (current ? { ...current, name } : current));
                this.renaming.set(false);
                this.notify('Playlist renamed.');
            },
            error: () => {
                this.renaming.set(false);
                this.notify('Could not rename that playlist.');
            },
        });
    }

    removeSong(song: Song): void {
        const playlist = this.playlist();
        if (!playlist) {
            return;
        }

        this.api.removeSongFromPlaylist(playlist.id, song.id).subscribe({
            next: () => {
                this.playlist.update(current =>
                    current
                        ? { ...current, songs: current.songs.filter(item => item.id !== song.id) }
                        : current
                );
                this.notify('Song removed from playlist.');
            },
            error: () => this.notify('Could not remove that song.'),
        });
    }

    move(song: Song, direction: -1 | 1): void {
        const playlist = this.playlist();
        if (!playlist) {
            return;
        }

        const index = playlist.songs.findIndex(item => item.id === song.id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= playlist.songs.length) {
            return;
        }

        const songs = [...playlist.songs];
        [songs[index], songs[target]] = [songs[target], songs[index]];
        this.playlist.update(current => (current ? { ...current, songs } : current));
        this.api.reorderPlaylist(playlist.id, songs.map(item => item.id)).subscribe({
            error: () => this.notify('Could not save the new order.'),
        });
    }

    openAdd(): void {
        this.showAdd.set(true);
        this.addSearch.set('');
        this.api
            .getSongs()
            .pipe(catchError(() => of({ songs: [] as Song[] })))
            .subscribe(response => this.allSongs.set(response.songs));
    }

    addSong(song: Song): void {
        const playlist = this.playlist();
        if (!playlist) {
            return;
        }

        this.api.addSongToPlaylist(playlist.id, song.id).subscribe({
            next: () => {
                this.playlist.update(current =>
                    current ? { ...current, songs: [...current.songs, song] } : current
                );
                this.notify('Song added to playlist.');
            },
            error: () => this.notify('Could not add that song.'),
        });
    }

    deletePlaylist(): void {
        const playlist = this.playlist();
        if (!playlist) {
            return;
        }

        this.api.deletePlaylist(playlist.id).subscribe({
            next: () => {
                this.pendingDelete.set(false);
                void this.router.navigate(['/playlists']);
            },
            error: () => {
                this.pendingDelete.set(false);
                this.notify('Could not delete that playlist.');
            },
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
