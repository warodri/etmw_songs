import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from './constants';
import {
    GeneratePayload,
    GenerationJob,
    Playlist,
    PlaylistSummary,
    Song,
    SystemStatus,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
    private readonly http = inject(HttpClient);

    getSystemStatus(): Observable<SystemStatus> {
        return this.http.get<SystemStatus>(`${API_BASE}/system/status`);
    }

    getSongs(): Observable<{ songs: Song[] }> {
        return this.http.get<{ songs: Song[] }>(`${API_BASE}/songs`);
    }

    getSong(id: string): Observable<{ song: Song }> {
        return this.http.get<{ song: Song }>(`${API_BASE}/songs/${id}`);
    }

    getSongAudio(id: string): Observable<Blob> {
        return this.http.get(`${API_BASE}/songs/${id}/audio`, { responseType: 'blob' });
    }

    deleteSong(id: string): Observable<{ deleted: boolean }> {
        return this.http.delete<{ deleted: boolean }>(`${API_BASE}/songs/${id}`);
    }

    renameSong(id: string, title: string): Observable<{ song: Song }> {
        return this.http.patch<{ song: Song }>(`${API_BASE}/songs/${id}`, { title });
    }

    getPlaylists(): Observable<{ playlists: PlaylistSummary[] }> {
        return this.http.get<{ playlists: PlaylistSummary[] }>(`${API_BASE}/playlists`);
    }

    getPlaylist(id: string): Observable<{ playlist: Playlist }> {
        return this.http.get<{ playlist: Playlist }>(`${API_BASE}/playlists/${id}`);
    }

    createPlaylist(name: string): Observable<{ playlist: PlaylistSummary }> {
        return this.http.post<{ playlist: PlaylistSummary }>(`${API_BASE}/playlists`, { name });
    }

    renamePlaylist(id: string, name: string): Observable<{ playlist: { id: string; name: string } }> {
        return this.http.patch<{ playlist: { id: string; name: string } }>(
            `${API_BASE}/playlists/${id}`,
            { name }
        );
    }

    deletePlaylist(id: string): Observable<{ deleted: boolean }> {
        return this.http.delete<{ deleted: boolean }>(`${API_BASE}/playlists/${id}`);
    }

    addSongToPlaylist(playlistId: string, songId: string): Observable<unknown> {
        return this.http.post(`${API_BASE}/playlists/${playlistId}/songs`, { songId });
    }

    removeSongFromPlaylist(playlistId: string, songId: string): Observable<unknown> {
        return this.http.delete(`${API_BASE}/playlists/${playlistId}/songs/${songId}`);
    }

    reorderPlaylist(playlistId: string, songIds: string[]): Observable<unknown> {
        return this.http.put(`${API_BASE}/playlists/${playlistId}/order`, { songIds });
    }

    createGeneration(payload: GeneratePayload): Observable<{ job: GenerationJob }> {
        return this.http.post<{ job: GenerationJob }>(`${API_BASE}/generations`, payload);
    }

    getGeneration(id: string): Observable<{ job: GenerationJob }> {
        return this.http.get<{ job: GenerationJob }>(`${API_BASE}/generations/${id}`);
    }

    getActiveGenerations(): Observable<{ jobs: GenerationJob[] }> {
        return this.http.get<{ jobs: GenerationJob[] }>(`${API_BASE}/generations/active`);
    }

    cancelGeneration(id: string): Observable<{ job: GenerationJob }> {
        return this.http.post<{ job: GenerationJob }>(`${API_BASE}/generations/${id}/cancel`, {});
    }
}
