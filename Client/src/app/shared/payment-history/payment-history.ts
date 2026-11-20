import { Component, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Auth } from '../../core/services/auth';
import { Payment } from '../../core/services/payment';
import { NotificationService } from '../notification/notification.service';
import type { PaymentStatusResponse } from '../payment.model';

@Component({
  selector: 'app-payment-history',
  imports: [CurrencyPipe, DatePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './payment-history.html',
  styleUrl: './payment-history.scss',
})
export class PaymentHistory implements OnInit, OnDestroy {
  private readonly auth = inject(Auth);
  private readonly payment = inject(Payment);
  private readonly notification = inject(NotificationService);
  protected readonly payments = signal<PaymentStatusResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  private refreshTimer?: Subscription;
  private hasInitialSnapshot = false;

  ngOnInit(): void {
    this.load();
    this.refreshTimer = interval(30_000).subscribe(() => {
      if (!this.loading()) this.load();
    });
  }

  ngOnDestroy(): void {
    this.refreshTimer?.unsubscribe();
  }

  @HostListener('window:focus')
  protected refreshOnFocus(): void {
    if (!this.loading()) this.load();
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
        const nextPayments = response.success && Array.isArray(response.data) ? response.data : [];
        if (this.hasInitialSnapshot) this.notifyStatusChanges(nextPayments);
        this.hasInitialSnapshot = true;
        this.payments.set(nextPayments);
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

  protected paymentMessage(status: string): string | null {
    const normalized = status.toUpperCase();
    if (normalized === 'PAID' || normalized === 'SETTLED') return 'Payment successful.';
    if (normalized === 'CANCELLED') return 'Payment cancelled. No payment was received.';
    return null;
  }

  private notifyStatusChanges(nextPayments: PaymentStatusResponse[]): void {
    const previous = new Map(this.payments().map((payment) => [String(payment.id ?? payment.paymentId), payment.status.toUpperCase()]));
    for (const payment of nextPayments) {
      const id = String(payment.id ?? payment.paymentId);
      const before = previous.get(id);
      const after = payment.status.toUpperCase();
      if (before === 'PENDING' && (after === 'PAID' || after === 'SETTLED')) {
        this.notification.success(`Payment successful for order ${payment.orderId}.`);
      } else if (before === 'PENDING' && after === 'CANCELLED') {
        this.notification.warning(`Payment cancelled for order ${payment.orderId}.`);
      }
    }
  }
}
