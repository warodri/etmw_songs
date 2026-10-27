import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withHashLocation, withInMemoryScrolling } from '@angular/router';
import { AuthService } from './core/auth.service';
import { authInterceptor } from './core/auth.interceptor';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(
            routes,
            withHashLocation(),
            withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })
        ),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideAppInitializer(() => inject(AuthService).restore()),
    ],
};
