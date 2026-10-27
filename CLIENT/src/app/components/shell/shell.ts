import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { startWith, switchMap, catchError, of, interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { PlayerService } from '../../core/player.service';
import { PlayerBarComponent } from '../player-bar/player-bar';

@Component({
    selector: 'app-shell',
    imports: [RouterOutlet, RouterLink, RouterLinkActive, PlayerBarComponent],
    templateUrl: './shell.html',
    styleUrl: './shell.scss',
})
export class ShellComponent {
    readonly auth = inject(AuthService);
    readonly player = inject(PlayerService);
    private readonly api = inject(ApiService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    readonly mobileOpen = signal(false);
    readonly engineOnline = signal<boolean | null>(null);

    constructor() {
        interval(60_000)
            .pipe(
                startWith(0),
                switchMap(() =>
                    this.api.getSystemStatus().pipe(catchError(() => of(null)))
                ),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(status => this.engineOnline.set(status ? status.engineOnline : false));
    }

    closeMobile(): void {
        this.mobileOpen.set(false);
    }

    logout(): void {
        this.player.close();
        this.auth.logout();
        void this.router.navigate(['/login']);
    }
}
