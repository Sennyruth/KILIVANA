import { Service, inject, computed } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';

import { HttpService } from './http';
import { ApiEndpoints } from '../../shared/api.config';
import { Product as ProductModel, ProductFilters, ProductCategory } from '../../shared/product.model';
import { ApiResponse } from '../../shared/api-response';

@Service()
export class Product {
  private readonly http = inject(HttpService);

  private readonly _products = new BehaviorSubject<ProductModel[]>([]);
  private readonly _loading = new BehaviorSubject<boolean>(false);
  private readonly _error = new BehaviorSubject<string | null>(null);
  private readonly _categories = new BehaviorSubject<ProductCategory[]>([]);

  readonly products$ = this._products.asObservable();
  readonly loading$ = this._loading.asObservable();
  readonly error$ = this._error.asObservable();
  readonly categories$ = this._categories.asObservable();

  readonly products = computed(() => this._products.value);
  readonly loading = computed(() => this._loading.value);
  readonly error = computed(() => this._error.value);
  readonly categories = computed(() => this._categories.value);

  constructor() {
    this.loadCategories();
  }

  loadAll(): Observable<ApiResponse<{ products: ProductModel[] }>> {
    this._loading.next(true);
    this._error.next(null);
    return this.http.get<{ products: ProductModel[] }>(ApiEndpoints.PRODUCTS.LIST).pipe(
      tap((res) => {
        if (res.success && res.data) this._products.next(res.data.products);
        this._loading.next(false);
      }),
    );
  }

  loadByCategory(category: ProductCategory): Observable<ApiResponse<{ products: ProductModel[] }>> {
    this._loading.next(true);
    return this.http.get<{ products: ProductModel[] }>(ApiEndpoints.PRODUCTS.LIST, { category }).pipe(
      tap((res) => {
        if (res.success && res.data) this._products.next(res.data.products);
        this._loading.next(false);
      }),
    );
  }

  search(query: string): Observable<ApiResponse<{ products: ProductModel[] }>> {
    this._loading.next(true);
    return this.http.get<{ products: ProductModel[] }>(ApiEndpoints.PRODUCTS.LIST, { search: query }).pipe(
      tap((res) => {
        if (res.success && res.data) this._products.next(res.data.products);
        this._loading.next(false);
      }),
    );
  }

  getById(id: string): Observable<ApiResponse<{ product: ProductModel }>> {
    return this.http.get<{ product: ProductModel }>(ApiEndpoints.PRODUCTS.DETAIL(id));
  }

  create(
    payload: Omit<ProductModel, 'id' | 'createdAt' | 'reviewCount' | 'rating' | 'farmerId' | 'farmerName' | 'farmerVerified' | 'location'>,
  ): Observable<ApiResponse<{ product: ProductModel }>> {
    return this.http.post<{ product: ProductModel }>(ApiEndpoints.PRODUCTS.LIST, payload);
  }

  uploadImages(files: File[]): Observable<ApiResponse<{ urls: string[] }>> {
    const formData = new FormData();
    files.forEach((f) => formData.append('images', f));
    return this.http.post<{ urls: string[] }>(ApiEndpoints.PRODUCTS.UPLOAD, formData);
  }

  private loadCategories(): void {
    this.http.get<{ categories: ProductCategory[] }>(ApiEndpoints.PRODUCTS.CATEGORIES).subscribe({
      next: (res) => {
        if (res.success && res.data) this._categories.next(res.data.categories);
      },
      error: () => {
        this._categories.next([
          'VEGETABLES', 'FRUITS', 'GRAINS', 'DAIRY', 'POULTRY', 'LIVESTOCK', 'HERBS',
          'FERTILIZERS', 'SEEDS', 'PESTICIDES', 'EQUIPMENT', 'TOOLS', 'OTHER',
        ]);
      },
    });
  }
}