import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Auth } from '../../../core/services/auth';
import { Order } from '../../../core/services/order';
import type { OrderStatus } from '../../../shared/order.model';
import { NotificationService } from '../../../shared/notification/notification.service';

@Component({
  selector: 'app-buyer-dashboard',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    CurrencyPipe,
    DatePipe,
  ],
  styleUrl: './buyer-dashboard.scss',
  templateUrl: './buyer-dashboard.html',
})
export class BuyerDashboard implements OnInit {
  protected readonly auth = inject(Auth);
  protected readonly order = inject(Order);
  private readonly notification = inject(NotificationService);

  protected readonly userName = this.auth.name;
  protected readonly orders = this.order.orders;
  protected readonly loading = this.order.loading;
  protected readonly error = this.order.error;

  protected readonly stats = computed(() => {
    const items = this.orders();
    const count = (status: OrderStatus) =>
      items.filter((o) => o.status === status).length;
    return {
      total: items.length,
      pending: count('PENDING'),
      confirmed: count('CONFIRMED'),
      packed: count('PACKED'),
      shipped: count('SHIPPED'),
      outForDelivery: count('OUT_FOR_DELIVERY'),
      delivered: count('DELIVERED'),
      cancelled: count('CANCELLED'),
    };
  });

  protected readonly recentOrders = computed(() => this.orders().slice(0, 5));

  protected readonly hasOrders = computed(() => this.orders().length > 0);

  protected readonly showContent = computed(
    () => !this.loading() && !this.error(),
  );

  ngOnInit(): void {
    this.loadOrders();
  }

  protected loadOrders(): void {
    const buyerId = this.auth.user()?.id;
    if (!buyerId || !/^\d+$/.test(buyerId)) {
      this.notification.error('Could not identify your buyer account. Please sign in again.');
      return;
    }

    this.order.loadMine(buyerId).subscribe({
      error: () => {
        this.notification.error('Failed to load orders');
      }
    });
  }

  protected statusLabel(status: OrderStatus): string {
    return this.order.statusLabel(status);
  }

  protected statusClass(status: OrderStatus): string {
    switch (status) {
      case 'PENDING':
        return 'order-status order-status--pending';
      case 'CONFIRMED':
        return 'order-status order-status--confirmed';
      case 'PACKED':
        return 'order-status order-status--packed';
      case 'SHIPPED':
        return 'order-status order-status--shipped';
      case 'OUT_FOR_DELIVERY':
        return 'order-status order-status--out-for-delivery';
      case 'DELIVERED':
        return 'order-status order-status--delivered';
      case 'CANCELLED':
        return 'order-status order-status--cancelled';
      default:
        return 'order-status';
    }
  }
}
