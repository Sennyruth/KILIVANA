import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-account-profile',
  imports: [ReactiveFormsModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './account-profile.html',
  styleUrl: './account-profile.scss',
})
export class AccountProfile implements OnInit {
  protected readonly auth = inject(Auth);
  private readonly fb = inject(FormBuilder);
  protected readonly editing = signal(false);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    phone: ['', [Validators.required, Validators.maxLength(32)]],
    region: ['', Validators.maxLength(100)],
  });

  ngOnInit(): void {
    this.auth.fetchProfile().subscribe({
      next: (response) => {
        if (!response.success) this.error.set(response.message || 'Could not load your profile.');
        this.syncForm();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.errorMessage(err, 'Could not load your profile.'));
        this.syncForm();
      },
      complete: () => this.loading.set(false),
    });
  }

  protected startEditing(): void {
    this.error.set(null);
    this.success.set(null);
    this.syncForm();
    this.editing.set(true);
  }

  protected cancelEditing(): void {
    this.error.set(null);
    this.syncForm();
    this.editing.set(false);
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.auth.updateOwnProfile(this.form.getRawValue()).pipe(
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.error.set(response.message || 'Could not save your profile.');
          return;
        }
        this.syncForm();
        this.editing.set(false);
        this.success.set('Your profile was updated.');
      },
      error: (err: HttpErrorResponse) => this.error.set(this.errorMessage(err, 'Could not save your profile.')),
    });
  }

  private syncForm(): void {
    const user = this.auth.user();
    if (user) this.form.reset({ name: user.name, email: user.email, phone: user.phone, region: user.region ?? '' });
    this.loading.set(false);
  }

  private errorMessage(error: HttpErrorResponse, fallback: string): string {
    const body = error.error as { message?: string } | null;
    if (error.status === 409) return body?.message || 'That email address or phone number is already in use.';
    return body?.message || fallback;
  }
}
