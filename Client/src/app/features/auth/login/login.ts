import { Component, inject, computed, effect } from '@angular/core';
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

  constructor() {
    effect(() => {
      const redirectToVerification = this.route.snapshot.queryParamMap.get('redirectToVerification');
      const email = this.route.snapshot.queryParamMap.get('email');
      const justVerified = this.route.snapshot.queryParamMap.get('justVerified');

      if (redirectToVerification === 'true' && email) {
        this.form.patchValue({ email });
        this.router.navigate(['/email-verification'], { queryParams: { email } });
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
          const needsVerification = user?.emailVerified === false || !hasTokens;

          if (needsVerification) {
            this.auth.logout();
            this.notification.info('Verify your email before signing in.');
            this.router.navigate(['/email-verification'], { queryParams: { email } });
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

  private getDashboardRoute(): string {
    const role = this.auth.role();
    if (role === 'FARMER') return '/dashboard/farmer';
    if (role === 'SUPPLIER') return '/dashboard/supplier';
    return '/dashboard/buyer';
  }
}
