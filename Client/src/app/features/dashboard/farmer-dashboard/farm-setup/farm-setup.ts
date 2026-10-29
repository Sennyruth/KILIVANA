import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, finalize, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { Auth } from '../../../../core/services/auth';
import { Farmer } from '../../../../core/services/farmer';
import type { FarmerProfileImage } from '../../../../shared/farmer.model';
import type { FarmerFarm, FarmerFarmRequest } from '../../../../shared/farm.model';

@Component({
  selector: 'app-farm-setup',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './farm-setup.html',
  styleUrl: './farm-setup.scss',
})
export class FarmSetup implements OnInit, OnDestroy {
  private readonly auth = inject(Auth);
  private readonly farmer = inject(Farmer);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(true);
  protected readonly savingFarm = signal(false);
  protected readonly uploadingPhoto = signal(false);
  protected readonly profileReady = signal(false);
  protected readonly farmReady = signal(false);
  protected readonly manageMode = signal(false);
  protected readonly farm = signal<FarmerFarm | null>(null);
  protected readonly photos = signal<FarmerProfileImage[]>([]);
  protected readonly selectedPhoto = signal<File | null>(null);
  protected readonly preview = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly form = this.fb.group({
    farmName: [`${this.auth.user()?.name ?? ''} Farm`.trim(), [Validators.required, Validators.maxLength(120)]],
    county: [this.auth.user()?.region ?? '', [Validators.required, Validators.maxLength(100)]],
    subCounty: ['', Validators.maxLength(100)],
    address: ['', Validators.maxLength(500)],
    sizeAcres: [1, [Validators.required, Validators.min(0.1)]],
    ownershipType: ['OWNED', Validators.required],
    description: ['', Validators.maxLength(1000)],
  });

  ngOnInit(): void {
    this.manageMode.set(this.route.snapshot.queryParamMap.get('manage') === '1');
    this.load();
  }

  ngOnDestroy(): void {
    this.photos().forEach((photo) => {
      if (photo.url.startsWith('blob:')) URL.revokeObjectURL(photo.url);
    });
    this.clearPreview();
  }

