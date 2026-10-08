import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, concatMap, from, map, of, switchMap, throwError, toArray } from 'rxjs';

import { HttpService } from './http';
import { ApiEndpoints } from '../../shared/api.config';
import { Cart as CartModel, CartItem } from '../../shared/cart.model';
import { ApiResponse } from '../../shared/api-response';
import { Product } from '../../shared/product.model';
import { Auth } from './auth';

const CART_STORAGE_KEY = 'kilivana_mock_cart';

@Injectable({ providedIn: 'root' })
export class Cart {
  private readonly auth = inject(Auth);
  private readonly http = inject(HttpService);
  private readonly _cart = signal<CartModel | null>(this.loadSavedCart());

  readonly cart = this._cart.asReadonly();
  readonly loading = signal(false).asReadonly();
  readonly itemCount = computed(() => this._cart()?.totalItems ?? 0);
  readonly totalPrice = computed(() => this._cart()?.totalPrice ?? 0);
  readonly items = computed(() => this._cart()?.items ?? []);

  load(): Observable<ApiResponse<CartModel>> {
    const cart = this.loadSavedCart() ?? this.emptyCart();
    this._cart.set(cart);
    return of(this.response(cart, 'Cart loaded'));
  }

  addItem(product: Product, quantity: number): Observable<ApiResponse<CartModel>> {
    const current = this.currentCart();
    if (!product.available || product.quantity < quantity || quantity < 1) {
      return of(this.response(current, 'This product is unavailable or has insufficient stock.', false));
    }

    const itemId = `mock-${product.id}`;
    const existing = current.items.find((item) => item.productId === product.id);
    const nextQuantity = (existing?.quantity ?? 0) + quantity;
    if (nextQuantity > product.quantity) {
      return of(this.response(current, 'The requested quantity exceeds available stock.', false));
    }

    const image = product.images.find((candidate) => candidate.isPrimary) ?? product.images[0];
    const item: CartItem = {
      id: itemId,
      productId: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit,
      quantity: nextQuantity,
      imageUrl: image?.url ?? '',
      sellerName: product.farmerName,
      lineTotal: product.price * nextQuantity,
    };
    const items = existing
      ? current.items.map((cartItem) => cartItem.productId === product.id ? item : cartItem)
      : [...current.items, item];

    const cart = this.withItems(current, items);
    this.saveCart(cart);
    return of(this.response(cart, 'Added to cart'));
  }

  updateItem(itemId: string, quantity: number): Observable<ApiResponse<CartModel>> {
    const current = this.currentCart();
    if (quantity < 1 || !current.items.some((item) => String(item.id) === itemId)) {
      return of(this.response(current, 'Invalid cart item or quantity.', false));
    }

    const items = current.items.map((item) =>
      String(item.id) === itemId
        ? { ...item, quantity, lineTotal: item.price * quantity }
        : item,
    );
    const cart = this.withItems(current, items);
    this.saveCart(cart);
    return of(this.response(cart, 'Cart updated'));
  }

  removeItem(itemId: string): Observable<ApiResponse<void>> {
    const current = this.currentCart();
    const cart = this.withItems(
      current,
      current.items.filter((item) => String(item.id) !== itemId),
    );
    this.saveCart(cart);
    return of({ success: true, message: 'Item removed from cart', data: undefined });
  }

  clear(): Observable<ApiResponse<void>> {
    this.resetAfterCheckout();
    return of({ success: true, message: 'Cart cleared', data: undefined });
  }

  syncMockCartForCheckout(): Observable<void> {
    const items = this.currentCart().items;
    return this.http.delete<void>(ApiEndpoints.CART.CLEAR).pipe(
      switchMap((response) => {
        if (!response.success) {
          return throwError(() => new Error(response.message || 'Could not prepare cart for checkout.'));
        }
        return from(items).pipe(
          concatMap((item) =>
            this.http.post<CartModel>(ApiEndpoints.CART.ADD, {
              productId: Number(item.productId),
              quantity: item.quantity,
            }).pipe(
              switchMap((addResponse) =>
                addResponse.success
                  ? of(undefined)
                  : throwError(() => new Error(addResponse.message || `Could not add ${item.name} for checkout.`)),
              ),
            ),
          ),
          toArray(),
          map(() => undefined),
        );
      }),
    );
  }

  resetAfterCheckout(): void {
    this._cart.set(null);
    localStorage.removeItem(this.storageKey());
  }

  resetAfterLogout(): void {
    this._cart.set(null);
  }

  private currentCart(): CartModel {
    return this._cart() ?? this.emptyCart();
  }

  private emptyCart(): CartModel {
    const now = new Date().toISOString();
    return {
      id: 'mock-cart',
      buyerId: 0,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      items: [],
      totalItems: 0,
      totalPrice: 0,
    };
  }

  private withItems(cart: CartModel, items: CartItem[]): CartModel {
    return {
      ...cart,
      items,
      totalItems: items.reduce((total, item) => total + item.quantity, 0),
      totalPrice: items.reduce((total, item) => total + item.lineTotal, 0),
      updatedAt: new Date().toISOString(),
    };
  }

  private response<T>(data: T, message: string, success = true): ApiResponse<T> {
    return { success, message, data };
  }

  private saveCart(cart: CartModel): void {
    this._cart.set(cart);
    localStorage.setItem(this.storageKey(), JSON.stringify(cart));
  }

  private loadSavedCart(): CartModel | null {
    const key = this.storageKey();
    const saved = localStorage.getItem(key);
    if (!saved) return null;

    try {
      const cart = JSON.parse(saved) as CartModel;
      if (!Array.isArray(cart.items)) throw new Error('Saved cart has an invalid items list.');
      return this.withItems(cart, cart.items);
    } catch (error) {
      console.error('Could not restore the saved mock cart.', error);
      localStorage.removeItem(key);
      return null;
    }
  }

  private storageKey(): string {
    const user = this.auth.user();
    return user ? `${CART_STORAGE_KEY}_${user.role.toLowerCase()}_${user.id}` : `${CART_STORAGE_KEY}_guest`;
  }
}
