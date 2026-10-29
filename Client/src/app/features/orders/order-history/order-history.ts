import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Auth } from '../../../core/services/auth';
import { Order as OrderService } from '../../../core/services/order';
import { Order, OrderStatus } from '../../../shared/order.model';
import { OrderProgress } from './order-progress/order-progress';

type OrderFilter = 'ALL' | 'IN_PROGRESS' | 'DELIVERED' | 'CANCELLED';

@Component({
  selector: 'app-order-history',
  imports: [RouterLink, MatIconModule, MatButtonModule, OrderProgress],
  styleUrl: './order-history.scss',
  templateUrl: './order-history.html',
})
export class OrderHistory implements OnInit {
  private readonly auth = inject(Auth);
  private readonly orderService = inject(OrderService);

  protected readonly isFarmer = this.auth.isFarmer;
  protected readonly orders = this.orderService.orders;
  protected readonly loading = this.orderService.loading;
  protected readonly error = this.orderService.error;
  protected readonly loadError = signal<string | null>(null);
  protected readonly filter = signal<OrderFilter>('ALL');

  protected readonly visibleOrders = computed(() => {
    const orders = this.orders();
    switch (this.filter()) {
      case 'IN_PROGRESS':
        return orders.filter(
          (order) => !['DELIVERED', 'COMPLETED', 'CANCELLED', 'FAILED'].includes(order.status),
        );
      case 'DELIVERED':
        return orders.filter((order) => ['DELIVERED', 'COMPLETED'].includes(order.status));
      case 'CANCELLED':
        return orders.filter((order) => order.status === 'CANCELLED');
      default:
        return orders;
    }
  });

  protected readonly activeCount = computed(
    () =>
      this.orders().filter(
        (order) => !['DELIVERED', 'COMPLETED', 'CANCELLED', 'FAILED'].includes(order.status),
      ).length,
  );
  protected readonly deliveredCount = computed(
    () => this.orders().filter((order) => ['DELIVERED', 'COMPLETED'].includes(order.status)).length,
  );

  ngOnInit(): void {
    this.loadOrders();
  }

  protected loadOrders(): void {
    this.loadError.set(null);
    if (!this.auth.isBuyer() && !this.auth.isFarmer()) {
      this.loadError.set('Order history is only available to buyer and farmer accounts.');
      return;
    }
    const buyerId = this.auth.user()?.id;
    if (!buyerId || !/^\d+$/.test(buyerId)) {
      this.loadError.set('Could not identify your buyer account. Please sign in again.');
      return;
    }

    this.orderService.loadMine(buyerId).subscribe({
      error: () => {
        // Error is handled by the error signal
      }
    });
  }

  protected setFilter(filter: OrderFilter): void {
    this.filter.set(filter);
  }

  protected orderNumber(id: string): string {
    return `KV-${id.slice(-8).toUpperCase()}`;
  }

  protected statusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      PENDING: 'Awaiting confirmation',
      CONFIRMED: 'Confirmed',
      PACKED: 'Packed',
      SHIPPED: 'On the way',
      OUT_FOR_DELIVERY: 'Out for delivery',
      DELIVERED: 'Delivered',
      CANCELLED: 'Cancelled',
      PREPARING: 'Preparing',
      READY_FOR_PICKUP: 'Ready for pickup',
      PICKED_UP: 'Picked up',
      IN_TRANSIT: 'In transit',
      COMPLETED: 'Completed',
      FAILED: 'Failed',
    };
    return labels[status];
  }

  protected formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';
    return new Intl.DateTimeFormat('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  protected formatTotal(value: number): string {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
