import { Service, inject, computed } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { HttpService } from './http';
import { ApiEndpoints } from '../../shared/api.config';
import { TrackingHistory, TrackingStage } from '../../shared/tracking.model';
import { ApiResponse } from '../../shared/api-response';

export const STAGE_ORDER: TrackingStage[] = [
  'ORDER_PLACED',
  'ORDER_CONFIRMED',
  'PAYMENT_RECEIVED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

@Service()
export class Tracking {
  private readonly http = inject(HttpService);

  private readonly _history = new BehaviorSubject<TrackingHistory | null>(null);
  private readonly _loading = new BehaviorSubject<boolean>(false);

  readonly history$ = this._history.asObservable();
  readonly loading$ = this._loading.asObservable();

  readonly history = computed(() => this._history.value);
  readonly loading = computed(() => this._loading.value);

  load(orderId: string): Observable<ApiResponse<TrackingHistory>> {
    this._loading.next(true);
    return this.http.get<TrackingHistory>(ApiEndpoints.TRACKING.HISTORY(orderId)).pipe(
      tap((res) => {
        if (res.success && res.data) this._history.next(res.data);
        this._loading.next(false);
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

const STAGE_LABELS: Record<TrackingStage, string> = {
  ORDER_PLACED: 'Order Placed',
  ORDER_CONFIRMED: 'Confirmed',
  PAYMENT_RECEIVED: 'Payment Received',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
};