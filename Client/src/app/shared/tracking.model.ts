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