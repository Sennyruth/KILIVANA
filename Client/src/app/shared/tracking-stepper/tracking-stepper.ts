import { Component, input, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
  TrackingHistory,
  TrackingStage,
  TRACKING_STAGES as STAGE_ORDER,
  trackingProgressIndex,
} from '../tracking.model';
import type { DeliveryStatus } from '../order.model';

export const TRACKING_STAGES = STAGE_ORDER;

const STAGE_LABELS: Record<TrackingStage, string> = {
  PLACED: 'Placed',
  CONFIRMED: 'Confirmed',
  IN_TRANSIT: 'In Transit',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
};

@Component({
  selector: 'app-tracking-stepper',
  imports: [MatIconModule],
  styleUrl: './tracking-stepper.scss',
  templateUrl: './tracking-stepper.html',
})
export class TrackingStepper {
  readonly history = input<TrackingHistory | null>(null);
  readonly orderStatus = input<string | null>(null);
  readonly deliveryStatus = input<DeliveryStatus | null>(null);
  protected readonly stages = TRACKING_STAGES;

  protected readonly currentIndex = computed(() => {
    const h = this.history();
    return trackingProgressIndex(
      this.orderStatus(),
      this.deliveryStatus(),
      h?.currentStage ?? null,
    );
  });

  protected readonly progressPercent = computed(() => {
    const idx = this.currentIndex();
    if (idx < 0) return 0;
    return Math.round((idx / (STAGE_ORDER.length - 1)) * 100);
  });

  protected readonly currentLabel = computed(() => {
    return STAGE_LABELS[this.stages[this.currentIndex()]] ?? 'No tracking info';
  });

  protected readonly currentNote = computed(() => {
    const h = this.history();
    if (!h) return '';
    const stage = this.stages[this.currentIndex()];
    const ev = [...h.events].reverse().find((event) => event.stage === stage);
    return ev?.note ?? '';
  });

  protected readonly currentLocation = computed(() => {
    const h = this.history();
    if (!h) return '';
    const stage = this.stages[this.currentIndex()];
    const ev = [...h.events].reverse().find((event) => event.stage === stage);
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