import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';
import { Auth } from '../../../../core/services/auth';
import { SellerLocationService } from '../../../../core/services/seller-location';
import type { SellerLocationRequest } from '../../../../shared/seller-location.model';

@Component({
  selector: 'app-warehouse-setup',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './warehouse-setup.html',
  styleUrl: './warehouse-setup.scss',
})
export class WarehouseSetup {
  private readonly auth = inject(Auth);
  private readonly locationService = inject(SellerLocationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(255)]],
    address: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)]],
    county: [this.auth.user()?.region ?? '', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)]],
    latitude: [null as number | null, [Validators.required, Validators.min(-90), Validators.max(90)]],
    longitude: [null as number | null, [Validators.required, Validators.min(-180), Validators.max(180)]],
    contactName: ['', Validators.maxLength(255)],
    contactPhone: ['', Validators.maxLength(32)],
    operatingHours: ['', Validators.maxLength(255)],
  });

  protected saveWarehouse(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    if (value.latitude === null || value.longitude === null) return;
    const request: SellerLocationRequest = {
      name: value.name?.trim() ?? '',
      address: value.address?.trim() ?? '',
      county: value.county?.trim() ?? '',
      latitude: value.latitude,
      longitude: value.longitude,
      contactName: value.contactName?.trim() || undefined,
      contactPhone: value.contactPhone?.trim() || undefined,
      operatingHours: value.operatingHours?.trim() || undefined,
    };

    this.saving.set(true);
    this.error.set(null);
    this.locationService.createLocation(request).pipe(
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.error.set(response.message || 'Could not save your warehouse. Please try again.');
          return;
        }
        void this.router.navigate(['/dashboard/supplier']);
      },
      error: (err: { error?: { message?: string } }) =>
        this.error.set(err.error?.message || 'Could not save your warehouse. Please try again.'),
    });
  }
}
