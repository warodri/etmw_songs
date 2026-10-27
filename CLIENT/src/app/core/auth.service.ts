import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, tap } from 'rxjs';
import { API_BASE, TOKEN_KEY, USER_KEY } from './constants';
import { User } from './models';

interface SessionResponse {
    token: string;
    user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly http = inject(HttpClient);

    readonly user = signal<User | null>(this.readUser());
    readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
    readonly isAuthenticated = computed(() => Boolean(this.user() && this.token()));

    requestCode(email: string): Observable<{ success: boolean; message: string }> {
        return this.http.post<{ success: boolean; message: string }>(
            `${API_BASE}/auth/request-code`,
            { email }
        );
    }

    verifyCode(email: string, code: string): Observable<SessionResponse> {
        return this.http
            .post<SessionResponse>(`${API_BASE}/auth/verify-code`, { email, code })
            .pipe(
                tap(session => {
                    localStorage.setItem(TOKEN_KEY, session.token);
                    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
                    this.token.set(session.token);
                    this.user.set(session.user);
                })
            );
    }

    async restore(): Promise<void> {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) {
            this.user.set(null);
            this.token.set(null);
            return;
        }

        try {
            const response = await firstValueFrom(
                this.http.get<{ user: User }>(`${API_BASE}/auth/me`)
            );
            if (response?.user) {
                localStorage.setItem(USER_KEY, JSON.stringify(response.user));
                this.user.set(response.user);
                this.token.set(token);
            }
        } catch {
            this.logout();
        }
    }

    logout(): void {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        this.token.set(null);
        this.user.set(null);
    }

    private readUser(): User | null {
        try {
            const raw = localStorage.getItem(USER_KEY);
            return raw ? (JSON.parse(raw) as User) : null;
        } catch {
            return null;
        }
    }
}
