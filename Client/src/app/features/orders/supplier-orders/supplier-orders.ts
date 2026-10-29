import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';
import { Order as OrderService } from '../../../core/services/order';
import type { SellerOrderSummary } from '../../../shared/order.model';
import { NotificationService } from '../../../shared/notification/notification.service';

type SupplierOrderFilter = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

@Component({
  selector: 'app-supplier-orders',
  imports: [RouterLink, CurrencyPipe, DatePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './supplier-orders.html',
  styleUrl: './supplier-orders.scss',
})
export class SupplierOrders implements OnInit {
  private readonly orderService = inject(OrderService);
  private readonly notification = inject(NotificationService);
  private readonly _orders = signal<SellerOrderSummary[]>([]);
  protected readonly orders = this._orders.asReadonly();
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<SupplierOrderFilter>('ALL');

  protected readonly activeCount = computed(
    () => this.orders().filter((order) => !['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(order.status)).length,
  );
  protected readonly completedCount = computed(
    () => this.orders().filter((order) => ['DELIVERED', 'COMPLETED'].includes(order.status)).length,
  );
  protected readonly visibleOrders = computed(() => {
    switch (this.filter()) {
      case 'ACTIVE':
        return this.orders().filter((order) => !['DELIVERED', 'COMPLETED', 'CANCELLED'].includes(order.status));
      case 'COMPLETED':
        return this.orders().filter((order) => ['DELIVERED', 'COMPLETED'].includes(order.status));
      case 'CANCELLED':
        return this.orders().filter((order) => order.status === 'CANCELLED');
      default:
        return this.orders();
    }
  });

  ngOnInit(): void {
    this.loadOrders();
  }

  protected loadOrders(): void {
    this.loading.set(true);
    this.error.set(null);
    this.orderService.loadSupplierOrders().pipe(
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          const message = response.message || 'Failed to load your orders.';
          this.error.set(message);
          this.notification.error(message);
          return;
        }
        this._orders.set(response.data);
      },
      error: () => {
        const message = 'Failed to load your orders. Please try again.';
        this.error.set(message);
        this.notification.error(message);
      },
    });
  }

  protected setFilter(filter: SupplierOrderFilter): void {
    this.filter.set(filter);
  }

  protected orderNumber(id: number): string {
    return `KV-${String(id).slice(-8).toUpperCase()}`;
  }

  protected statusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'Pending',
      CONFIRMED: 'Confirmed',
      PACKED: 'Packed',
      SHIPPED: 'Shipped',
      OUT_FOR_DELIVERY: 'Out for delivery',
      DELIVERED: 'Delivered',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
      PREPARING: 'Preparing',
      READY_FOR_PICKUP: 'Ready for pickup',
      PICKED_UP: 'Picked up',
      IN_TRANSIT: 'In transit',
      FAILED: 'Failed',
    };
    return labels[status] || status;
  }

  protected setStatusClass(status: string): string {
    return `supplier-orders__status supplier-orders__status--${status.toLowerCase().replaceAll('_', '-')}`;
  }
}
