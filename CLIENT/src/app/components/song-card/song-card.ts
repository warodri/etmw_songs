import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { PlaylistSummary, Song, coverStyle, formatDuration } from '../../core/models';

@Component({
    selector: 'app-song-card',
    templateUrl: './song-card.html',
    styleUrl: './song-card.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SongCardComponent {
    @Input({ required: true }) song!: Song;
    @Input() playlists: PlaylistSummary[] = [];
    @Input() isCurrent = false;
    @Input() isPlaying = false;
    @Output() play = new EventEmitter<void>();
    @Output() delete = new EventEmitter<void>();
    @Output() add = new EventEmitter<string>();

    readonly formatDuration = formatDuration;

    get artStyle(): Record<string, string> {
        return coverStyle(this.song.id);
    }

    get createdLabel(): string {
        return new Date(this.song.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }
}
