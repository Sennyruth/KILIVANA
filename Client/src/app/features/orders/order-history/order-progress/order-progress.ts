import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { deliveryStatusLabel, type DeliveryStatus, type OrderStatus } from '../../../../shared/order.model';

type ProgressStage = 'Placed' | 'Confirmed' | 'In Transit' | 'Delivered' | 'Completed';

@Component({
  selector: 'app-order-progress',
  imports: [RouterLink, MatIconModule],
  templateUrl: './order-progress.html',
  styleUrl: './order-progress.scss',
})
export class OrderProgress {
  readonly status = input.required<OrderStatus>();
  readonly deliveryStatus = input<DeliveryStatus | null | undefined>(null);
  readonly orderId = input.required<string>();
  protected readonly stages: ProgressStage[] = [
    'Placed',
    'Confirmed',
    'In Transit',
    'Delivered',
    'Completed',
  ];
  protected readonly activeIndex = computed(() =>
    Math.max(this.getProgressIndex(this.status()), this.getDeliveryProgressIndex(this.deliveryStatus())),
  );
  protected readonly progressWidth = computed(() => {
    const index = this.activeIndex();
    return index < 0 ? 0 : (index / (this.stages.length - 1)) * 100;
  });
  protected readonly summary = computed(() => {
    const status = this.status();
    if (status === 'CANCELLED') return 'This order was cancelled.';
    if (status === 'FAILED') return 'There is an issue with this delivery.';
    const dispatchLabel = deliveryStatusLabel(this.deliveryStatus());
    return `${dispatchLabel ?? this.statusLabel(status)} · Shipment progress updates as your order moves`;
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
      COMPLETED: 'Completed',
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
        return 3;
      case 'COMPLETED':
        return 4;
      case 'CANCELLED':
      case 'FAILED':
        return -1;
    }
  }

  private getDeliveryProgressIndex(status?: DeliveryStatus | null): number {
    switch (status) {
      case 'ASSIGNED':
      case 'ACCEPTED':
      case 'EN_ROUTE_TO_PICKUP':
      case 'ARRIVED_AT_PICKUP':
        return 1;
      case 'PICKED_UP':
      case 'IN_TRANSIT':
        return 2;
      case 'ARRIVED_AT_DESTINATION':
        return 2;
      case 'DELIVERED':
        return 3;
      default:
        return -1;
    }
  }
}
