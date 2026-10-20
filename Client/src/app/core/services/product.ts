import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  tap,
  switchMap,
  map,
  catchError,
  concatMap,
  forkJoin,
  from,
  of,
  throwError,
  toArray,
  finalize,
  shareReplay,
} from 'rxjs';

import { HttpService } from './http';
import { API_BASE, API_ORIGIN, ApiEndpoints } from '../../shared/api.config';
import {
  Product as ProductModel,
  ProductImage,
  ProductResponse,
  ProductStatus,
} from '../../shared/product.model';
import { ApiResponse } from '../../shared/api-response';

export interface CategoryOption {
  id: number;
  name: string;
  type: 'FARMER' | 'SUPPLIER';
}

/** Matches POST /api/v1/products in Swagger. */
export interface CreateProductRequest {
  sellerId: number;
  sellerType: 'FARMER' | 'SUPPLIER';
  categoryId: number;
  name: string;
  description: string;
  unit: string;
  price: number;
  stockQty: number;
  minimumOrderQty: number;
}

/** What the forms provide; the service adds sellerId and sellerType. */
export type ListingFormData = Omit<CreateProductRequest, 'sellerId' | 'sellerType'>;

@Injectable({ providedIn: 'root' })
export class Product {
  private readonly http = inject(HttpService);
  private readonly httpClient = inject(HttpClient);
  private readonly imageUrlCache = new Map<string, Observable<string>>();

