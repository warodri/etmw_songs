import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_BASE, TOKEN_KEY, USER_KEY } from './constants';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
    const router = inject(Router);
    const token = localStorage.getItem(TOKEN_KEY);
    const isApiRequest = request.url.startsWith(API_BASE);
    const authorized =
        token && isApiRequest
            ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
            : request;

    return next(authorized).pipe(
        catchError(error => {
            if (error?.status === 401 && isApiRequest) {
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(USER_KEY);
                void router.navigate(['/login']);
            }
            return throwError(() => error);
        })
    );
};
