import { Service, inject, computed } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { HttpService } from './http';
import { ApiEndpoints } from '../../shared/api.config';
import { Cart as CartModel, CartItem } from '../../shared/cart.model';
import { ApiResponse } from '../../shared/api-response';

@Service()
export class Cart {
  private readonly http = inject(HttpService);

  private readonly _cart = new BehaviorSubject<CartModel | null>(null);
  private readonly _loading = new BehaviorSubject<boolean>(false);

  readonly cart$ = this._cart.asObservable();
  readonly loading$ = this._loading.asObservable();

  readonly cart = computed(() => this._cart.value);
  readonly loading = computed(() => this._loading.value);
  readonly itemCount = computed(() => this._cart.value?.totalItems ?? 0);
  readonly totalPrice = computed(() => this._cart.value?.totalPrice ?? 0);
  readonly items = computed(() => this._cart.value?.items ?? []);

  load(): Observable<ApiResponse<CartModel>> {
    this._loading.next(true);
    return this.http.get<CartModel>(ApiEndpoints.CART.GET).pipe(
      tap((res) => {
        if (res.success && res.data) this._cart.next(res.data);
        this._loading.next(false);
      }),
    );
  }

  addItem(
    productId: string,
    quantity: number,
  ): Observable<ApiResponse<CartModel>> {
    this._loading.next(true);
    return this.http.post<CartModel>(ApiEndpoints.CART.ADD, { productId, quantity }).pipe(
      tap((res) => {
        if (res.success && res.data) this._cart.next(res.data);
        this._loading.next(false);
      }),
    );
  }

  updateItem(itemId: string, quantity: number): Observable<ApiResponse<CartModel>> {
    this._loading.next(true);
    return this.http.patch<CartModel>(ApiEndpoints.CART.UPDATE(itemId), { quantity }).pipe(
      tap((res) => {
        if (res.success && res.data) this._cart.next(res.data);
        this._loading.next(false);
      }),
    );
  }

  removeItem(itemId: string): Observable<ApiResponse<CartModel>> {
    this._loading.next(true);
    return this.http.delete<CartModel>(ApiEndpoints.CART.REMOVE(itemId)).pipe(
      tap((res) => {
        if (res.success && res.data) this._cart.next(res.data);
        this._loading.next(false);
      }),
    );
  }

  clear(): Observable<ApiResponse<CartModel>> {
    this._loading.next(true);
    return this.http.delete<CartModel>(ApiEndpoints.CART.CLEAR).pipe(
      tap((res) => {
        if (res.success && res.data) this._cart.next(res.data);
        this._loading.next(false);
      }),
    );
  }

  addLocal(product: Omit<CartItem, 'id' | 'lineTotal'>): void {
    const current = this._cart.value;
    if (!current) return;
    const existing = current.items.find((i) => i.productId === product.productId);
    const items = existing
      ? current.items.map((i) =>
          i.productId === product.productId
            ? { ...i, quantity: i.quantity + product.quantity, lineTotal: i.price * (i.quantity + product.quantity) }
            : i,
        )
      : [
          ...current.items,
          {
            id: 'local-' + Math.random().toString(36).slice(2),
            lineTotal: product.price * product.quantity,
            ...product,
          },
        ];
    this._cart.next({
      ...current,
      items,
      totalItems: items.reduce((s, i) => s + i.quantity, 0),
      totalPrice: items.reduce((s, i) => s + i.lineTotal, 0),
    });
  }

  removeLocal(productId: string): void {
    const current = this._cart.value;
    if (!current) return;
    const items = current.items.filter((i) => i.productId !== productId);
    this._cart.next({
      ...current,
      items,
      totalItems: items.reduce((s, i) => s + i.quantity, 0),
      totalPrice: items.reduce((s, i) => s + i.lineTotal, 0),
    });
  }
}