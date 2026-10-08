import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Order as OrderService } from '../../../core/services/order';
import type { Order as OrderModel, OrderStatus } from '../../../shared/order.model';
import type { TrackingEvent, TrackingStage } from '../../../shared/tracking.model';
import { TrackingStepper } from '../../../shared/tracking-stepper/tracking-stepper';
import { Tracking } from '../../../core/services/tracking';

@Component({
  selector: 'app-order-tracker',
  imports: [RouterLink, MatIconModule, MatButtonModule, TrackingStepper, CurrencyPipe, DatePipe],
  styleUrl: './order-tracker.scss',
  templateUrl: './order-tracker.html',
})
export class OrderTracker implements OnInit {
  protected readonly route = inject(ActivatedRoute);
  protected readonly tracking = inject(Tracking);
  private readonly orderService = inject(OrderService);
  protected readonly orderId = signal(this.route.snapshot.paramMap.get('orderId') ?? 'last');

  protected readonly history = this.tracking.history;
  protected readonly loading = this.tracking.loading;
  protected readonly error = signal<string | null>(null);
  protected readonly detailError = signal<string | null>(null);
  protected readonly order = signal<OrderModel | null>(null);
  protected readonly timelineEvents = computed(() =>
    [...(this.history()?.events ?? [])].sort(
      (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    ),
  );
  protected readonly currentStatus = computed(
    () => this.order()?.status ?? this.history()?.currentStage ?? null,
  );

  ngOnInit(): void {
    this.tracking.clear();
    if (this.orderId() === 'last') this.loadLatestOrder();
    else this.loadTracking(this.orderId());
  }

  protected retry(): void {
    this.error.set(null);
    this.detailError.set(null);
    this.tracking.clear();
    if (this.orderId() === 'last') this.loadLatestOrder();
    else this.loadTracking(this.orderId());
  }

  protected stageLabel(stage: TrackingStage): string {
    const labels: Record<TrackingStage, string> = {
      ORDER_PLACED: 'Order placed',
      ORDER_CONFIRMED: 'Order confirmed',
      PAYMENT_RECEIVED: 'Payment received',
      SHIPPED: 'Shipped',
      OUT_FOR_DELIVERY: 'Out for delivery',
      DELIVERED: 'Delivered',
    };
    return labels[stage];
  }

  protected statusLabel(status: OrderStatus | TrackingStage): string {
    const labels: Record<string, string> = {
      PENDING: 'Order received',
      CONFIRMED: 'Confirmed',
      PACKED: 'Being prepared',
      PREPARING: 'Being prepared',
      SHIPPED: 'Shipped',
      IN_TRANSIT: 'In transit',
      OUT_FOR_DELIVERY: 'Out for delivery',
      DELIVERED: 'Delivered',
      COMPLETED: 'Delivered',
      CANCELLED: 'Cancelled',
      FAILED: 'Delivery issue',
      ORDER_PLACED: 'Order received',
      ORDER_CONFIRMED: 'Confirmed',
      PAYMENT_RECEIVED: 'Payment received',
    };
    return labels[status] ?? status;
  }

  protected eventStatusLabel(event: TrackingEvent): string {
    if (event.status === 'COMPLETED') return 'Completed';
    if (event.status === 'IN_PROGRESS') return 'In progress';
    return 'Upcoming';
  }

  private loadLatestOrder(): void {
    this.orderService.loadMine().subscribe({
      next: (response) => {
        const orders = response.success ? response.data?.orders ?? [] : [];
        const latest = [...orders].sort(
          (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
        )[0];
        if (!latest) {
          this.error.set(response.message || 'No recent order was found to track.');
          return;
        }
        this.order.set(latest);
        this.orderId.set(latest.id);
        this.loadTracking(latest.id);
      },
      error: () => this.error.set('Your latest order could not be loaded. Please try again.'),
    });
  }

  private loadTracking(id: string): void {
    this.orderService.getById(id).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.detailError.set(response.message || 'Order details are unavailable.');
          return;
        }
        this.order.set(response.data.order);
      },
      error: () => this.detailError.set('Order details are temporarily unavailable.'),
    });

    this.tracking.load(id).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.error.set(response.message || 'Shipment tracking is not available yet.');
        }
      },
      error: () => this.error.set('Shipment tracking could not be loaded. Please try again.'),
    });
  }
}
