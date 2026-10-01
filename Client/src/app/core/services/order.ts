import { Service, inject, computed } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';

import { HttpService } from './http';
import { ApiEndpoints } from '../../shared/api.config';
import { Order as OrderModel, CreateOrderRequest, OrderStatus } from '../../shared/order.model';
import { ApiResponse } from '../../shared/api-response';

@Service()
export class Order {
  private readonly http = inject(HttpService);

  private readonly _orders = new BehaviorSubject<OrderModel[]>([]);
  private readonly _loading = new BehaviorSubject<boolean>(false);
  private readonly _error = new BehaviorSubject<string | null>(null);

  readonly orders$ = this._orders.asObservable();
  readonly loading$ = this._loading.asObservable();
  readonly error$ = this._error.asObservable();

  readonly orders = computed(() => this._orders.value);
  readonly loading = computed(() => this._loading.value);
  readonly error = computed(() => this._error.value);

  loadAll(): Observable<ApiResponse<{ orders: OrderModel[] }>> {
    this._loading.next(true);
    this._error.next(null);
    return this.http.get<{ orders: OrderModel[] }>(ApiEndpoints.ORDERS.LIST).pipe(
      tap((res) => {
        if (res.success && res.data) this._orders.next(res.data.orders);
        this._loading.next(false);
      }),
      catchError((err) => {
        this._error.next(err?.error?.message || 'Failed to load orders');
        this._loading.next(false);
        return of({ success: false, data: { orders: [] }, message: 'Failed to load orders' });
      }),
    );
  }

  loadMine(): Observable<ApiResponse<{ orders: OrderModel[] }>> {
    this._loading.next(true);
    this._error.next(null);
    return this.http.get<{ orders: OrderModel[] }>('/orders/mine').pipe(
      tap((res) => {
        if (res.success && res.data) this._orders.next(res.data.orders);
        this._loading.next(false);
      }),
      catchError((err) => {
        this._error.next(err?.error?.message || 'Failed to load orders');
        this._loading.next(false);
        return of({ success: false, data: { orders: [] }, message: 'Failed to load orders' });
      }),
    );
  }

  getById(id: string): Observable<ApiResponse<{ order: OrderModel }>> {
    return this.http.get<{ order: OrderModel }>(ApiEndpoints.ORDERS.DETAIL(id));
  }

  create(payload: CreateOrderRequest): Observable<ApiResponse<{ order: OrderModel }>> {
    this._loading.next(true);
    this._error.next(null);
    return this.http.post<{ order: OrderModel }>(ApiEndpoints.ORDERS.CREATE, payload).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this._orders.next([res.data.order, ...this._orders.value]);
        }
        this._loading.next(false);
      }),
      map((res) => res as ApiResponse<{ order: OrderModel }>),
    );
  }

  cancel(id: string, reason?: string): Observable<ApiResponse<{ order: OrderModel }>> {
    this._loading.next(true);
    return this.http.post<{ order: OrderModel }>(ApiEndpoints.ORDERS.CANCEL(id), { reason }).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this._orders.next(
            this._orders.value.map((o) => (o.id === id ? res.data!.order : o)),
          );
        }
        this._loading.next(false);
      }),
    );
  }

  canCancel(order: OrderModel): boolean {
    return !['PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].includes(order.status);
  }

  statusLabel(s: OrderStatus): string {
    return STATUS_LABELS[s];
  }

  statusColor(s: OrderStatus): string {
    return STATUS_COLORS[s] ?? 'accent';
  }
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: 'warn',
  CONFIRMED: 'accent',
  PACKED: 'primary',
  SHIPPED: 'primary',
  OUT_FOR_DELIVERY: 'primary',
  DELIVERED: 'primary',
  CANCELLED: 'warn',
};