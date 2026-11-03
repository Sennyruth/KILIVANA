import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-forgot-password',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  styleUrl: '../login/login.scss',
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  private readonly auth = inject(Auth);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
  });
  protected readonly loading = computed(() => this.auth.loading());
  protected readonly error = computed(() => this.auth.error());
  protected readonly submitted = signal(false);
  protected readonly confirmation = signal(
    'If the account exists and email delivery is available, reset instructions will be sent.',
  );
  protected readonly requestError = signal<string | null>(null);

  protected onSubmit(): void {
    if (this.loading()) return;
    this.requestError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.auth.forgotPassword(this.form.controls.email.value ?? '').subscribe({
      next: (response) => {
        if (response.success) {
          this.confirmation.set(
            typeof response.data === 'string' && response.data.trim()
              ? response.data
              : response.message || this.confirmation(),
          );
          this.submitted.set(true);
        } else {
          this.requestError.set(response.message || 'Unable to request a password reset. Please try again.');
        }
      },
      error: () => undefined,
    });
  }
}
