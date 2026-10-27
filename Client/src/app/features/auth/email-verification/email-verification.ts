import { Component, inject, computed, effect, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
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

  protected readonly form: FormGroup = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  protected readonly loading = computed(() => this.auth.loading());
  protected readonly error = computed(() => this.auth.error());

  private readonly email = computed(() => this.route.snapshot.queryParamMap.get('email') || '');
  private readonly challengeId = computed(() => this.route.snapshot.queryParamMap.get('challengeId') || '');
  private readonly redirectAfter = computed(() => this.route.snapshot.queryParamMap.get('redirect') || '/dashboard/buyer');

  protected readonly canResend = computed(() => {
    const resendAfter = parseInt(this.route.snapshot.queryParamMap.get('resendAfter') || '0', 10);
    return resendAfter <= 0;
  });

  protected readonly resendCountdown = signal(0);

  constructor() {
    effect(() => {
      const resendAfter = parseInt(this.route.snapshot.queryParamMap.get('resendAfter') || '0', 10);
      if (resendAfter > 0) {
        this.startResendCountdown(resendAfter);
      }
    });
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { code } = this.form.value;
    const email = this.email();
    const challengeId = this.challengeId();

    if (!email || !challengeId) {
      this.notification.error('Missing email or challenge ID. Please start over.');
      this.router.navigate(['/login']);
      return;
    }

    this.auth.verifyEmailCode(challengeId, email, code).subscribe({
      next: (res) => {
        if (res.success) {
          this.notification.success('Email verified successfully! You can now log in.');
          this.router.navigate(['/login'], {
            queryParams: {
              email,
              justVerified: 'true',
            },
          });
        } else {
          this.notification.error(res.message || 'Verification failed');
        }
      },
      error: () => {
        this.notification.error(this.auth.error() || 'An error occurred. Please try again.');
      },
    });
  }

  protected onResend(): void {
    const email = this.email();
    if (!email) {
      this.notification.error('Email address is missing. Please start over.');
      this.router.navigate(['/login']);
      return;
    }

    this.auth.requestEmailVerification(email).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.notification.success('Verification code sent! Please check your email.');
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
              email,
              challengeId: res.data.challengeId,
              resendAfter: res.data.resendAfterSeconds,
              redirect: this.redirectAfter(),
            },
            queryParamsHandling: 'merge',
          });
        } else {
          this.notification.error(res.message || 'Failed to send verification code');
        }
      },
      error: () => {
        this.notification.error(this.auth.error() || 'An error occurred. Please try again.');
      },
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
