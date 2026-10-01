import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { toSignal } from '@angular/core/rxjs-interop';
import { Order as OrderService } from '../../../core/services/order';
import { Order, OrderStatus } from '../../../shared/order.model';

type OrderFilter = 'ALL' | 'IN_PROGRESS' | 'DELIVERED' | 'CANCELLED';

@Component({
  selector: 'app-order-history',
  imports: [RouterLink, MatIconModule, MatButtonModule],
  styleUrl: './order-history.scss',
  templateUrl: './order-history.html',
})
export class OrderHistory implements OnInit {
  private readonly orderService = inject(OrderService);

  protected readonly orders = toSignal(this.orderService.orders$, { initialValue: [] as Order[] });
  protected readonly loading = toSignal(this.orderService.loading$, { initialValue: false });
  protected readonly error = toSignal(this.orderService.error$, { initialValue: null });
  protected readonly filter = signal<OrderFilter>('ALL');

  protected readonly visibleOrders = computed(() => {
    const orders = this.orders();
    switch (this.filter()) {
      case 'IN_PROGRESS':
        return orders.filter((order) => !['DELIVERED', 'CANCELLED'].includes(order.status));
      case 'DELIVERED':
        return orders.filter((order) => order.status === 'DELIVERED');
      case 'CANCELLED':
        return orders.filter((order) => order.status === 'CANCELLED');
      default:
        return orders;
    }
  });

  protected readonly activeCount = computed(
    () => this.orders().filter((order) => !['DELIVERED', 'CANCELLED'].includes(order.status)).length,
  );
  protected readonly deliveredCount = computed(
    () => this.orders().filter((order) => order.status === 'DELIVERED').length,
  );

  ngOnInit(): void {
    this.loadOrders();
  }

  protected loadOrders(): void {
    this.orderService.loadMine().subscribe({
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
