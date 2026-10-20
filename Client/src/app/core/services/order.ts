import { Injectable, inject, computed, signal } from '@angular/core';
import { Observable, of, tap, catchError, finalize, map } from 'rxjs';

import { HttpService } from './http';
import { ApiEndpoints } from '../../shared/api.config';
import { Order as OrderModel, CreateOrderRequest, CreatedOrder, OrderStatus, SellerOrderSummary } from '../../shared/order.model';
import { ApiResponse } from '../../shared/api-response';
import { Auth } from './auth';

export interface Dispute {
  id: string;
  orderId: string;
  userId: string;
  reason: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
}

@Injectable({ providedIn: 'root' })
export class Order {
  private readonly http = inject(HttpService);
  private readonly auth = inject(Auth);

  private readonly _orders = signal<OrderModel[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly orders = this._orders.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  loadAll(): Observable<ApiResponse<{ orders: OrderModel[] }>> {
    this._loading.set(true);
    this._error.set(null);
    return this.http.get<{ orders: OrderModel[] }>(ApiEndpoints.ORDERS.LIST).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this._orders.set(extractOrders(res.data));
        }
        this._loading.set(false);
      }),
      catchError((err) => {
        this._error.set(err?.error?.message || 'Failed to load orders');
        this._loading.set(false);
        return of({ success: false, data: { orders: [] }, message: 'Failed to load orders' } as ApiResponse<{ orders: OrderModel[] }>);
      }),
    );
  }

  loadSellerOrders(): Observable<ApiResponse<SellerOrderSummary[]>> {
    return of({
      success: false,
      data: [],
      message: 'The backend does not currently provide an endpoint for listing orders by seller.',
    });
  }

  loadMine(buyerId?: string): Observable<ApiResponse<{ orders: OrderModel[] }>> {
    this._loading.set(true);
    this._error.set(null);
    const resolvedBuyerId = buyerId || this.auth.user()?.id;
    if (!resolvedBuyerId) {
      this._loading.set(false);
      const message = 'Sign in again to load your orders.';
      this._error.set(message);
      return of({ success: false, data: { orders: [] }, message });
    }
    return this.http.get<unknown>(ApiEndpoints.ORDERS.BUYER(String(resolvedBuyerId))).pipe(
      map((res) => ({
        ...res,
        data: { orders: res.success ? extractOrders(res.data) : [] },
      })),
      tap((res) => {
        if (res.success && res.data) this._orders.set(res.data.orders);
        this._loading.set(false);
      }),
      catchError((err) => {
        this._error.set(err?.error?.message || 'Failed to load orders');
        this._loading.set(false);
        return of({ success: false, data: { orders: [] }, message: 'Failed to load orders' } as ApiResponse<{ orders: OrderModel[] }>);
      }),
    );
  }

  getById(id: string): Observable<ApiResponse<{ order: OrderModel }>> {
    return this.http.get<unknown>(ApiEndpoints.ORDERS.DETAIL(id)).pipe(
      map((res) => {
        if (!res.success || !res.data) return { ...res, data: null } as unknown as ApiResponse<{ order: OrderModel }>;
        const raw = res.data as Record<string, unknown>;
        return { ...res, data: { order: normalizeOrder(raw['order'] ?? raw) } } as ApiResponse<{ order: OrderModel }>;
      }),
    );
  }

  create(payload: CreateOrderRequest): Observable<ApiResponse<CreatedOrder>> {
    this._loading.set(true);
    this._error.set(null);
    return this.http.post<CreatedOrder>(ApiEndpoints.ORDERS.CREATE, payload).pipe(
      finalize(() => this._loading.set(false)),
    );
  }

  cancel(id: string, reason?: string): Observable<ApiResponse<{ order: OrderModel }>> {
    this._loading.set(true);
    return this.http.post<{ order: OrderModel }>(ApiEndpoints.ORDERS.CANCEL(id), { reason }).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this._orders.set(
            this._orders().map((o) => (o.id === id ? res.data!.order : o)),
          );
        }
        this._loading.set(false);
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

  getTimeline(id: string): Observable<ApiResponse<any>> {
    return this.http.get<any>(ApiEndpoints.ORDERS.TIMELINE(id));
  }

  search(query: string): Observable<ApiResponse<{ orders: OrderModel[] }>> {
    this._loading.set(true);
    this._error.set(null);
    return this.http.get<{ orders: OrderModel[] }>(ApiEndpoints.ORDERS.SEARCH, { name: query }).pipe(
      tap((res) => {
        if (res.success && res.data) this._orders.set(extractOrders(res.data));
        this._loading.set(false);
      }),
      catchError((err) => {
        this._error.set(err?.error?.message || 'Failed to search orders');
        this._loading.set(false);
        return of({ success: false, data: { orders: [] }, message: 'Failed to search orders' });
      }),
    );
  }

  // Dispute methods
  createDispute(payload: { orderId: string; reason: string; description: string }): Observable<ApiResponse<{ dispute: Dispute }>> {
    this._loading.set(true);
    this._error.set(null);
    return this.http.post<{ dispute: Dispute }>(ApiEndpoints.DISPUTES.CREATE, payload).pipe(
      tap((res) => {
        this._loading.set(false);
      }),
      catchError((err) => {
        this._error.set(err?.error?.message || 'Failed to create dispute');
        this._loading.set(false);
        return of({ success: false, data: null as unknown as { dispute: Dispute }, message: 'Failed to create dispute' } as ApiResponse<{ dispute: Dispute }>);
      }),
    );
  }

  getDisputeById(id: string): Observable<ApiResponse<{ dispute: Dispute }>> {
    return this.http.get<{ dispute: Dispute }>(ApiEndpoints.DISPUTES.DETAIL(id));
  }

  getDisputesByUser(userId: string): Observable<ApiResponse<{ disputes: Dispute[] }>> {
    return this.http.get<{ disputes: Dispute[] }>(ApiEndpoints.DISPUTES.USER(userId));
  }

  getDisputesByOrder(orderId: string): Observable<ApiResponse<{ disputes: Dispute[] }>> {
    return this.http.get<{ disputes: Dispute[] }>(ApiEndpoints.DISPUTES.ORDER(orderId));
  }

  updateDisputeStatus(id: string, status: 'open' | 'in_progress' | 'resolved' | 'closed'): Observable<ApiResponse<{ dispute: Dispute }>> {
    return this.http.put<{ dispute: Dispute }>(ApiEndpoints.DISPUTES.UPDATE_STATUS(id), { status });
  }

  resolveDispute(id: string, resolution: string): Observable<ApiResponse<{ dispute: Dispute }>> {
    return this.http.put<{ dispute: Dispute }>(ApiEndpoints.DISPUTES.RESOLVE(id), { resolution });
  }
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY_FOR_PICKUP: 'Ready for pickup',
  PICKED_UP: 'Picked up',
  IN_TRANSIT: 'In transit',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: 'warn',
  CONFIRMED: 'accent',
  PREPARING: 'primary',
  READY_FOR_PICKUP: 'primary',
  PICKED_UP: 'primary',
  IN_TRANSIT: 'primary',
  PACKED: 'primary',
  SHIPPED: 'primary',
  OUT_FOR_DELIVERY: 'primary',
  DELIVERED: 'primary',
  COMPLETED: 'primary',
  CANCELLED: 'warn',
  FAILED: 'warn',
};

