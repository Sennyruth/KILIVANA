import { Injectable, inject, computed, signal } from '@angular/core';
import { Observable, finalize, map, tap } from 'rxjs';

import { HttpService } from './http';
import { ApiEndpoints } from '../../shared/api.config';
import {
  MpesaInitiateRequest,
  MpesaInitiateResponse,
  MpesaSellerType,
  PaymentStatusResponse,
  PaymentStatus,
} from '../../shared/payment.model';
import { ApiResponse } from '../../shared/api-response';

@Injectable({ providedIn: 'root' })
export class Payment {
  private readonly http = inject(HttpService);

  private readonly _status = signal<PaymentStatus | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly status = this._status.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  initiateMpesa(sellerType: MpesaSellerType, payload: MpesaInitiateRequest): Observable<ApiResponse<MpesaInitiateResponse>> {
    this._loading.set(true);
    this._error.set(null);
    return this.http.post<MpesaInitiateResponse>(ApiEndpoints.PAYMENT.STK_PUSH(sellerType), payload).pipe(
      tap({
        next: (res) => {
          if (res.success && res.data) {
            this._status.set({
              orderId: String(payload.orderId),
              paymentStatus: 'PENDING',
            });
          }
          this._loading.set(false);
        },
        error: (err) => {
          this._error.set(err?.error?.message || 'Payment initiation failed');
          this._loading.set(false);
        },
      }),
    );
  }

  getStatus(paymentId: string | number): Observable<ApiResponse<PaymentStatus>> {
    this._loading.set(true);
    return this.http.get<PaymentStatusResponse>(ApiEndpoints.PAYMENT.STATUS(String(paymentId))).pipe(
      map((res) => ({
        ...res,
        data: res.data ? this.toPaymentStatus(res.data) : null,
      } as ApiResponse<PaymentStatus>)),
      tap((res) => {
        if (res.success && res.data) this._status.set(res.data);
      }),
      finalize(() => this._loading.set(false)),
    );
  }

  getPaymentsByOrder(orderId: string): Observable<ApiResponse<any[]>> {
    this._loading.set(true);
    return this.http.get<any[]>(ApiEndpoints.PAYMENT.BY_ORDER(orderId)).pipe(
      tap((res) => {
        this._loading.set(false);
      }),
    );
  }

  refundPayment(paymentId: string, reason?: string): Observable<ApiResponse<any>> {
    this._loading.set(true);
    return this.http.post<any>(ApiEndpoints.PAYMENT.REFUND(paymentId), { reason }).pipe(
      tap((res) => {
        this._loading.set(false);
      }),
    );
  }

  pollStatus(paymentId: string | number, intervalMs = 5000, maxAttempts = 12): Observable<PaymentStatus> {
    return new Observable<PaymentStatus>((subscriber) => {
      let attempts = 0;
      const timer = setInterval(() => {
        this.getStatus(paymentId).subscribe({
          next: (res) => {
            if (res.success && res.data) {
              this._status.set(res.data);
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

  private toPaymentStatus(response: PaymentStatusResponse): PaymentStatus {
    const rawStatus = response.status.toUpperCase();
    const paymentStatus: PaymentStatus['paymentStatus'] =
      ['PENDING', 'PAID', 'HELD', 'SETTLED', 'FAILED', 'REFUNDED'].includes(rawStatus)
        ? rawStatus as PaymentStatus['paymentStatus']
        : 'PENDING';
    return {
      orderId: String(response.orderId),
      paymentStatus,
      mpesaReceipt: response.mpesaReceiptNumber ?? undefined,
      transactionId: response.reference ?? undefined,
      completedAt: response.paidAt ?? undefined,
    };
  }
}
