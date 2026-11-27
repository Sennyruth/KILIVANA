import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, throwError, toArray } from 'rxjs';
import { ApiEndpoints } from '../../shared/api.config';
import { HttpService } from './http';
import { Auth } from './auth';

export interface WalletSellerOrderItem {
  sellerId: number | null;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
}

export interface WalletSellerOrder {
  id: number;
  code: string;
  status: string;
  paymentStatus: string;
  deliveryStatus: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  createdAt: string;
  items: WalletSellerOrderItem[];
}

interface OrderPage {
  orders: WalletSellerOrder[];
  page: number;
  totalPages: number;
  size: number;
}

@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly http = inject(HttpService);
  private readonly auth = inject(Auth);
  private readonly pageSize = 100;

  loadSellerOrders(): Observable<WalletSellerOrder[]> {
    const user = this.auth.user();
    const sellerId = user?.id;
    if (!sellerId || (user.role !== 'FARMER' && user.role !== 'SUPPLIER')) {
      return throwError(() => new Error('Sign in with a farmer or supplier account to view wallet earnings.'));
    }

    const endpoint = user.role === 'FARMER'
      ? ApiEndpoints.ORDERS.FARMER_WALLET(sellerId)
      : ApiEndpoints.ORDERS.SUPPLIER_WALLET(sellerId);
    const loadPage = (page: number) => this.http.get<unknown>(endpoint, { page, size: this.pageSize }).pipe(
      map((response) => {
        if (!response.success) {
          throw new Error(response.message || 'The backend could not load seller orders.');
        }
        const parsed = parsePage(response.data, page, this.pageSize);
        return { ...parsed, orders: parsed.orders.map((order) => ({
          ...order,
          items: order.items.filter((item) => item.sellerId === Number(sellerId)),
        })).filter((order) => order.items.length > 0) };
      }),
    );

    return loadPage(0).pipe(
      expand((page) => page.page + 1 < page.totalPages ? loadPage(page.page + 1) : EMPTY),
      toArray(),
      map((pages) => pages.flatMap((page) => page.orders)),
    );
  }
}

function parsePage(value: unknown, fallbackPage: number, fallbackSize: number): OrderPage {
  if (Array.isArray(value)) {
    return { orders: value.map(normalizeOrder).filter(isWalletOrder), page: fallbackPage, totalPages: 1, size: fallbackSize };
  }
  if (!value || typeof value !== 'object') {
    return { orders: [], page: fallbackPage, totalPages: 1, size: fallbackSize };
  }

  const page = value as Record<string, unknown>;
  const content = Array.isArray(page['content']) ? page['content'] : Array.isArray(page['orders']) ? page['orders'] : [];
  const currentPage = numeric(page['number']) ?? numeric(page['page']) ?? fallbackPage;
  const size = numeric(page['size']) ?? fallbackSize;
  const totalElements = numeric(page['totalElements']);
  const totalPages = numeric(page['totalPages']) ?? (totalElements === null ? 1 : Math.ceil(totalElements / Math.max(size, 1)));
  return {
    orders: content.map(normalizeOrder).filter(isWalletOrder),
    page: currentPage,
    totalPages: Math.max(totalPages, 1),
    size,
  };
}

function normalizeOrder(value: unknown): WalletSellerOrder | null {
  if (!value || typeof value !== 'object') return null;
  const order = value as Record<string, unknown>;
  const id = numeric(order['id']);
  if (id === null || id <= 0) return null;
  const items = Array.isArray(order['items']) ? order['items'].map(normalizeItem).filter(isWalletItem) : [];
  return {
    id,
    code: stringValue(order['code']) || `ORD-${id}`,
    status: stringValue(order['status']).toUpperCase() || 'PENDING',
    paymentStatus: stringValue(order['paymentStatus']).toUpperCase() || 'PENDING',
    deliveryStatus: nullableString(order['deliveryStatus'])?.toUpperCase() ?? null,
    paymentReference: nullableString(order['paymentReference']),
    paidAt: nullableString(order['paidAt']),
    createdAt: stringValue(order['createdAt']),
    items,
  };
}

function normalizeItem(value: unknown): WalletSellerOrderItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const subtotal = numeric(item['subtotal'] ?? item['lineTotal']);
  if (subtotal === null) return null;
  return {
    sellerId: numeric(item['sellerId']),
    productName: stringValue(item['productName'] ?? item['name']) || 'Order item',
    quantity: numeric(item['quantity']) ?? 0,
    unit: stringValue(item['unit']),
    unitPrice: numeric(item['unitPrice'] ?? item['price']) ?? 0,
    subtotal,
  };
}

function isWalletOrder(value: WalletSellerOrder | null): value is WalletSellerOrder {
  return value !== null;
}

function isWalletItem(value: WalletSellerOrderItem | null): value is WalletSellerOrderItem {
  return value !== null;
}

function numeric(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
