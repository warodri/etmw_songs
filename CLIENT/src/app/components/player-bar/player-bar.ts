import { Component, computed, inject } from '@angular/core';
import { PlayerService } from '../../core/player.service';
import { formatDuration } from '../../core/models';

@Component({
    selector: 'app-player-bar',
    templateUrl: './player-bar.html',
    styleUrl: './player-bar.scss',
})
export class PlayerBarComponent {
    readonly player = inject(PlayerService);
    readonly formatDuration = formatDuration;

    readonly progress = computed(() => {
        const duration = this.player.duration();
        return duration > 0 ? (this.player.currentTime() / duration) * 100 : 0;
    });

    seek(event: Event): void {
        const value = Number((event.target as HTMLInputElement).value);
        this.player.seek(value);
    }

    changeVolume(event: Event): void {
        const value = Number((event.target as HTMLInputElement).value);
        this.player.setVolume(value);
    }
}
