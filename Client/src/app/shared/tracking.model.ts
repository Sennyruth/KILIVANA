export type TrackingStage =
  | 'ORDER_PLACED'
  | 'ORDER_CONFIRMED'
  | 'PAYMENT_RECEIVED'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED';

export interface TrackingEvent {
  id: string;
  stage: TrackingStage;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';
  timestamp: string;
  note?: string;
  location?: string;
}

export interface TrackingHistory {
  orderId: string;
  currentStage: TrackingStage;
  events: TrackingEvent[];
}

export const TRACKING_STAGES: TrackingStage[] = [
  'ORDER_PLACED',
  'ORDER_CONFIRMED',
  'PAYMENT_RECEIVED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];