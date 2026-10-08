import { Injectable, inject, computed, signal } from '@angular/core';
import { Observable, finalize, tap } from 'rxjs';

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

  load(orderId: string): Observable<ApiResponse<TrackingHistory>> {
    this._loading.set(true);
    return this.http.get<TrackingHistory>(ApiEndpoints.TRACKING.HISTORY(orderId)).pipe(
      tap((res) => {
        if (res.success && res.data) this._history.set(res.data);
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