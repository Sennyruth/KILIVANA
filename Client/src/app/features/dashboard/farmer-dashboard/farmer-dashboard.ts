import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Product } from '../../../core/services/product';
import { Order } from '../../../core/services/order';
import { Farmer } from '../../../core/services/farmer';
import { Auth } from '../../../core/services/auth';
import type { Product as ProductModel } from '../../../shared/product.model';
import type { Order as OrderRecord, SellerOrderSummary } from '../../../shared/order.model';
import type { FarmerProfileImage } from '../../../shared/farmer.model';
import { NotificationService } from '../../../shared/notification/notification.service';
import { catchError, forkJoin, map, of } from 'rxjs';

@Component({
  selector: 'app-farmer-dashboard',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
  ],
  styleUrl: './farmer-dashboard.scss',
  templateUrl: './farmer-dashboard.html',
})
export class FarmerDashboard implements OnInit, OnDestroy {
  protected readonly productService = inject(Product);
  protected readonly orderService = inject(Order);
  protected readonly farmerService = inject(Farmer);
  protected readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  private readonly _orders = signal<SellerOrderSummary[]>([]);
  protected readonly ordersError = signal<string | null>(null);
  protected readonly inputOrders = signal<OrderRecord[]>([]);
  protected readonly inputOrdersLoading = signal(false);
  protected readonly inputOrdersError = signal<string | null>(null);
  protected readonly farmProfileLoading = signal(false);
  protected readonly farmProfileSaving = signal(false);
  protected readonly farmPhotoUploading = signal(false);
  protected readonly farmProfileReady = signal(false);
  protected readonly farmProfileError = signal<string | null>(null);
  protected readonly farmProfileLoadError = signal<string | null>(null);
  protected readonly farmPhotoError = signal<string | null>(null);
  protected readonly farmPhotos = signal<FarmerProfileImage[]>([]);
  protected readonly selectedFarmPhoto = signal<File | null>(null);
  protected readonly farmPhotoPreview = signal<string | null>(null);
  protected readonly farmProfileForm = this.fb.group({
    farmName: [`${this.auth.user()?.name ?? ''} Farm`.trim(), [Validators.required, Validators.maxLength(120)]],
    location: [this.auth.user()?.region ?? '', [Validators.required, Validators.maxLength(200)]],
    farmDetails: ['', [Validators.maxLength(1000)]],
  });
  private readonly _selectedCategory = signal<string>('ALL');

  protected readonly allProducts = computed(() => this.productService.products().filter(p => p.type === 'PRODUCE'));
  protected readonly selectedCategory = this._selectedCategory.asReadonly();
  
  protected readonly products = computed(() => {
    const category = this._selectedCategory();
    if (category === 'ALL') {
      return this.allProducts();
    }
    return this.allProducts().filter(p => p.category === category);
  });
  
  protected readonly loading = computed(() => this.productService.loading());
  protected readonly orders = this._orders.asReadonly();
  
  protected readonly categories = computed(() => {
    const cats = new Set<string>(this.allProducts().map(p => p.category));
    return Array.from(cats).sort();
  });

  protected readonly totalProducts = computed(() => this.allProducts().length);
  protected readonly activeProducts = computed(() => this.allProducts().filter(p => p.available).length);
  protected readonly totalOrders = computed(() => this.orders().length);
  protected readonly pendingOrders = computed(() => this.orders().filter(o => o.status === 'PENDING').length);

  ngOnInit(): void {
    this.loadData();
    this.loadFarmProfile();
  }

  ngOnDestroy(): void {
    this.clearFarmPhotoObjectUrls();
    this.clearFarmPhotoPreview();
  }

