import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { ShellComponent } from './components/shell/shell';
import { LoginPage } from './pages/login/login';
import { LibraryPage } from './pages/library/library';
import { GeneratePage } from './pages/generate/generate';
import { PlaylistsPage } from './pages/playlists/playlists';
import { PlaylistDetailPage } from './pages/playlist-detail/playlist-detail';

export const routes: Routes = [
    { path: 'login', component: LoginPage },
    {
        path: '',
        component: ShellComponent,
        canActivate: [authGuard],
        children: [
            { path: '', pathMatch: 'full', redirectTo: 'library' },
            { path: 'library', component: LibraryPage },
            { path: 'create', component: GeneratePage },
            { path: 'playlists', component: PlaylistsPage },
            { path: 'playlists/:id', component: PlaylistDetailPage },
        ],
    },
    { path: '**', redirectTo: '' },
];
