import { Service, inject, computed } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { HttpService } from './http';
import { ApiEndpoints } from '../../shared/api.config';
import {
  MpesaInitiateRequest,
  MpesaInitiateResponse,
  PaymentStatus,
} from '../../shared/payment.model';
import { ApiResponse } from '../../shared/api-response';

@Service()
export class Payment {
  private readonly http = inject(HttpService);

  private readonly _status = new BehaviorSubject<PaymentStatus | null>(null);
  private readonly _loading = new BehaviorSubject<boolean>(false);
  private readonly _error = new BehaviorSubject<string | null>(null);

  readonly status$ = this._status.asObservable();
  readonly loading$ = this._loading.asObservable();
  readonly error$ = this._error.asObservable();

  readonly status = computed(() => this._status.value);
  readonly loading = computed(() => this._loading.value);
  readonly error = computed(() => this._error.value);

  initiateMpesa(payload: MpesaInitiateRequest): Observable<ApiResponse<MpesaInitiateResponse>> {
    this._loading.next(true);
    this._error.next(null);
    return this.http.post<MpesaInitiateResponse>(ApiEndpoints.PAYMENT.MPESA, payload).pipe(
      map((res) => res as ApiResponse<MpesaInitiateResponse>),
      tap({
        next: (res) => {
          if (res.success && res.data) {
            this._status.next({
              orderId: payload.orderId,
              paymentStatus: 'PENDING',
            });
          }
          this._loading.next(false);
        },
        error: (err) => {
          this._error.next(err?.error?.message || 'Payment initiation failed');
          this._loading.next(false);
        },
      }),
    );
  }

  getStatus(orderId: string): Observable<ApiResponse<PaymentStatus>> {
    this._loading.next(true);
    return this.http.get<PaymentStatus>(ApiEndpoints.PAYMENT.STATUS(orderId)).pipe(
      tap((res) => {
        if (res.success && res.data) this._status.next(res.data);
        this._loading.next(false);
      }),
    );
  }

  pollStatus(orderId: string, intervalMs = 5000, maxAttempts = 12): Observable<PaymentStatus> {
    return new Observable<PaymentStatus>((subscriber) => {
      let attempts = 0;
      const timer = setInterval(() => {
        this.getStatus(orderId).subscribe({
          next: (res) => {
            if (res.success && res.data) {
              this._status.next(res.data);
              if (res.data.paymentStatus !== 'PENDING') {
                clearInterval(timer);
                subscriber.next(res.data);
                subscriber.complete();
              }
            }
          },
          error: (err) => {
            subscriber.error(err);
          },
        });
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(timer);
          subscriber.complete();
        }
      }, intervalMs);
      return () => clearInterval(timer);
    });
  }
}