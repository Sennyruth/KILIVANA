import { Component, inject, computed, effect, signal } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Auth } from '../../../core/services/auth';
import { NotificationService } from '../../../shared/notification/notification.service';

@Component({
  selector: 'app-login',
  imports: [
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
  ],
  styleUrl: './login.scss',
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notification = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  protected readonly form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly loading = computed(() => this.auth.loading());
  protected readonly error = computed(() => this.auth.error());

  // Prevent multiple rapid verification requests
  private readonly isRequestingVerification = signal(false);
  private readonly lastRequestTime = signal<number>(0);
  private readonly REQUEST_COOLDOWN_MS = 2000; // 2 seconds between requests

  constructor() {
    effect(() => {
      const redirectToVerification = this.route.snapshot.queryParamMap.get('redirectToVerification');
      const email = this.route.snapshot.queryParamMap.get('email');
      const justVerified = this.route.snapshot.queryParamMap.get('justVerified');

      if (redirectToVerification === 'true' && email) {
        this.form.patchValue({ email });
        // Don't auto-request verification to avoid rate limiting
        // User can click a button to request it
        this.notification.info('Please verify your email to continue.');
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { requestVerification: 'true' },
          queryParamsHandling: 'merge',
        });
      }

      if (justVerified === 'true' && email) {
        this.form.patchValue({ email });
        this.notification.success('Email verified! Please log in to continue.');
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          queryParamsHandling: 'merge',
        });
      }
    });
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.value;

    // Clear any existing session data before new login to prevent token conflicts
    this.auth.logout();

    this.auth.login(email, password).subscribe({
      next: (res) => {
        if (res.success) {
          const data = res.data;
          const user = data?.user;
          const hasTokens = data?.accessToken && data?.refreshToken;
          const needsVerification = user?.verificationStatus === 'PENDING' || !hasTokens;

          if (needsVerification) {
            this.requestEmailVerificationAndRedirect(email);
          } else {
            this.notification.success('Welcome back!');
            this.router.navigate([this.getDashboardRoute()]);
          }
        } else {
          this.notification.error(res.message || 'Login failed');
        }
      },
      error: () => {
        this.notification.error(this.auth.error() || 'An error occurred. Please try again.');
      },
    });
  }

  private requestEmailVerification(email: string): void {
    // Prevent rapid requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime();

    if (this.isRequestingVerification() || timeSinceLastRequest < this.REQUEST_COOLDOWN_MS) {
      const waitTime = Math.ceil((this.REQUEST_COOLDOWN_MS - timeSinceLastRequest) / 1000);
      this.notification.info(`Please wait ${waitTime} seconds before requesting again.`);
      return;
    }

    this.isRequestingVerification.set(true);
    this.lastRequestTime.set(now);

    this.auth.requestEmailVerification(email).subscribe({
      next: (res) => {
        this.isRequestingVerification.set(false);
        if (res.success && res.data) {
          this.notification.success('Verification code sent! Please check your email.');
          this.router.navigate(['/email-verification'], {
            queryParams: {
              email,
              challengeId: res.data.challengeId,
              resendAfter: res.data.resendAfterSeconds,
              redirect: this.getDashboardRoute(),
            },
          });
        } else {
          this.notification.error(res.message || 'Failed to send verification code');
        }
      },
      error: (err) => {
        this.isRequestingVerification.set(false);
        // Handle 429 rate limit specifically
        if (err.status === 429) {
          this.notification.error('Too many verification requests. Please wait a few minutes and try again.');
        } else {
          this.notification.error(this.auth.error() || 'Failed to send verification code');
        }
      },
    });
  }

  protected requestVerificationCode(): void {
    const email = this.form.value.email;
    if (!email) {
      this.notification.error('Please enter your email address first.');
      return;
    }
    // Clear the query param to prevent auto-triggering
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      queryParamsHandling: 'merge',
    });
    this.requestEmailVerification(email);
  }

  private requestEmailVerificationAndRedirect(email: string): void {
    this.requestEmailVerification(email);
  }

  protected clearSession(): void {
    this.auth.clearSessionData();
    this.notification.success('Session data cleared. Please log in again.');
  }

  private getDashboardRoute(): string {
    const role = this.auth.role();
    if (role === 'FARMER') return '/dashboard/farmer/setup';
    if (role === 'SUPPLIER') return '/dashboard/supplier';
    return '/dashboard/buyer';
  }
}
