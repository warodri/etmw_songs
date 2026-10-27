import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/api.service';
import { PlayerService } from '../../core/player.service';
import { PlaylistSummary, Song } from '../../core/models';
import { SongCardComponent } from '../../components/song-card/song-card';

@Component({
    selector: 'app-library',
    imports: [FormsModule, RouterLink, SongCardComponent],
    templateUrl: './library.html',
    styleUrl: './library.scss',
})
export class LibraryPage {
    private readonly api = inject(ApiService);
    private readonly destroyRef = inject(DestroyRef);
    readonly player = inject(PlayerService);

    readonly songs = signal<Song[]>([]);
    readonly playlists = signal<PlaylistSummary[]>([]);
    readonly loading = signal(true);
    readonly error = signal<string | null>(null);
    readonly search = signal('');
    readonly sort = signal<'newest' | 'oldest' | 'title'>('newest');
    readonly tag = signal<string | null>(null);
    readonly pendingDelete = signal<Song | null>(null);
    readonly toast = signal<string | null>(null);
    private toastTimer: ReturnType<typeof setTimeout> | null = null;

    readonly filteredSongs = computed(() => {
        let list = [...this.songs()];
        const query = this.search().trim().toLowerCase();
        if (query) {
            list = list.filter(
                song =>
                    song.title.toLowerCase().includes(query) ||
                    song.tags.some(tag => tag.includes(query)) ||
                    song.lyrics.toLowerCase().includes(query)
            );
        }

        const tag = this.tag();
        if (tag) {
            list = list.filter(song => song.tags.includes(tag));
        }

        switch (this.sort()) {
            case 'oldest':
                list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
                break;
            case 'title':
                list.sort((a, b) => a.title.localeCompare(b.title));
                break;
            default:
                list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        }

        return list;
    });

    readonly tags = computed(() => {
        const all = new Set<string>();
        for (const song of this.songs()) {
            for (const tag of song.tags) {
                all.add(tag);
            }
        }
        return Array.from(all).sort();
    });

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
        forkJoin({
            songs: this.api.getSongs().pipe(catchError(() => of({ songs: [] as Song[] }))),
            playlists: this.api
                .getPlaylists()
                .pipe(catchError(() => of({ playlists: [] as PlaylistSummary[] }))),
        }).subscribe({
            next: result => {
                this.songs.set(result.songs.songs);
                this.playlists.set(result.playlists.playlists);
                this.loading.set(false);
            },
            error: () => {
                this.loading.set(false);
                this.error.set('Could not load your library. Please try again.');
            },
        });
    }

    play(song: Song): void {
        const queue = this.filteredSongs();
        this.player.play(song, queue.length > 0 ? queue : this.songs());
    }

    isCurrent(song: Song): boolean {
        return this.player.currentSong()?.id === song.id;
    }

    addToPlaylist(playlistId: string, song: Song): void {
        this.api.addSongToPlaylist(playlistId, song.id).subscribe({
            next: () => {
                this.playlists.update(list =>
                    list.map(playlist =>
                        playlist.id === playlistId
                            ? { ...playlist, songCount: playlist.songCount + 1 }
                            : playlist
                    )
                );
                this.notify('Added to playlist.');
            },
            error: () => this.notify('Could not add that song to the playlist.'),
        });
    }

    requestDelete(song: Song): void {
        this.pendingDelete.set(song);
    }

    confirmDelete(): void {
        const song = this.pendingDelete();
        if (!song) {
            return;
        }

        this.api.deleteSong(song.id).subscribe({
            next: () => {
                if (this.player.currentSong()?.id === song.id) {
                    this.player.close();
                }
                this.songs.update(list => list.filter(item => item.id !== song.id));
                this.pendingDelete.set(null);
                this.notify('Song deleted.');
            },
            error: () => {
                this.pendingDelete.set(null);
                this.notify('Could not delete that song.');
            },
        });
    }

    notify(message: string): void {
        this.toast.set(message);
        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
        }
        this.toastTimer = setTimeout(() => this.toast.set(null), 3200);
    }
}
