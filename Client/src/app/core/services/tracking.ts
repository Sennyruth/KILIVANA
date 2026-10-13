import { Injectable, inject, computed, signal } from '@angular/core';
import { Observable, finalize, map } from 'rxjs';

import { HttpService } from './http';
import { ApiEndpoints } from '../../shared/api.config';
import { TrackingHistory, TrackingStage } from '../../shared/tracking.model';
import { ApiResponse } from '../../shared/api-response';
import { OrderStatus } from '../../shared/order.model';

export const STAGE_ORDER: TrackingStage[] = [
  'ORDER_PLACED',
  'ORDER_CONFIRMED',
  'PAYMENT_RECEIVED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

interface OrderTimelineEvent {
  id: number;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class Tracking {
  private readonly http = inject(HttpService);

  private readonly _history = signal<TrackingHistory | null>(null);
  private readonly _loading = signal<boolean>(false);

  readonly history = this._history.asReadonly();
  readonly loading = this._loading.asReadonly();

  clear(): void {
    this._history.set(null);
    this._loading.set(false);
  }

  load(orderId: string): Observable<ApiResponse<TrackingHistory | null>> {
    this._loading.set(true);
    return this.http.get<OrderTimelineEvent[]>(ApiEndpoints.ORDERS.TIMELINE(orderId)).pipe(
      map((res): ApiResponse<TrackingHistory | null> => {
        if (!res.success || !res.data) return { ...res, data: null };

        const events = [...res.data].sort(
          (left, right) =>
            new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
        );
        let currentStage: TrackingStage = 'ORDER_PLACED';
        const mappedEvents = events.map((event) => {
          const stage = stageForStatus(event.status, currentStage);
          if (event.status !== 'CANCELLED' && event.status !== 'FAILED') {
            currentStage = stage;
          }
          return {
            id: String(event.id),
            stage,
            status: 'COMPLETED' as const,
            timestamp: event.createdAt,
            label: statusLabel(event.status),
            note: event.note ?? undefined,
          };
        });
        const history = {
            orderId,
            currentStage,
            events: mappedEvents,
        };
        this._history.set(history);
        return { ...res, data: history };
      }),
      finalize(() => this._loading.set(false)),
    );
  }

  stageIndex(stage: TrackingStage): number {
    return STAGE_ORDER.indexOf(stage);
  }

  stageLabel(stage: TrackingStage): string {
    return STAGE_LABELS[stage];
  }

  eventForStage(history: TrackingHistory, stage: TrackingStage) {
    return history.events.find((e) => e.stage === stage) ?? null;
  }
}

const STAGE_LABELS: Record<TrackingStage, string> = {
  ORDER_PLACED: 'Order Placed',
  ORDER_CONFIRMED: 'Confirmed',
  PAYMENT_RECEIVED: 'Payment Received',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
};

function stageForStatus(status: OrderStatus, fallback: TrackingStage): TrackingStage {
  switch (status) {
    case 'PENDING':
      return 'ORDER_PLACED';
    case 'CONFIRMED':
    case 'PREPARING':
    case 'PACKED':
    case 'READY_FOR_PICKUP':
      return 'ORDER_CONFIRMED';
    case 'PICKED_UP':
    case 'IN_TRANSIT':
    case 'SHIPPED':
      return 'SHIPPED';
    case 'OUT_FOR_DELIVERY':
      return 'OUT_FOR_DELIVERY';
    case 'DELIVERED':
    case 'COMPLETED':
      return 'DELIVERED';
    case 'CANCELLED':
    case 'FAILED':
      return fallback;
  }
}

function statusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    PENDING: 'Order placed',
    CONFIRMED: 'Order confirmed',
    PREPARING: 'Being prepared',
    PACKED: 'Packed',
    READY_FOR_PICKUP: 'Ready for pickup',
    PICKED_UP: 'Picked up',
    IN_TRANSIT: 'In transit',
    SHIPPED: 'Shipped',
    OUT_FOR_DELIVERY: 'Out for delivery',
    DELIVERED: 'Delivered',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    FAILED: 'Delivery issue',
  };
  return labels[status];
}