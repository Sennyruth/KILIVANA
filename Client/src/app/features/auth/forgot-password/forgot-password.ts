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

  protected onSubmit(): void {
    if (this.loading()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.auth.forgotPassword(this.form.controls.email.value ?? '').subscribe({
      next: (response) => {
        if (response.success) {
          this.submitted.set(true);
        }
      },
      error: () => undefined,
    });
  }
}
