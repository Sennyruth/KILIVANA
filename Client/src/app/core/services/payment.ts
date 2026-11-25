import { Injectable, inject, computed, signal } from '@angular/core';
import {
  Observable,
  catchError,
  exhaustMap,
  finalize,
  filter,
  interval,
  map,
  of,
  retry,
  startWith,
  switchMap,
  takeUntil,
  takeWhile,
  tap,
  throwError,
  timer,
} from 'rxjs';

import { HttpService } from './http';
import { ApiEndpoints } from '../../shared/api.config';
import {
  MpesaInitiateRequest,
  MpesaInitiateResponse,
  MpesaSellerType,
  PaymentStatusResponse,
  PaymentStatus,
  normalizePaymentStatus,
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

  getLatestPaymentByOrder(orderId: string | number): Observable<ApiResponse<PaymentStatus>> {
    return this.http.get<PaymentStatusResponse>(ApiEndpoints.PAYMENT.LATEST_BY_ORDER(orderId)).pipe(
      map((res) => ({
        ...res,
        data: res.data ? this.toPaymentStatus(res.data) : null,
      } as ApiResponse<PaymentStatus>)),
    );
  }

  getPaymentsBySeller(sellerId: string | number): Observable<ApiResponse<PaymentStatusResponse[]>> {
    return this.http.get<PaymentStatusResponse[]>(ApiEndpoints.PAYMENT.BY_SELLER(sellerId));
  }

  refundPayment(paymentId: string, reason?: string): Observable<ApiResponse<any>> {
    this._loading.set(true);
    return this.http.post<any>(ApiEndpoints.PAYMENT.REFUND(paymentId), { reason }).pipe(
      tap((res) => {
        this._loading.set(false);
      }),
    );
  }

  pollOrderStatus(orderId: string | number, intervalMs = 3000, timeoutMs = 120_000): Observable<PaymentStatus> {
    const polling = interval(intervalMs).pipe(
      startWith(0),
      switchMap(() => this.getLatestPaymentByOrder(orderId).pipe(catchError(() => of(null)))),
      filter((response): response is ApiResponse<PaymentStatus> => !!response?.success && !!response.data),
      map((response) => response.data!),
      tap((status) => this._status.set(status)),
      takeWhile((status) => status.paymentStatus === 'PENDING', true),
    );
    const deadline = timer(timeoutMs).pipe(
      switchMap(() => throwError(() => new Error('Payment confirmation timed out'))),
    );
    return polling.pipe(takeUntil(deadline));
  }

  pollPaymentStatus(paymentId: string | number, intervalMs = 3000, timeoutMs = 120_000): Observable<PaymentStatus> {
    let paidWithoutOrderPolls = 0;
    const polling = interval(intervalMs).pipe(
      startWith(0),
      exhaustMap(() => this.getStatus(paymentId).pipe(
        retry({
          count: 2,
          delay: (error: { status?: number }, retryAttempt) => {
            const status = error?.status ?? 0;
            if (status !== 0 && status < 500) return throwError(() => error);
            return timer(Math.min(1000 * (2 ** (retryAttempt - 1)), 3000));
          },
        }),
        tap((response) => {
          const status = response.data?.paymentStatus;
          const successfulWithoutOrder = ['PAID', 'HELD', 'SETTLED'].includes(status ?? '')
            && !response.data?.orderId;
          paidWithoutOrderPolls = successfulWithoutOrder ? paidWithoutOrderPolls + 1 : 0;
          // Allow the initial paid response plus two 3-second follow-up polls
          // for the backend to attach the newly created order.
          if (paidWithoutOrderPolls > 2) {
            throw new Error('PAYMENT_CONFIRMED_WITHOUT_ORDER_ID');
          }
        }),
      )),
      filter((response): response is ApiResponse<PaymentStatus> => !!response?.success && !!response.data),
      map((response) => response.data!),
      tap((status) => this._status.set(status)),
      takeWhile((status) => status.paymentStatus === 'PENDING'
        || (['PAID', 'HELD', 'SETTLED'].includes(status.paymentStatus) && !status.orderId), true),
    );
    const deadline = timer(timeoutMs).pipe(
      switchMap(() => throwError(() => new Error('PAYMENT_POLL_SAFETY_TIMEOUT'))),
    );
    return polling.pipe(takeUntil(deadline));
  }

  private toPaymentStatus(response: PaymentStatusResponse): PaymentStatus {
    const resultCode = response.darajaResultCode == null ? Number.NaN : Number(response.darajaResultCode);
    const resultDescription = String(response.darajaResultDesc ?? '').toLowerCase();
    const responseStatus = String(response.status ?? (response as PaymentStatusResponse & { paymentStatus?: string }).paymentStatus ?? 'UNKNOWN').toUpperCase();
    const terminalResponseStatus = ['PAID', 'HELD', 'SETTLED', 'CANCELLED', 'FAILED', 'REFUNDED'].includes(responseStatus);
    // Daraja reports a user-dismissed STK prompt with result code 1032. Some
    // backend responses retain a generic status, so use the callback outcome
    // to ensure polling can leave the pending state and show the cancellation.
    const wasCancelled = resultCode === 1032 || /cancel(?:led|ed)?|dismissed/.test(resultDescription);
    const rawStatus = terminalResponseStatus
      ? responseStatus
      : resultCode === 0
        ? 'PAID'
        : wasCancelled
          ? 'CANCELLED'
          : Number.isFinite(resultCode)
            ? 'FAILED'
            : responseStatus;
    return {
      orderId: response.orderId == null ? null : String(response.orderId),
      paymentStatus: normalizePaymentStatus(rawStatus),
      paymentId: response.paymentId ?? response.id,
      amount: response.amount,
      merchantRequestId: response.merchantRequestId ?? response.darajaResponse?.merchantRequestID ?? undefined,
      checkoutRequestId: response.checkoutRequestId ?? response.darajaResponse?.checkoutRequestID ?? undefined,
      phoneNumber: response.phoneNumber ?? undefined,
      callbackStatus: response.callbackStatus ?? undefined,
      darajaResultCode: Number.isFinite(resultCode) ? resultCode : undefined,
      darajaResultDesc: response.darajaResultDesc ?? undefined,
      mpesaReceipt: response.mpesaReceiptNumber ?? undefined,
      transactionId: response.reference ?? undefined,
      completedAt: response.transactionDate ?? response.paidAt ?? undefined,
      paidAt: response.paidAt ?? response.transactionDate ?? undefined,
    };
  }
}
