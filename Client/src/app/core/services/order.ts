import { Injectable, inject, computed, signal } from '@angular/core';
import { Observable, of, tap, catchError, finalize } from 'rxjs';

import { HttpService } from './http';
import { ApiEndpoints } from '../../shared/api.config';
import { Order as OrderModel, CreateOrderRequest, CreatedOrder, OrderStatus, SellerOrderSummary } from '../../shared/order.model';
import { ApiResponse } from '../../shared/api-response';

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
    return this.http.get<SellerOrderSummary[]>(ApiEndpoints.ORDERS.SELLER_MINE);
  }

  loadMine(buyerId?: string): Observable<ApiResponse<{ orders: OrderModel[] }>> {
    this._loading.set(true);
    this._error.set(null);
    const url = buyerId ? ApiEndpoints.ORDERS.BUYER(buyerId) : ApiEndpoints.ORDERS.MINE;
    return this.http.get<{ orders: OrderModel[] }>(url).pipe(
      tap((res) => {
        if (res.success && res.data) this._orders.set(extractOrders(res.data));
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
    return this.http.get<{ order: OrderModel }>(ApiEndpoints.ORDERS.DETAIL(id));
  }

  create(payload: CreateOrderRequest): Observable<ApiResponse<CreatedOrder>> {
    this._loading.set(true);
    this._error.set(null);
    return this.http.post<CreatedOrder>(ApiEndpoints.ORDERS.CHECKOUT, payload).pipe(
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

  confirmReceipt(id: string): Observable<ApiResponse<{ order: OrderModel }>> {
    this._loading.set(true);
    return this.http.post<{ order: OrderModel }>(ApiEndpoints.ORDERS.CONFIRM_RECEIPT(id), {}).pipe(
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

  search(query: string): Observable<ApiResponse<{ orders: OrderModel[] }>> {
    this._loading.set(true);
    this._error.set(null);
    return this.http.get<{ orders: OrderModel[] }>(ApiEndpoints.ORDERS.SEARCH, { search: query }).pipe(
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
    !isOrderStatus(order['status'])
  ) {
    throw new Error('Invalid order returned by the API');
  }
  const items = Array.isArray(order['items']) ? order['items'] : [];
  const subtotal = Number(order['subtotal']);
  const deliveryFee = Number(order['deliveryFee']);
  const total = Number(order['total']);
  if (![subtotal, deliveryFee, total].every(Number.isFinite)) {
    throw new Error('Invalid order totals returned by the API');
  }
  return {
    id: String(order['id']),
    buyerId: String(order['buyerId']),
    buyerName: typeof order['buyerName'] === 'string' ? order['buyerName'] : '',
    items: items.map(normalizeOrderItem),
    status: order['status'],
    subtotal,
    deliveryFee,
    total,
    deliveryAddress: typeof order['deliveryAddress'] === 'string' ? order['deliveryAddress'] : '',
    phone: typeof order['phone'] === 'string' ? order['phone'] : '',
    paymentMethod: isPaymentMethod(order['paymentMethod']) ? order['paymentMethod'] : null,
    paymentStatus: isPaymentStatus(order['paymentStatus']) ? order['paymentStatus'] : 'PENDING',
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
    !Number.isFinite(Number(item['price'])) ||
    !Number.isFinite(Number(item['quantity'])) ||
    !Number.isFinite(Number(item['lineTotal']))
  ) {
    throw new Error('Invalid order item returned by the API');
  }
  return {
    id: String(item['id']),
    productId: String(item['productId']),
    name: typeof item['name'] === 'string' ? item['name'] : '',
    price: Number(item['price']),
    quantity: Number(item['quantity']),
    unit: typeof item['unit'] === 'string' ? item['unit'] : '',
    lineTotal: Number(item['lineTotal']),
  };
}

function isPaymentMethod(value: unknown): value is NonNullable<OrderModel['paymentMethod']> {
  return value === 'MPESA' || value === 'CARD' || value === 'CASH';
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