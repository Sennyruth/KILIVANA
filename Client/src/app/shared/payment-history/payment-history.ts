import { Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Auth } from '../../core/services/auth';
import { Payment } from '../../core/services/payment';
import type { PaymentStatusResponse } from '../payment.model';

@Component({
  selector: 'app-payment-history',
  imports: [CurrencyPipe, DatePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './payment-history.html',
  styleUrl: './payment-history.scss',
})
export class PaymentHistory implements OnInit {
  private readonly auth = inject(Auth);
  private readonly payment = inject(Payment);
  protected readonly payments = signal<PaymentStatusResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const sellerId = this.auth.user()?.id;
    if (!sellerId || !/^\d+$/.test(sellerId)) {
      this.error.set('Could not identify your seller account. Please sign in again.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.payment.getPaymentsBySeller(sellerId).subscribe({
      next: (response) => {
        this.payments.set(response.success && Array.isArray(response.data) ? response.data : []);
        this.loading.set(false);
        if (!response.success) this.error.set(response.message || 'Payments could not be loaded.');
      },
      error: (error: { error?: { message?: string } }) => {
        this.error.set(error.error?.message || 'Payments could not be loaded.');
        this.loading.set(false);
      },
    });
  }

  protected statusLabel(status: string): string {
    const normalized = status.toUpperCase();
    return normalized === 'PAID' ? 'Paid' : normalized === 'CANCELLED' ? 'Cancelled'
      : normalized === 'FAILED' ? 'Failed' : normalized === 'PENDING' ? 'Pending'
      : normalized.charAt(0) + normalized.slice(1).toLowerCase();
  }
}
