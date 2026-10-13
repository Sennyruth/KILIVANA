import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-reset-password',
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
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  private readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly emailFromLink = this.route.snapshot.queryParamMap.get('email') ?? '';
  protected readonly form = this.formBuilder.group({
    email: [this.emailFromLink, [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  });
  protected readonly loading = computed(() => this.auth.loading());
  protected readonly error = computed(() => this.auth.error());
  protected readonly completed = signal(false);
  protected readonly mismatch = signal(false);

  protected onSubmit(): void {
    if (this.loading()) return;
    this.mismatch.set(false);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { password, confirmPassword } = this.form.getRawValue();
    if (password !== confirmPassword) {
      this.mismatch.set(true);
      return;
    }

    this.auth.resetPassword(this.form.controls.email.value ?? '', password ?? '').subscribe({
      next: (response) => {
        if (response.success) this.completed.set(true);
      },
      error: () => undefined,
    });
  }
}