  protected load(): void {
    const id = this.auth.user()?.id;
    if (!id) {
      this.error.set('Your session has expired. Sign in again to continue.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.farmer.getProfile(id).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.profileReady.set(true);
          this.form.patchValue({
            farmName: response.data.farmName || response.data.name,
            county: response.data.region || this.auth.user()?.region || '',
            description: response.data.farmDetails || '',
          });
          this.loadPhotos(id);
        } else {
          this.profileReady.set(false);
          this.photos.set([]);
          this.loading.set(false);
        }
        this.loadFarms();
      },
      error: (err: { status?: number; error?: { message?: string } }) => {
        if (err.status === 404) {
          this.profileReady.set(false);
          this.photos.set([]);
          this.loading.set(false);
          this.loadFarms();
        } else {
          this.error.set(err.error?.message || 'Could not load your farm profile. Try again.');
          this.loading.set(false);
        }
      },
    });
  }

  protected saveFarm(): void {
    if (this.form.invalid || this.savingFarm()) {
      this.form.markAllAsTouched();
      return;
    }
    const id = this.auth.user()?.id;
    if (!id) return;
    const value = this.form.getRawValue();
    const request: FarmerFarmRequest = {
      name: value.farmName?.trim() ?? '',
      county: value.county?.trim() ?? '',
      subCounty: value.subCounty?.trim() || undefined,
      address: value.address?.trim() || undefined,
      sizeAcres: Number(value.sizeAcres),
      ownershipType: value.ownershipType as FarmerFarmRequest['ownershipType'],
      description: value.description?.trim() || undefined,
    };
    const profileRequest = {
      farmName: request.name,
      location: [request.subCounty, request.county].filter(Boolean).join(', '),
      farmDetails: request.description,
      sizeAcres: request.sizeAcres,
      ownershipType: request.ownershipType,
    };

    this.savingFarm.set(true);
    this.error.set(null);
    const saveProfile = this.profileReady()
      ? this.farmer.updateProfile(id, profileRequest)
      : this.farmer.createProfile(id, profileRequest);
    saveProfile.pipe(
      switchMap((response) => {
        if (!response.success) {
          return throwError(() => new Error(response.message || 'Could not save farm profile.'));
        }
        const existingFarm = this.farm();
        if (existingFarm) return this.farmer.updateFarm(existingFarm.id, request);
        return this.farmer.getMyFarms().pipe(
          map((farmsResponse) => {
            const linkedFarm = farmsResponse.data?.[0];
            if (!farmsResponse.success || !linkedFarm) {
              throw new Error(farmsResponse.message || 'The farm profile was saved, but its linked farm could not be loaded.');
            }
            return { ...farmsResponse, data: linkedFarm };
          }),
        );
      }),
      finalize(() => this.savingFarm.set(false)),
    ).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.error.set(response.message || 'Could not save your farm.');
          return;
        }
        this.profileReady.set(true);
        this.farm.set(response.data);
        this.farmReady.set(true);
        if (this.photos().length && !this.manageMode()) void this.router.navigate(['/dashboard/farmer']);
      },
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.error.set(err.error?.message || err.message || 'Could not save your farm. Try again.');
      },
    });
  }

  protected onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.error.set(null);
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type.toLowerCase())) {
      this.error.set('Choose a JPG, PNG, WebP, or GIF image.');
      input.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.error.set('The image must be smaller than 10 MB.');
      input.value = '';
      return;
    }
    this.clearPreview();
    this.selectedPhoto.set(file);
    this.preview.set(URL.createObjectURL(file));
    input.value = '';
  }

  protected uploadPhoto(): void {
    const id = this.auth.user()?.id;
    const file = this.selectedPhoto();
    if (!id || !file || !this.profileReady() || this.uploadingPhoto()) return;
    this.uploadingPhoto.set(true);
    this.error.set(null);
    this.farmer.uploadProfileImage(id, file, this.photos().length === 0).pipe(
      finalize(() => this.uploadingPhoto.set(false)),
    ).subscribe({
      next: (response) => {
        if (!response.success || !(response.data?.length)) {
          this.error.set(response.message || 'The farm photo could not be confirmed. Try again.');
          return;
        }
        this.selectedPhoto.set(null);
        this.clearPreview();
        this.loadPhotos(id);
        if (this.farmReady() && !this.manageMode()) void this.router.navigate(['/dashboard/farmer']);
      },
      error: (err: { error?: { message?: string } }) => this.error.set(err.error?.message || 'The farm photo could not be uploaded. Try again.'),
    });
  }

  protected onPhotoError(event: Event): void {
    (event.target as HTMLImageElement).src = '/placeholder.svg';
  }

  protected cancelEdit(): void {
    void this.router.navigate(['/dashboard/farmer']);
  }

  private loadFarms(): void {
    this.farmer.getMyFarms().subscribe({
      next: (response) => {
        const existingFarm = response.data?.[0] ?? null;
        this.farm.set(existingFarm);
        this.farmReady.set(response.success && !!existingFarm);
        if (existingFarm) {
          this.form.patchValue({
            farmName: existingFarm.name,
            county: existingFarm.county,
            subCounty: existingFarm.subCounty ?? '',
            address: existingFarm.address ?? '',
            sizeAcres: existingFarm.sizeAcres,
            ownershipType: existingFarm.ownershipType,
            description: existingFarm.description ?? '',
          });
        }
        this.loading.set(false);
        this.continueIfReady();
      },
      error: (err: { error?: { message?: string } }) => {
        this.error.set(err.error?.message || 'Could not load your farm records. Check the backend connection and try again.');
        this.loading.set(false);
      },
    });
  }

  private loadPhotos(id: string): void {
    this.farmer.getProfileImages(id).subscribe({
      next: (response) => {
        const photos = response.data ?? [];
        forkJoin(photos.map((photo) => this.farmer.getImageObjectUrl(photo.url).pipe(
          map((url) => ({ ...photo, url })),
          catchError(() => of({ ...photo, url: '/placeholder.svg' })),
        ))).subscribe((displayPhotos) => {
          this.photos().forEach((photo) => {
            if (photo.url.startsWith('blob:')) URL.revokeObjectURL(photo.url);
          });
          this.photos.set(displayPhotos);
          this.continueIfReady();
        });
      },
      error: () => this.error.set('Could not load your inspection photos. Try again.'),
    });
  }

  private continueIfReady(): void {
    if (this.farmReady() && this.photos().length && !this.manageMode()) {
      void this.router.navigate(['/dashboard/farmer']);
    }
  }

  private clearPreview(): void {
    const preview = this.preview();
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    this.preview.set(null);
  }
}
