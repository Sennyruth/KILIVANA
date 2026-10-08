import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import type { OrderStatus } from '../../../../shared/order.model';

type ProgressStage = 'Order placed' | 'Confirmed' | 'Shipped' | 'Delivered';

@Component({
  selector: 'app-order-progress',
  imports: [RouterLink, MatIconModule],
  templateUrl: './order-progress.html',
  styleUrl: './order-progress.scss',
})
export class OrderProgress {
  readonly status = input.required<OrderStatus>();
  readonly orderId = input.required<string>();
  protected readonly stages: ProgressStage[] = [
    'Order placed',
    'Confirmed',
    'Shipped',
    'Delivered',
  ];
  protected readonly activeIndex = computed(() => this.getProgressIndex(this.status()));
  protected readonly progressWidth = computed(() => {
    const index = this.activeIndex();
    return index < 0 ? 0 : (index / (this.stages.length - 1)) * 100;
  });
  protected readonly summary = computed(() => {
    const status = this.status();
    if (status === 'CANCELLED') return 'This order was cancelled.';
    if (status === 'FAILED') return 'There is an issue with this delivery.';
    return `${this.statusLabel(status)} · Shipment progress updates as your order moves`;
  });
  protected readonly terminal = computed(() => ['CANCELLED', 'FAILED'].includes(this.status()));

  protected stageClass(index: number): string {
    const progress = this.activeIndex();
    if (progress < 0) return 'order-progress__stage order-progress__stage--inactive';
    if (index < progress) return 'order-progress__stage order-progress__stage--complete';
    if (index === progress) return 'order-progress__stage order-progress__stage--current';
    return 'order-progress__stage order-progress__stage--upcoming';
  }

  protected statusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      PENDING: 'Awaiting confirmation',
      CONFIRMED: 'Confirmed',
      PACKED: 'Being prepared',
      SHIPPED: 'On the way',
      OUT_FOR_DELIVERY: 'Out for delivery',
      DELIVERED: 'Delivered',
      CANCELLED: 'Cancelled',
      PREPARING: 'Being prepared',
      READY_FOR_PICKUP: 'Ready for pickup',
      PICKED_UP: 'Picked up',
      IN_TRANSIT: 'In transit',
      COMPLETED: 'Delivered',
      FAILED: 'Delivery issue',
    };
    return labels[status];
  }

  private getProgressIndex(status: OrderStatus): number {
    switch (status) {
      case 'PENDING':
        return 0;
      case 'CONFIRMED':
      case 'PREPARING':
      case 'PACKED':
      case 'READY_FOR_PICKUP':
        return 1;
      case 'SHIPPED':
      case 'IN_TRANSIT':
      case 'PICKED_UP':
      case 'OUT_FOR_DELIVERY':
        return 2;
      case 'DELIVERED':
      case 'COMPLETED':
        return 3;
      case 'CANCELLED':
      case 'FAILED':
        return -1;
    }
  }
}