  protected loadFarmProfile(): void {
    const farmerId = this.auth.user()?.id;
    if (!farmerId) {
      this.farmProfileLoadError.set('Sign in again to manage your farm photos.');
      return;
    }

    this.farmProfileLoading.set(true);
    this.farmProfileLoadError.set(null);
    this.farmerService.getProfile(farmerId).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.farmProfileLoadError.set(response.message || 'Could not load your farm profile.');
          this.farmProfileLoading.set(false);
          return;
        }
        this.farmProfileReady.set(true);
        this.farmProfileError.set(null);
        this.farmProfileForm.patchValue({
          farmName: response.data.farmName || response.data.name,
          location: response.data.region || '',
          farmDetails: response.data.farmDetails || '',
        });
        this.loadFarmPhotos(farmerId);
      },
      error: (error: { status?: number; error?: { message?: string } }) => {
        if (error.status === 404) {
          this.farmProfileReady.set(false);
          this.farmProfileLoadError.set(null);
          this.farmProfileLoading.set(false);
          return;
        }
        this.farmProfileLoadError.set(error.error?.message || 'Could not load your farm profile. Try again.');
        this.farmProfileLoading.set(false);
      },
      complete: () => this.farmProfileLoading.set(false),
    });
  }

  protected saveFarmProfile(): void {
    if (this.farmProfileForm.invalid || this.farmProfileSaving()) {
      this.farmProfileForm.markAllAsTouched();
      return;
    }
    const farmerId = this.auth.user()?.id;
    if (!farmerId) return;
    const value = this.farmProfileForm.getRawValue();
    this.farmProfileSaving.set(true);
    this.farmProfileError.set(null);
    this.farmerService.createProfile(farmerId, {
      farmName: value.farmName?.trim() ?? '',
      location: value.location?.trim() ?? '',
      farmDetails: value.farmDetails?.trim() || undefined,
    }).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.farmProfileError.set(response.message || 'Could not save your farm details.');
          return;
        }
        this.farmProfileReady.set(true);
        this.notification.success('Farm details saved. You can now upload inspection photos.');
        this.loadFarmPhotos(farmerId);
      },
      error: (error: { error?: { message?: string } }) => {
        this.farmProfileError.set(error.error?.message || 'Could not save your farm details. Try again.');
        this.farmProfileSaving.set(false);
      },
      complete: () => this.farmProfileSaving.set(false),
    });
  }

  protected onFarmPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.farmPhotoError.set(null);
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type.toLowerCase())) {
      this.clearSelectedFarmPhoto();
      this.farmPhotoError.set('Choose an image file such as JPG, PNG, or WebP.');
      input.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.clearSelectedFarmPhoto();
      this.farmPhotoError.set('The image must be smaller than 10 MB.');
      input.value = '';
      return;
    }
    this.clearFarmPhotoPreview();
    this.selectedFarmPhoto.set(file);
    this.farmPhotoPreview.set(URL.createObjectURL(file));
    input.value = '';
  }

  protected uploadFarmPhoto(): void {
    const file = this.selectedFarmPhoto();
    const farmerId = this.auth.user()?.id;
    if (!file || !farmerId || this.farmPhotoUploading()) return;
    this.farmPhotoUploading.set(true);
    this.farmPhotoError.set(null);
    this.farmerService.uploadProfileImage(farmerId, file, this.farmPhotos().length === 0).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.farmPhotoError.set(response.message || 'The farm photo could not be uploaded.');
          return;
        }
        this.selectedFarmPhoto.set(null);
        this.clearFarmPhotoPreview();
        this.loadFarmPhotos(farmerId);
        this.notification.success('Farm photo uploaded for inspection.');
      },
      error: (error: { error?: { message?: string } }) => {
        this.farmPhotoError.set(error.error?.message || 'The farm photo could not be uploaded. Try again.');
        this.farmPhotoUploading.set(false);
      },
      complete: () => this.farmPhotoUploading.set(false),
    });
  }

  private loadFarmPhotos(farmerId: string): void {
    this.farmerService.getProfileImages(farmerId).subscribe({
      next: (response) => {
        if (!response.success || !response.data) return;
        const photos = response.data;
        forkJoin(photos.map((photo) => this.farmerService.getImageObjectUrl(photo.url).pipe(
          map((url) => ({ ...photo, url })),
          catchError(() => of({ ...photo, url: '/placeholder.svg' })),
        ))).subscribe((displayPhotos) => {
          this.clearFarmPhotoObjectUrls();
          this.farmPhotos.set(displayPhotos);
        });
      },
      error: () => this.farmPhotoError.set('Farm photos could not be loaded. Try refreshing the page.'),
    });
  }

  private clearFarmPhotoObjectUrls(): void {
    this.farmPhotos().forEach((photo) => {
      if (photo.url.startsWith('blob:')) URL.revokeObjectURL(photo.url);
    });
  }

  protected clearFarmPhotoPreview(): void {
    const preview = this.farmPhotoPreview();
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    this.farmPhotoPreview.set(null);
  }

  protected clearSelectedFarmPhoto(): void {
    this.selectedFarmPhoto.set(null);
    this.clearFarmPhotoPreview();
  }

  protected onFarmPhotoImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = '/placeholder.svg';
  }

  protected loadData(): void {
    this.productService.loadSellerProducts().subscribe({
      error: (error: { message?: string }) => {
        this.notification.error(error.message || 'Failed to load products');
      }
    });
    this.loadOrders();
    this.loadInputOrders();
  }

  protected loadInputOrders(): void {
    this.inputOrdersError.set(null);
    this.inputOrders.set([]);
    this.inputOrdersLoading.set(true);
    this.orderService.loadMine().subscribe({
      next: (response) => {
        if (response.success && response.data) this.inputOrders.set(response.data.orders);
        else this.inputOrdersError.set(response.message || 'Could not load your input orders.');
        this.inputOrdersLoading.set(false);
      },
      error: () => {
        this.inputOrdersError.set('Could not load your input orders. Please try again.');
        this.inputOrdersLoading.set(false);
      },
    });
  }

  protected loadOrders(): void {
    this.ordersError.set(null);
    this.orderService.loadFarmerOrders().subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.ordersError.set(response.message || 'Failed to load orders.');
          return;
        }
        this._orders.set(response.data);
      },
      error: () => this.ordersError.set('Failed to load orders. Please try again.'),
    });
  }

  protected addProduct(): void {
    this.router.navigate(['/dashboard/farmer/add-product']);
  }

  protected editFarmDetails(): void {
    this.router.navigate(['/dashboard/farmer/setup'], { queryParams: { manage: '1' } });
  }

  protected editProduct(productId: string): void {
    this.router.navigate(['/dashboard/farmer/edit-product', productId]);
  }

  protected deleteProduct(productId: string): void {
    const product = this.products().find((item) => item.id === productId);
    if (!product || !window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;

    this.productService.delete(productId).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notification.error(response.message || 'Failed to delete product');
          return;
        }
        this.notification.success('Product deleted');
        this.refreshProducts();
      },
      error: (error: { error?: { message?: string } }) => {
        this.notification.error(error.error?.message || 'Failed to delete product');
      },
    });
  }

  protected loadImage(product: ProductModel): string {
    const imgs = (product.images ?? []).filter((image) => !!image.url?.trim());
    if (imgs.length > 0) {
      const primary = imgs.find((image) => image.isPrimary);
      return primary?.url ?? imgs[0].url;
    }
    return '/placeholder.svg';
  }

  protected productStatusLabel(product: ProductModel): string {
    if (product.status === 'ACTIVE' && product.quantity <= 0) return 'Out of stock';
    switch (product.status) {
      case 'ACTIVE':
        return 'Active';
      case 'REJECTED':
        return 'Rejected';
      case 'SUSPENDED':
        return 'Suspended';
      default:
        return 'Pending approval';
    }
  }

  protected productStatusClass(product: ProductModel): string {
    if (product.status === 'ACTIVE' && product.quantity <= 0) return 'dashboard__status--unavailable';
    switch (product.status) {
      case 'ACTIVE':
        return 'dashboard__status--active';
      case 'REJECTED':
        return 'dashboard__status--rejected';
      case 'SUSPENDED':
        return 'dashboard__status--rejected';
      default:
        return 'dashboard__status--pending';
    }
  }

  protected onProductImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith('/placeholder.svg')) image.src = '/placeholder.svg';
  }

  private refreshProducts(): void {
    this.productService.loadSellerProducts().subscribe({
      error: (error: { message?: string }) =>
        this.notification.error(error.message || 'Failed to refresh products'),
    });
  }

  protected orderIdLabel(orderId: number): string {
    return String(orderId).slice(-8).toUpperCase();
  }

  protected inputOrderItems(order: OrderRecord): string {
    return order.items.map((item) => `${item.name} × ${item.quantity}`).join(', ');
  }

  protected selectCategory(category: string): void {
    this._selectedCategory.set(category);
  }

  protected categoryLabel(category: string): string {
    if (category === 'ALL') return 'All Categories';
    return category;
  }
}
