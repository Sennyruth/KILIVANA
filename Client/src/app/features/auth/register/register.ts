import { Component, inject, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Auth } from '../../../core/services/auth';
import { UserRole } from '../../../shared/user.model';

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
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  protected readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(/^\+254\d{9}$/)]],
    region: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['BUYER', [Validators.required]],
  });

  protected readonly loading = computed(() => this.auth.loading());
  protected readonly error = computed(() => this.auth.error());

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, email, phone, password, role, username, region } = this.form.value;
    this.auth.register(name, email, phone, password, role, username, region).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('Account created successfully!', 'Close', { duration: 3000 });
          this.router.navigate([this.getDashboardRoute()]);
        } else {
          this.snackBar.open(res.message || 'Registration failed', 'Close', { duration: 5000 });
        }
      },
      error: () => {
        this.snackBar.open(this.auth.error() || 'An error occurred. Please try again.', 'Close', { duration: 5000 });
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