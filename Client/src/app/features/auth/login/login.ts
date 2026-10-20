import { Component, inject, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
  private readonly notification = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  protected readonly form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly loading = computed(() => this.auth.loading());
  protected readonly error = computed(() => this.auth.error());

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.value;
    this.auth.login(email, password).subscribe({
      next: (res) => {
        if (res.success) {
          this.notification.success('Welcome back!');
          this.router.navigate([this.getDashboardRoute()]);
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
    if (role === 'FARMER') return '/dashboard/farmer/setup';
    if (role === 'SUPPLIER') return '/dashboard/supplier';
    return '/dashboard/buyer';
  }
}
