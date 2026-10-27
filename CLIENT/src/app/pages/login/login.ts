import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { TOKEN_KEY } from '../../core/constants';

@Component({
    selector: 'app-login',
    imports: [FormsModule],
    templateUrl: './login.html',
    styleUrl: './login.scss',
})
export class LoginPage {
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    readonly email = signal('');
    readonly code = signal('');
    readonly step = signal<'email' | 'code'>('email');
    readonly loading = signal(false);
    readonly error = signal<string | null>(null);
    readonly message = signal<string | null>(null);
    readonly cooldown = signal(0);
    private timer: ReturnType<typeof setInterval> | null = null;

    constructor() {
        if (localStorage.getItem(TOKEN_KEY)) {
            void this.router.navigate(['/library']);
        }

        this.destroyRef.onDestroy(() => {
            if (this.timer) {
                clearInterval(this.timer);
            }
        });
    }

    sendCode(): void {
        const email = this.email().trim();
        if (!email || !email.includes('@')) {
            this.error.set('Enter a valid email address.');
            return;
        }

        this.loading.set(true);
        this.error.set(null);
        this.message.set(null);

        this.auth.requestCode(email).subscribe({
            next: response => {
                this.loading.set(false);
                this.step.set('code');
                this.message.set(response.message);
                this.code.set('');
                this.startCooldown();
            },
            error: error => {
                this.loading.set(false);
                this.error.set(error?.error?.message ?? 'Could not send the login code. Try again.');
            },
        });
    }

    verify(): void {
        const code = this.code().trim();
        if (!/^\d{6}$/.test(code)) {
            this.error.set('Enter the 6-digit code from your email.');
            return;
        }

        this.loading.set(true);
        this.error.set(null);

        this.auth.verifyCode(this.email().trim(), code).subscribe({
            next: () => {
                this.loading.set(false);
                void this.router.navigate(['/library']);
            },
            error: error => {
                this.loading.set(false);
                this.error.set(error?.error?.message ?? 'That code did not work. Try again.');
            },
        });
    }

    useDifferentEmail(): void {
        this.step.set('email');
        this.code.set('');
        this.error.set(null);
        this.message.set(null);
        this.cooldown.set(0);
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private startCooldown(): void {
        this.cooldown.set(45);
        if (this.timer) {
            clearInterval(this.timer);
        }
        this.timer = setInterval(() => {
            this.cooldown.update(value => Math.max(0, value - 1));
            if (this.cooldown() === 0 && this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
        }, 1000);
    }
}