function extractOrders(data: unknown): OrderModel[] {
  if (Array.isArray(data)) return data.map(normalizeOrder);
  if (!data || typeof data !== 'object') return [];

  const response = data as { orders?: unknown; content?: unknown };
  if (Array.isArray(response.orders)) return response.orders.map(normalizeOrder);
  if (Array.isArray(response.content)) return response.content.map(normalizeOrder);
  return [];
}

function normalizeOrder(value: unknown): OrderModel {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid order returned by the API');
  }
  const order = value as Record<string, unknown>;
  if (
    (typeof order['id'] !== 'string' && typeof order['id'] !== 'number') ||
    (typeof order['buyerId'] !== 'string' && typeof order['buyerId'] !== 'number') ||
    typeof order['status'] !== 'string'
  ) {
    throw new Error('Invalid order returned by the API');
  }
  const items = Array.isArray(order['items']) ? order['items'] : [];
  const subtotal = Number(order['subtotal'] ?? 0);
  const deliveryFee = Number(order['deliveryFee'] ?? 0);
  const total = Number(order['total'] ?? subtotal + deliveryFee);
  if (![subtotal, deliveryFee, total].every(Number.isFinite)) {
    throw new Error('Invalid order totals returned by the API');
  }
  return {
    id: String(order['id']),
    buyerId: String(order['buyerId']),
    buyerName: typeof order['buyerName'] === 'string' ? order['buyerName'] : '',
    items: items.map(normalizeOrderItem),
    status: normalizeOrderStatus(order['status']),
    subtotal,
    deliveryFee,
    total,
    deliveryAddress: typeof order['deliveryAddress'] === 'string' ? order['deliveryAddress'] : '',
    phone: typeof order['buyerPhone'] === 'string' ? order['buyerPhone'] : typeof order['phone'] === 'string' ? order['phone'] : '',
    paymentMethod: normalizePaymentMethod(order['paymentMethod']),
    paymentStatus: normalizePaymentStatus(order['paymentStatus']),
    createdAt: String(order['createdAt'] ?? ''),
    updatedAt: String(order['updatedAt'] ?? ''),
    cancelledAt: typeof order['cancelledAt'] === 'string' ? order['cancelledAt'] : undefined,
    cancelReason: typeof order['cancellationReason'] === 'string' ? order['cancellationReason'] : undefined,
  };
}

