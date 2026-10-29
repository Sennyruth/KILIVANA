import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Auth } from '../../../core/services/auth';
import { NotificationService } from '../../../shared/notification/notification.service';

@Component({
  selector: 'app-email-verification',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
  ],
  styleUrl: './email-verification.scss',
  templateUrl: './email-verification.html',
})
export class EmailVerification {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notification = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    email: [this.route.snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]],
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });
  protected readonly loading = this.auth.loading;
  protected readonly error = this.auth.error;
  protected readonly challengeId = signal('');
  protected readonly resendCountdown = signal(0);

  protected requestCode(): void {
    const emailControl = this.form.controls.email;
    if (emailControl.invalid) {
      emailControl.markAsTouched();
      return;
    }
    const email = emailControl.value.trim().toLowerCase();
    this.auth.requestEmailVerification(email).subscribe({
      next: (res) => {
        if (!res.success || !res.data) {
          this.notification.error(res.message || 'Unable to request a verification code.');
          return;
        }
        this.challengeId.set(res.data.challengeId);
        this.form.controls.code.reset();
        this.startResendCountdown(res.data.resendAfterSeconds);
        this.notification.success('If the email belongs to an unverified account, a code has been sent.');
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 429) {
          this.startResendCountdown(60);
          this.notification.error('Too many requests. Please wait one minute before trying again.');
        } else {
          this.notification.error(this.auth.error() || 'Unable to send the code. Please try again.');
        }
      },
    });
  }

  protected onSubmit(): void {
    if (this.form.invalid || !this.challengeId()) {
      this.form.markAllAsTouched();
      if (!this.challengeId()) this.notification.info('Request a verification code first.');
      return;
    }
    const { email, code } = this.form.getRawValue();
    this.auth.verifyEmailCode(this.challengeId(), email.trim().toLowerCase(), code).subscribe({
      next: (res) => {
        if (!res.success) {
          this.notification.error(res.message || 'Verification failed.');
          return;
        }
        this.notification.success('Email verified successfully. You can now log in.');
        this.router.navigate(['/login'], { queryParams: { email, justVerified: 'true' } });
      },
      error: () => this.notification.error(this.auth.error() || 'Invalid or expired code. Please try again.'),
    });
  }

  protected onBack(): void {
    this.router.navigate(['/login']);
  }

  private startResendCountdown(seconds: number): void {
    this.resendCountdown.set(seconds);
    const interval = setInterval(() => {
      this.resendCountdown.update((current) => {
        if (current <= 1) {
          clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }
}
