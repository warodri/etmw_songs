import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, interval, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../core/api.service';
import { PlayerService } from '../../core/player.service';
import { GeneratePayload, GenerationJob } from '../../core/models';

const DEFAULT_LYRICS = `[Verse]
Streetlights paint the window gold
A story only we have told
The city hums a quiet tune
Underneath a paper moon

[Chorus]
Turn it up and let it run
We are not done, we have just begun
Every beat a little spark
Lighting up the dark`;

const QUICK_TAGS = [
    'pop',
    'rock',
    'hip hop',
    'electronic',
    'jazz',
    'classical',
    'lo-fi',
    'cinematic',
    'female voice',
    'male voice',
    'piano',
    'guitar',
    'synth',
    'happy',
    'sad',
    'energetic',
    'romantic',
];

@Component({
    selector: 'app-generate',
    imports: [FormsModule, RouterLink],
    templateUrl: './generate.html',
    styleUrl: './generate.scss',
})
export class GeneratePage {
    private readonly api = inject(ApiService);
    private readonly destroyRef = inject(DestroyRef);
    readonly player = inject(PlayerService);

    readonly quickTags = QUICK_TAGS;
    readonly title = signal('');
    readonly lyrics = signal(DEFAULT_LYRICS);
    readonly tagsInput = signal('pop, warm, female voice');
    readonly duration = signal(60);
    readonly topk = signal(50);
    readonly temperature = signal(1);
    readonly cfgScale = signal(3);
    readonly seedInput = signal('');
    readonly advancedOpen = signal(false);
    readonly submitting = signal(false);
    readonly error = signal<string | null>(null);
    readonly toast = signal<string | null>(null);
    readonly jobs = signal<GenerationJob[]>([]);
    readonly engineOnline = signal<boolean | null>(null);
    readonly now = signal(Date.now());
    private refreshing = false;
    private toastTimer: ReturnType<typeof setTimeout> | null = null;

    readonly tags = computed(() =>
        Array.from(
            new Set(
                this.tagsInput()
                    .split(',')
                    .map(tag => tag.trim().toLowerCase())
                    .filter(Boolean)
            )
        )
    );

    readonly activeJobs = computed(() =>
        this.jobs().filter(job => job.status === 'queued' || job.status === 'generating')
    );

    constructor() {
        interval(4000)
            .pipe(startWith(0), takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.refreshJobs());

        interval(1000)
            .pipe(startWith(0), takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.now.set(Date.now()));

        interval(60_000)
            .pipe(startWith(0), takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.checkEngine());

        this.loadActiveJobs();
        this.destroyRef.onDestroy(() => {
            if (this.toastTimer) {
                clearTimeout(this.toastTimer);
            }
        });
    }

    hasTag(tag: string): boolean {
        return this.tags().includes(tag);
    }

    toggleTag(tag: string): void {
        const next = new Set(this.tags());
        if (next.has(tag)) {
            next.delete(tag);
        } else {
            next.add(tag);
        }
        this.tagsInput.set(Array.from(next).join(', '));
    }

    setDuration(value: string | number): void {
        this.duration.set(Number(value));
    }

    seedValue(): number | null {
        const raw = this.seedInput().trim();
        if (!raw) {
            return null;
        }
        const value = Number(raw);
        return Number.isFinite(value) ? Math.trunc(value) : null;
    }

    submit(): void {
        this.error.set(null);
        if (this.lyrics().trim().length < 10) {
            this.error.set('Write at least a few lines of lyrics.');
            return;
        }
        if (this.tags().length === 0) {
            this.error.set('Add at least one style tag.');
            return;
        }

        const payload: GeneratePayload = {
            title: this.title().trim() || undefined,
            lyrics: this.lyrics().trim(),
            tags: this.tags(),
            durationSeconds: this.duration(),
            topk: this.topk(),
            temperature: this.temperature(),
            cfgScale: this.cfgScale(),
            seed: this.seedValue(),
        };

        this.submitting.set(true);
        this.api.createGeneration(payload).subscribe({
            next: response => {
                this.submitting.set(false);
                this.jobs.update(list => [response.job, ...list].slice(0, 12));
                this.notify('Your song is in the queue.');
                this.refreshJobs();
            },
            error: error => {
                this.submitting.set(false);
                this.error.set(error?.error?.message ?? 'Could not start that song. Try again.');
            },
        });
    }

    cancel(job: GenerationJob): void {
        this.api.cancelGeneration(job.id).subscribe({
            next: response => this.replaceJob(response.job),
            error: () => this.notify('Could not cancel that song.'),
        });
    }

    playJob(job: GenerationJob): void {
        if (!job.songId) {
            return;
        }
        this.api.getSong(job.songId).subscribe({
            next: response => this.player.play(response.song),
            error: () => this.notify('That song could not be loaded.'),
        });
    }

    elapsed(job: GenerationJob): string {
        if (job.status === 'completed') {
            return 'Ready';
        }
        if (job.status === 'failed') {
            return 'Stopped';
        }
        if (job.status === 'queued') {
            return job.queuePosition > 1 ? `Queue position ${job.queuePosition}` : 'Queued';
        }

        const start = new Date(job.startedAt ?? job.createdAt).getTime();
        const seconds = Math.max(0, Math.floor((this.now() - start) / 1000));
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
    }

    statusLabel(job: GenerationJob): string {
        switch (job.status) {
            case 'queued':
                return 'Queued';
            case 'generating':
                return 'Generating';
            case 'completed':
                return 'Ready';
            case 'failed':
                return 'Failed';
        }
    }

    private loadActiveJobs(): void {
        this.api
            .getActiveGenerations()
            .pipe(catchError(() => of({ jobs: [] as GenerationJob[] })))
            .subscribe(response => this.jobs.set(response.jobs));
    }

    private refreshJobs(): void {
        if (this.refreshing) {
            return;
        }

        const active = this.jobs().filter(
            job => job.status === 'queued' || job.status === 'generating'
        );
        if (active.length === 0) {
            return;
        }

        this.refreshing = true;
        forkJoin(
            active.map(job =>
                this.api.getGeneration(job.id).pipe(
                    map(response => response.job),
                    catchError(() => of(null))
                )
            )
        ).subscribe(updated => {
            for (const job of updated) {
                if (!job) {
                    continue;
                }
                const previous = this.jobs().find(item => item.id === job.id);
                this.replaceJob(job);
                if (previous && previous.status !== 'completed' && job.status === 'completed') {
                    this.notify(`“${job.title}” is ready to play.`);
                }
            }
            this.refreshing = false;
        });
    }

    private replaceJob(job: GenerationJob): void {
        this.jobs.update(list => list.map(item => (item.id === job.id ? job : item)));
    }

    private checkEngine(): void {
        this.api
            .getSystemStatus()
            .pipe(catchError(() => of(null)))
            .subscribe(status => this.engineOnline.set(status ? status.engineOnline : false));
    }

    private notify(message: string): void {
        this.toast.set(message);
        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
        }
        this.toastTimer = setTimeout(() => this.toast.set(null), 3600);
    }
}