function normalizeOrderItem(value: unknown): OrderModel['items'][number] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid order item returned by the API');
  }
  const item = value as Record<string, unknown>;
  if (
    (typeof item['id'] !== 'string' && typeof item['id'] !== 'number') ||
    (typeof item['productId'] !== 'string' && typeof item['productId'] !== 'number') ||
    !Number.isFinite(Number(item['unitPrice'] ?? item['price'])) ||
    !Number.isFinite(Number(item['quantity'])) ||
    !Number.isFinite(Number(item['subtotal'] ?? item['lineTotal'] ?? Number(item['unitPrice'] ?? item['price']) * Number(item['quantity'])))
  ) {
    throw new Error('Invalid order item returned by the API');
  }
  return {
    id: String(item['id']),
    productId: String(item['productId']),
    name: typeof item['productName'] === 'string' ? item['productName'] : typeof item['name'] === 'string' ? item['name'] : '',
    price: Number(item['unitPrice'] ?? item['price']),
    quantity: Number(item['quantity']),
    unit: typeof item['unit'] === 'string' ? item['unit'] : '',
    lineTotal: Number(item['subtotal'] ?? item['lineTotal'] ?? Number(item['unitPrice'] ?? item['price']) * Number(item['quantity'])),
  };
}

function normalizeOrderStatus(value: unknown): OrderStatus {
  const status = String(value).toUpperCase();
  const mapping: Record<string, OrderStatus> = { PLACED: 'PENDING', DISPUTED: 'FAILED' };
  return mapping[status] ?? (isOrderStatus(status) ? status : 'PENDING');
}

function normalizePaymentMethod(value: unknown): OrderModel['paymentMethod'] {
  const method = String(value ?? '').toUpperCase();
  return method === 'MPESA' || method === 'BANK' || method === 'CARD' ? method : null;
}

function normalizePaymentStatus(value: unknown): OrderModel['paymentStatus'] {
  const status = String(value ?? '').toUpperCase();
  if (status === 'HELD') return 'PROCESSING';
  if (status === 'PAID' || status === 'SETTLED') return 'COMPLETED';
  return isPaymentStatus(status) ? status : 'PENDING';
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && [
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    'READY_FOR_PICKUP',
    'PICKED_UP',
    'IN_TRANSIT',
    'PACKED',
    'SHIPPED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'COMPLETED',
    'CANCELLED',
    'FAILED',
  ].includes(value);
}

function isPaymentStatus(value: unknown): value is OrderModel['paymentStatus'] {
  return ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']
    .includes(value as string);
}
