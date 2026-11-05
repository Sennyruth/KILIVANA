import type { DeliveryStatus } from './order.model';

export type TrackingStage =
  | 'PLACED'
  | 'CONFIRMED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'COMPLETED';

export interface TrackingEvent {
  id: string;
  stage: TrackingStage;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';
  timestamp: string;
  label?: string;
  note?: string;
  location?: string;
}

export interface TrackingHistory {
  orderId: string;
  currentStage: TrackingStage;
  events: TrackingEvent[];
}

export const TRACKING_STAGES: TrackingStage[] = [
  'PLACED',
  'CONFIRMED',
  'IN_TRANSIT',
  'DELIVERED',
  'COMPLETED',
];

export function trackingProgressIndex(
  orderStatus?: string | null,
  deliveryStatus?: DeliveryStatus | null,
  historyStage?: TrackingStage | null,
): number {
  const orderIndex = orderStatusIndex(orderStatus);
  const deliveryIndex = deliveryStatusIndex(deliveryStatus);
  const statusIndex = Math.max(orderIndex, deliveryIndex);

  return statusIndex >= 0
    ? statusIndex
    : historyStage
      ? TRACKING_STAGES.indexOf(historyStage)
      : -1;
}

function orderStatusIndex(status?: string | null): number {
  switch (status?.toUpperCase()) {
    case 'PENDING':
      return TRACKING_STAGES.indexOf('PLACED');
    case 'CONFIRMED':
    case 'PREPARING':
    case 'PACKED':
    case 'READY_FOR_PICKUP':
      return TRACKING_STAGES.indexOf('CONFIRMED');
    case 'SHIPPED':
    case 'IN_TRANSIT':
    case 'PICKED_UP':
    case 'OUT_FOR_DELIVERY':
      return TRACKING_STAGES.indexOf('IN_TRANSIT');
    case 'DELIVERED':
      return TRACKING_STAGES.indexOf('DELIVERED');
    case 'COMPLETED':
      return TRACKING_STAGES.indexOf('COMPLETED');
    default:
      return -1;
  }
}

function deliveryStatusIndex(status?: DeliveryStatus | null): number {
  switch (status) {
    case 'ASSIGNED':
    case 'ACCEPTED':
    case 'EN_ROUTE_TO_PICKUP':
    case 'ARRIVED_AT_PICKUP':
      return TRACKING_STAGES.indexOf('CONFIRMED');
    case 'PICKED_UP':
    case 'IN_TRANSIT':
    case 'ARRIVED_AT_DESTINATION':
      return TRACKING_STAGES.indexOf('IN_TRANSIT');
    case 'DELIVERED':
      return TRACKING_STAGES.indexOf('DELIVERED');
    default:
      return -1;
  }
}