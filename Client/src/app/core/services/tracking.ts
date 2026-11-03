import { Injectable, inject, computed, signal } from '@angular/core';
import { Observable, finalize, map } from 'rxjs';

import { HttpService } from './http';
import { ApiEndpoints } from '../../shared/api.config';
import { TrackingEvent, TrackingHistory, TrackingStage } from '../../shared/tracking.model';
import { ApiResponse } from '../../shared/api-response';
import { DeliveryStatus, OrderStatus, deliveryStatusLabel } from '../../shared/order.model';

export const STAGE_ORDER: TrackingStage[] = [
  'PLACED',
  'CONFIRMED',
  'IN_TRANSIT',
  'DELIVERED',
  'COMPLETED',
];

interface OrderTimelineEvent {
  id: number;
  status: string;
  note: string | null;
  createdAt: string;
}

interface LogisticsTrackingEvent {
  id: number | string;
  status: string;
  note: string | null;
  location?: string | null;
  locationName?: string | null;
  recordedAt: string;
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
        let currentStage: TrackingStage = 'PLACED';
        const mappedEvents = events.map((event) => {
          const status = normalizeTimelineStatus(event.status);
          const stage = stageForStatus(status, currentStage);
          if (status !== 'CANCELLED' && status !== 'FAILED') {
            currentStage = stage;
          }
          return {
            id: String(event.id),
            stage,
            status: 'COMPLETED' as const,
            timestamp: event.createdAt,
            label: statusLabel(status),
            ...(event.note ? { note: event.note } : {}),
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

  loadDeliveryEvents(jobId: string | number): Observable<ApiResponse<TrackingEvent[]>> {
    return this.http
      .get<LogisticsTrackingEvent[]>(ApiEndpoints.LOGISTICS.TRACKING_EVENTS(jobId))
      .pipe(
        map((response) => {
          if (!response.success || !response.data) return { ...response, data: [] };

          const events = [...response.data].sort(
            (left, right) =>
              new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime(),
          );
          return {
            ...response,
            data: events.map((event, index): TrackingEvent => {
              const status = normalizeDeliveryStatus(event.status);
              const isLatest = index === events.length - 1;
              return {
                id: `delivery-${event.id}`,
                stage: stageForDeliveryStatus(status, this.history()?.currentStage ?? 'CONFIRMED'),
                status: isLatest && !isTerminalDeliveryStatus(status) ? 'IN_PROGRESS' : 'COMPLETED',
                timestamp: event.recordedAt,
                label: deliveryStatusLabel(status) ?? statusLabelForDelivery(status),
                ...(event.note ? { note: event.note } : {}),
                ...(typeof event.locationName === 'string'
                  ? { location: event.locationName }
                  : typeof event.location === 'string'
                    ? { location: event.location }
                    : {}),
              };
            }),
          };
        }),
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

function normalizeDeliveryStatus(value: string): DeliveryStatus {
  const status = value.trim().toUpperCase();
  if (!isDeliveryStatus(status)) {
    throw new Error(`Unknown delivery status in tracking history: ${value}`);
  }
  return status;
}

function isDeliveryStatus(value: string): value is DeliveryStatus {
  const statuses: string[] = [
    'PENDING_ASSIGNMENT',
    'ASSIGNED',
    'ACCEPTED',
    'EN_ROUTE_TO_PICKUP',
    'ARRIVED_AT_PICKUP',
    'PICKED_UP',
    'IN_TRANSIT',
    'ARRIVED_AT_DESTINATION',
    'DELIVERED',
    'CANCELLED',
    'FAILED',
  ];
  return statuses.includes(value);
}

function isTerminalDeliveryStatus(status: DeliveryStatus): boolean {
  return status === 'DELIVERED' || status === 'CANCELLED' || status === 'FAILED';
}

function stageForDeliveryStatus(status: DeliveryStatus, fallback: TrackingStage): TrackingStage {
  switch (status) {
    case 'PENDING_ASSIGNMENT':
    case 'ASSIGNED':
    case 'ACCEPTED':
    case 'EN_ROUTE_TO_PICKUP':
    case 'ARRIVED_AT_PICKUP':
      return 'CONFIRMED';
    case 'PICKED_UP':
    case 'IN_TRANSIT':
    case 'ARRIVED_AT_DESTINATION':
      return 'IN_TRANSIT';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'CANCELLED':
    case 'FAILED':
      return fallback;
  }
}

function statusLabelForDelivery(status: DeliveryStatus): string {
  const labels: Record<DeliveryStatus, string> = {
    PENDING_ASSIGNMENT: 'Awaiting driver assignment',
    ASSIGNED: 'Driver assigned',
    ACCEPTED: 'Driver accepted',
    EN_ROUTE_TO_PICKUP: 'Driver heading to pickup',
    ARRIVED_AT_PICKUP: 'Driver at pickup',
    PICKED_UP: 'Picked up',
    IN_TRANSIT: 'In transit',
    ARRIVED_AT_DESTINATION: 'Arrived at destination',
    DELIVERED: 'Delivered',
    CANCELLED: 'Delivery cancelled',
    FAILED: 'Delivery issue',
  };
  return labels[status];
}

function normalizeTimelineStatus(value: string): OrderStatus {
  const status = value.trim().toUpperCase();
  const mapping: Record<string, OrderStatus> = {
    PLACED: 'PENDING',
    DISPUTED: 'FAILED',
  };
  const normalized = mapping[status] ?? status;
  if (!isOrderStatus(normalized)) {
    throw new Error(`Unknown order status in timeline: ${value}`);
  }
  return normalized;
}

function isOrderStatus(value: string): value is OrderStatus {
  return [
    'PENDING',
    'CONFIRMED',
    'PACKED',
    'SHIPPED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'PREPARING',
    'READY_FOR_PICKUP',
    'PICKED_UP',
    'IN_TRANSIT',
    'COMPLETED',
    'FAILED',
  ].includes(value);
}

const STAGE_LABELS: Record<TrackingStage, string> = {
  PLACED: 'Placed',
  CONFIRMED: 'Confirmed',
  IN_TRANSIT: 'In Transit',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
};

function stageForStatus(status: OrderStatus, fallback: TrackingStage): TrackingStage {
  switch (status) {
    case 'PENDING':
      return 'PLACED';
    case 'CONFIRMED':
    case 'PREPARING':
    case 'PACKED':
    case 'READY_FOR_PICKUP':
      return 'CONFIRMED';
    case 'PICKED_UP':
    case 'IN_TRANSIT':
    case 'SHIPPED':
    case 'OUT_FOR_DELIVERY':
      return 'IN_TRANSIT';
    case 'DELIVERED':
      return 'DELIVERED';
    case 'COMPLETED':
      return 'COMPLETED';
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