  private readonly _products = signal<ProductModel[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _categories = signal<CategoryOption[]>([]);
  private readonly _categoriesLoading = signal(false);
  private readonly _categoriesError = signal<string | null>(null);

  readonly products = this._products.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly categories = this._categories.asReadonly();
  readonly categoriesLoading = this._categoriesLoading.asReadonly();
  readonly categoriesError = this._categoriesError.asReadonly();

  constructor() {
    this.loadCategories();
  }

  loadAll(): Observable<ApiResponse<{ products: ProductModel[] }>> {
    this._loading.set(true);
    this._error.set(null);
    return this.http.get<ProductResponse[]>(ApiEndpoints.PRODUCTS.LIST).pipe(
      switchMap((res) => {
        if (!res.success) {
          this._error.set(res.message || 'Failed to load products');
          return of({ ...res, data: { products: [] as ProductModel[] } });
        }
        return this.withImages(
          extractProducts<ProductResponse>(res.data).map((product) => this.toProduct(product)),
        ).pipe(
          map((products) => {
            this._products.set(products);
            return { ...res, data: { products } };
          }),
        );
      }),
      finalize(() => this._loading.set(false)),
    );
  }

  /**
   * The signed-in seller's own listings, including pending approval items.
   */
  loadSellerProducts(): Observable<ApiResponse<ProductModel[]>> {
    this._loading.set(true);
    this._error.set(null);
    return this.resolveSellerId().pipe(
      switchMap((sellerId) => {
        if (sellerId === null) {
          return of({
            success: false,
            message: 'Could not determine your user id. Please sign in again.',
            data: [] as ProductModel[],
          });
        }

        return this.http.get<ProductResponse[]>(ApiEndpoints.PRODUCTS.SELLER(sellerId)).pipe(
          switchMap((res) => {
            if (!res.success) {
              this._error.set(res.message || 'Failed to load products');
              return of({ ...res, data: [] as ProductModel[] });
            }

            const sellerProducts = extractProducts<ProductResponse>(res.data).map((product) =>
              this.toProduct(product),
            );
            const ownedProducts = sellerProducts.filter(
              (product) => Number(product.farmerId) === sellerId,
            );
            const hasForeignProducts = ownedProducts.length !== sellerProducts.length;

            return this.withImages(ownedProducts).pipe(
              switchMap((products) => {
                this._products.set(products);
                if (hasForeignProducts) {
                  const message =
                    'The server returned listings owned by another seller. Those listings were hidden; please contact support.';
                  this._error.set(message);
                  return throwError(() => new Error(message));
                }
                return of({ ...res, data: products });
              }),
            );
          }),
        );
      }),
      finalize(() => this._loading.set(false)),
    );
  }

  loadFarmerProducts(farmerId: string): Observable<ApiResponse<ProductModel[]>> {
    return this.http.get<ProductResponse[]>(ApiEndpoints.PRODUCTS.SELLER(farmerId)).pipe(
      switchMap((response) => {
        if (!response.success) {
          return of({ ...response, data: [] as ProductModel[] });
        }

        const products = extractProducts<ProductResponse>(response.data)
          .filter((product) => product.sellerType?.toUpperCase() === 'FARMER')
          .map((product) => this.toProduct(product));

        return this.withImages(products.filter((product) => product.status === 'ACTIVE')).pipe(
          map((productsWithImages) => ({
            ...response,
            data: productsWithImages,
          })),
        );
      }),
    );
  }

  loadByCategory(categoryId: string): Observable<ApiResponse<{ products: ProductModel[] }>> {
    this._loading.set(true);
    return this.http.get<ProductResponse[]>(ApiEndpoints.PRODUCTS.BY_CATEGORY(categoryId)).pipe(
      switchMap((res) => this.withImages(extractProducts<ProductResponse>(res.data).map((item) => this.toProduct(item))).pipe(
        map((products) => {
          if (res.success) this._products.set(products);
          return { ...res, data: { products } };
        }),
      )),
      finalize(() => this._loading.set(false)),
    );
  }

  search(query: string): Observable<ApiResponse<{ products: ProductModel[] }>> {
    this._loading.set(true);
    return this.http.get<ProductResponse[]>(ApiEndpoints.PRODUCTS.SEARCH, { name: query }).pipe(
      switchMap((res) => this.withImages(extractProducts<ProductResponse>(res.data).map((item) => this.toProduct(item))).pipe(
        map((products) => {
          if (res.success) this._products.set(products);
          return { ...res, data: { products } };
        }),
      )),
      finalize(() => this._loading.set(false)),
    );
  }

  getById(id: string): Observable<ApiResponse<ProductModel | null>> {
    return this.http.get<ProductResponse | { product: ProductResponse }>(
      ApiEndpoints.PRODUCTS.DETAIL(id),
    ).pipe(
      switchMap((res) => {
        const response = res.data && 'product' in res.data ? res.data.product : res.data;
        if (!res.success || !response) return of({ ...res, data: null });

        const product = this.toProduct(response);
        return this.withImages([product]).pipe(
          map(([productWithImages]) => {
            this._products.update((products) => [
              ...products.filter((item) => item.id !== productWithImages.id),
              productWithImages,
            ]);
            return { ...res, data: productWithImages };
          }),
        );
      }),
    );
  }

  /** Low-level create: the payload must already match the backend schema. */
  create(payload: CreateProductRequest): Observable<ApiResponse<ProductResponse>> {
    return this.http.post<ProductResponse>(ApiEndpoints.PRODUCTS.LIST, payload);
  }

  /**
   * Used by both the farmer and supplier forms. Looks up the logged-in
   * user's numeric id (GET /auth/me, cached) and adds sellerId + sellerType.
   */
  createListing(
    sellerType: 'farmer' | 'supplier',
    data: ListingFormData,
  ): Observable<ApiResponse<ProductResponse>> {
    return this.resolveSellerId().pipe(
      switchMap((sellerId) => {
        if (sellerId === null) {
          return throwError(() => ({
            error: { message: 'Could not determine your user id. Please sign in again.' },
          }));
        }
        return this.create({
          ...data,
          sellerId,
          sellerType: sellerType === 'farmer' ? 'FARMER' : 'SUPPLIER',
        });
      }),
    );
  }

  createListingWithImages(
    sellerType: 'farmer' | 'supplier',
    data: ListingFormData,
    files: File[],
  ): Observable<ApiResponse<ProductResponse>> {
    return this.resolveSellerId().pipe(
      switchMap((sellerId) => {
        if (sellerId === null) {
          return throwError(() => ({
            error: { message: 'Could not determine your user id. Please sign in again.' },
          }));
        }

        return this.create({
          ...data,
          sellerId,
          sellerType: sellerType === 'farmer' ? 'FARMER' : 'SUPPLIER',
        }).pipe(
          switchMap((response) => {
            if (!response.success || !response.data || files.length === 0) {
              return of(response);
            }

            return this.uploadImages(response.data.id, files).pipe(
              switchMap((uploadResponse) => {
                if (!uploadResponse.success || uploadResponse.data.length !== files.length) {
                  return throwError(() => ({
                    error: {
                      message:
                        uploadResponse.message ||
                        'Product was created, but one or more images failed to upload.',
                    },
                  }));
                }
                return of({
                  ...response,
                  data: { ...response.data, images: uploadResponse.data },
                });
              }),
            );
          }),
        );
      }),
    );
  }

  update(
    id: string,
    payload: Partial<ProductModel>,
  ): Observable<ApiResponse<{ product: ProductModel } | null>> {
    const current = this._products().find((product) => product.id === id);
    const categoryId = payload.categoryId ?? current?.categoryId;
    const sellerId = Number(current?.farmerId);
    if (!current || !categoryId || !Number.isFinite(sellerId)) {
      return throwError(() => new Error('Product details are unavailable. Reload the product and try again.'));
    }

    const request = {
      sellerId,
      sellerType: current.type === 'INPUT' ? 'SUPPLIER' : 'FARMER',
      categoryId,
      name: payload.name ?? current.name,
      description: payload.description ?? current.description,
      unit: payload.unit ?? current.unit,
      price: payload.price ?? current.price,
      stockQty: payload.quantity ?? current.quantity,
      minimumOrderQty: payload.minimumOrderQty ?? current.minimumOrderQty ?? 1,
    };

    return this.http.put<ProductResponse>(ApiEndpoints.PRODUCTS.UPDATE(id), request).pipe(
      map((res) => {
        if (!res.success || !res.data) return { ...res, data: null };
        const product = this.toProduct(res.data);
        this._products.update((products) =>
          products.map((item) => (item.id === id ? product : item)),
        );
        return { ...res, data: { product } };
      }),
    );
  }

  delete(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<null>(ApiEndpoints.PRODUCTS.DETAIL(id));
  }

  updateStatus(
    id: string,
    status: ProductStatus,
  ): Observable<ApiResponse<ProductResponse>> {
    return this.http.put<ProductResponse>(
      ApiEndpoints.PRODUCTS.UPDATE_STATUS(id),
      {},
      { status },
    );
  }

  deleteImage(productId: string, imageId: number): Observable<ApiResponse<null>> {
    return this.http.delete<null>(ApiEndpoints.PRODUCTS.IMAGE(productId, imageId));
  }

  uploadImages(productId: string | number, files: File[]): Observable<ApiResponse<ProductImage[]>> {
    if (files.length === 0) {
      return of({ success: true, message: 'No images to upload', data: [] });
    }

    return from(files).pipe(
      concatMap((file, index) => {
        const formData = new FormData();
        formData.append('image', file);
        return this.http.post<ProductImage>(ApiEndpoints.PRODUCTS.UPLOAD(String(productId)), formData, {
          sortOrder: index,
          isPrimary: index === 0,
        });
      }),
      toArray(),
      map((responses) => {
        const failedResponse = responses.find((response) => !response.success);
        const data = responses.flatMap((response) =>
          response.data ? [{ ...response.data, url: resolveImageUrl(response.data.url) }] : [],
        );
        const missingUrl = data.some((image) => !image.url?.trim());
        const success = !failedResponse && !missingUrl && data.length === files.length;

        return {
          success,
          message: failedResponse?.message ??
            (missingUrl || data.length !== files.length
              ? 'The server accepted the image upload but returned no usable image URL. Check the backend image-storage response.'
              : 'Images uploaded successfully'),
          data,
        };
      }),
    );
  }

  /** GET /api/v1/products/{id}/images - the uploaded images for one product. */
  loadImages(productId: string | number): Observable<ApiResponse<ProductImage[]>> {
    return this.http.get<unknown>(ApiEndpoints.PRODUCTS.IMAGES(String(productId))).pipe(
      map((response) => ({
        ...response,
        data: extractImages(response.data).map((image) => ({
          ...image,
          url: resolveImageUrl(image.url),
        })),
      })),
    );
  }

  /** Loads images for many products in parallel, keeping whatever the API returned. */
  loadImagesFor(products: ProductModel[]): Observable<ApiResponse<Record<string, ProductImage[]>>> {
    if (products.length === 0) {
      return of({ success: true, message: 'Success', data: {} });
    }

    return forkJoin(
      products.map((product) =>
        this.loadImages(product.id).pipe(
          map((res) => [product.id, res.success && Array.isArray(res.data) ? orderImages(res.data) : []] as const),
          catchError(() => of([product.id, []] as const)),
        ),
      ),
    ).pipe(map((entries) => ({ success: true, message: 'Success', data: Object.fromEntries(entries) })));
  }

  private withImages(products: ProductModel[]): Observable<ProductModel[]> {
    if (products.length === 0) return of([]);

    return forkJoin(
      products.map((product) => {
        const images$ = product.images.length > 0
          ? of(orderImages(product.images))
          : this.loadImages(product.id).pipe(
            map((res) => res.success ? orderImages(res.data.filter((image) => !!image.url?.trim())) : []),
            catchError(() => of([] as ProductImage[])),
          );

        return images$.pipe(
          switchMap((images) => forkJoin(
            images.map((image) => this.displayImageUrl(image.url).pipe(
              map((url) => ({ ...image, url })),
            )),
          )),
          map((images) => ({ ...product, images })),
        );
      }),
    );
  }

  private displayImageUrl(url: string): Observable<string> {
    if (!isBackendImageUrl(url)) return of(url);
    const cached = this.imageUrlCache.get(url);
    if (cached) return cached;

    const request = this.httpClient.get(url, { responseType: 'blob' }).pipe(
      map((image) => URL.createObjectURL(image)),
      catchError(() => of(url)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.imageUrlCache.set(url, request);
    return request;
  }

  private toProduct(response: ProductResponse): ProductModel {
    const category = this.categoryName(response.categoryId);
    const categoryType = this._categories().find((item) => item.id === response.categoryId)?.type;
    const normalizedStatus = normalizeStatus(response.status);
    const sellerType = response.sellerType?.toUpperCase();
    const quantity = Number(response.stockQty ?? 0);
    return {
      id: String(response.id),
      name: response.name ?? '',
      description: response.description ?? '',
      price: Number(response.price ?? 0),
      quantity,
      unit: response.unit ?? '',
      category,
      categoryId: response.categoryId,
      minimumOrderQty: response.minimumOrderQty,
      status: normalizedStatus,
      type: categoryType
        ? categoryType === 'SUPPLIER' ? 'INPUT' : 'PRODUCE'
        : sellerType === 'SUPPLIER'
          ? 'INPUT'
          : 'PRODUCE',
      images: extractImages(response.images)
        .map((image) => ({ ...image, url: resolveImageUrl(image.url) }))
        .filter((image) => !!image.url?.trim()),
      farmerId: String(response.sellerId),
      farmerName: response.sellerName ?? response.farmerName ?? '',
      farmerVerified: response.farmerVerified ?? response.farmCertified ?? false,
      location: response.sellerLocation?.trim() ?? response.sellerCounty?.trim() ?? response.location?.trim() ?? '',
      rating: 0,
      reviewCount: 0,
      available: normalizedStatus === 'ACTIVE' && quantity > 0 && response.isLive !== false,
      createdAt: response.createdAt,
    };
  }

  private categoryName(categoryId: number): string {
    const match = this._categories().find((c) => c.id === categoryId);
    return match?.name ?? 'Other';
  }

  /** Reload categories on demand (e.g. if the first request failed). */
  reloadCategories(): void {
    this.loadCategories();
  }

  private resolveSellerId(): Observable<number | null> {
    return this.http.get<any>(ApiEndpoints.AUTH.PROFILE).pipe(
      map((res) => {
        const data: any = res.data;
        const raw = data?.user?.id ?? data?.id;
        const id = Number(raw);
        return Number.isFinite(id) ? id : null;
      }),
    );
  }

  private loadCategories(): void {
    this._categoriesLoading.set(true);
    this._categoriesError.set(null);
    this.http.get<any>(ApiEndpoints.PRODUCTS.CATEGORIES).subscribe({
      next: (res) => {
        if (!res.success || !res.data) {
          this._categoriesError.set(res.message || 'Failed to load categories');
          this._categoriesLoading.set(false);
          return;
        }
        const data: any = res.data;
        const list: any[] = Array.isArray(data) ? data : (data.categories ?? []);

        const options: CategoryOption[] = list
          .map((c) => ({
            id: Number(c?.id),
            name: String(c?.name ?? c?.categoryName ?? ''),
            type: String(c?.type ?? '').toUpperCase(),
          }))
          .filter((c): c is CategoryOption =>
            Number.isFinite(c.id) &&
            c.name !== '' &&
            (c.type === 'FARMER' || c.type === 'SUPPLIER'),
          );

        this._categories.set(options);
        this._products.update((products) => products.map((product) => {
          const category = options.find((item) => item.id === product.categoryId);
          return {
            ...product,
            type: category
              ? category.type === 'SUPPLIER' ? 'INPUT' : 'PRODUCE'
              : product.type,
            category: category?.name ?? product.category,
          };
        }));
        this._categoriesLoading.set(false);
      },
      error: (error: { error?: { message?: string } }) => {
        this._categories.set([]);
        this._categoriesError.set(error.error?.message || 'Failed to load categories');
        this._categoriesLoading.set(false);
      },
    });
  }
}

function normalizeStatus(status: ProductResponse['status']): ProductStatus {
  switch (String(status).toUpperCase()) {
    case 'ACTIVE':
      return 'ACTIVE';
    case 'REJECTED':
      return 'REJECTED';
    case 'SUSPENDED':
      return 'SUSPENDED';
    default:
      return 'PENDING_APPROVAL';
  }
}

function orderImages(images: ProductImage[]): ProductImage[] {
  return [...images].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
}

function resolveImageUrl(url: string): string {
  const value = url.trim();
  if (!value || /^(https?:|data:|blob:|\/\/)/i.test(value)) return value;

  if (API_BASE.startsWith('http')) {
    return new URL(value, new URL(API_BASE).origin).toString();
  }
  return value.startsWith('/') ? value : `/${value}`;
}

function isBackendImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url, API_ORIGIN);
    return parsed.origin === API_ORIGIN &&
      (parsed.pathname.startsWith('/api/v1/images/') || parsed.pathname.startsWith('/uploads/'));
  } catch {
    return false;
  }
}

function extractImages(data: unknown): ProductImage[] {
  if (Array.isArray(data)) return data as ProductImage[];
  if (data && typeof data === 'object') {
    const result = data as { images?: unknown; content?: unknown };
    if (Array.isArray(result.images)) return result.images as ProductImage[];
    if (Array.isArray(result.content)) return result.content as ProductImage[];
  }
  return [];
}

/** The list endpoint returns either a bare array, { products } or a page's { content }. */
function extractProducts<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const record = data as { products?: T[]; content?: T[] };
    return record.products ?? record.content ?? [];
  }
  return [];
}
