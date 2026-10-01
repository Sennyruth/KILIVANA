import { Component, input, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TrackingHistory, TrackingStage, TRACKING_STAGES as STAGE_ORDER } from '../tracking.model';

export const TRACKING_STAGES = STAGE_ORDER;

const STAGE_LABELS: Record<TrackingStage, string> = {
  ORDER_PLACED: 'Order Placed',
  ORDER_CONFIRMED: 'Confirmed',
  PAYMENT_RECEIVED: 'Payment',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
};

@Component({
  selector: 'app-tracking-stepper',
  imports: [MatIconModule],
  styleUrl: './tracking-stepper.scss',
  templateUrl: './tracking-stepper.html',
})
export class TrackingStepper {
  readonly history = input<TrackingHistory | null>(null);
  protected readonly stages = TRACKING_STAGES;

  protected readonly currentIndex = computed(() => {
    const h = this.history();
    if (!h) return 0;
    return STAGE_ORDER.indexOf(h.currentStage);
  });

  protected readonly progressPercent = computed(() => {
    const idx = this.currentIndex();
    if (idx < 0) return 0;
    return Math.round((idx / (STAGE_ORDER.length - 1)) * 100);
  });

  protected readonly currentLabel = computed(() => {
    const h = this.history();
    if (!h) return 'No tracking info';
    return STAGE_LABELS[h.currentStage];
  });

  protected readonly currentNote = computed(() => {
    const h = this.history();
    if (!h) return '';
    const ev = h.events.find((e) => e.stage === h.currentStage);
    return ev?.note ?? '';
  });

  protected readonly currentLocation = computed(() => {
    const h = this.history();
    if (!h) return '';
    const ev = h.events.find((e) => e.stage === h.currentStage);
    return ev?.location ?? '';
  });

  protected stageLabel(stage: TrackingStage): string {
    return STAGE_LABELS[stage];
  }

  protected stageTime(stage: TrackingStage): string {
    const h = this.history();
    if (!h) return '';
    const ev = h.events.find((e) => e.stage === stage);
    if (!ev) return '';
    try {
      return new Date(ev.timestamp).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }
}