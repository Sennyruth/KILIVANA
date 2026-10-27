import { Component, inject, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Auth } from '../../../core/services/auth';
import { UserRole } from '../../../shared/user.model';
import { NotificationService } from '../../../shared/notification/notification.service';

@Component({
  selector: 'app-register',
  imports: [
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
  ],
  styleUrl: './register.scss',
  templateUrl: './register.html',
})
export class Register {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  protected readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    username: ['', [Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required]],
    region: [''],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['BUYER', [Validators.required]],
  });

  protected readonly loading = computed(() => this.auth.loading());
  protected readonly error = computed(() => this.auth.error());

  protected onSubmit(): void {
    if (this.loading()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, email, phone, password, role, username, region } = this.form.value;
    this.auth.register(name, email, phone, password, role, username, region).subscribe({
      next: (res) => {
        if (res.success) {
          this.notification.success('Account created successfully! Please log in to verify your email.');
          this.router.navigate(['/login'], {
            queryParams: {
              email,
              redirectToVerification: 'true',
            },
          });
        } else {
          this.notification.error(res.message || 'Registration failed');
        }
      },
      error: () => {
        const errorMessage = this.auth.error() || 'Registration failed. Check your details and try again.';
        this.notification.error(errorMessage);
      },
    });
  }

  private getDashboardRoute(role: UserRole): string {
    if (role === 'FARMER') return '/dashboard/farmer/setup';
    if (role === 'SUPPLIER') return '/dashboard/supplier';
    return '/dashboard/buyer';
  }

}