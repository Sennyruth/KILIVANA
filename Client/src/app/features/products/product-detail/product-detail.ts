import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Product } from '../../../core/services/product';
import { Farmer } from '../../../core/services/farmer';
import { Cart } from '../../../core/services/cart';
import { finalize } from 'rxjs';
import { NotificationService } from '../../../shared/notification/notification.service';
import type { Product as ProductModel } from '../../../shared/product.model';
import type { FarmerProfile } from '../../../shared/farmer.model';

@Component({
  selector: 'app-product-detail',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTabsModule,
    MatProgressSpinnerModule,
  ],
  styleUrl: './product-detail.scss',
  templateUrl: './product-detail.html',
})
export class ProductDetail implements OnInit {
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  private readonly productService = inject(Product);
  private readonly farmerService = inject(Farmer);
  private readonly cartService = inject(Cart);
  private readonly notification = inject(NotificationService);
  
  protected readonly productId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly quantity = signal(1);
  protected readonly farmerProfile = signal<FarmerProfile | null>(null);
  protected readonly farmerProducts = signal<ProductModel[]>([]);
  protected readonly farmerLoading = signal(false);
  protected readonly farmerError = signal<string | null>(null);
  protected readonly farmerProductsLoading = signal(false);
  protected readonly farmerProductsError = signal<string | null>(null);
  protected readonly loading = computed(() => this.productService.loading());
  protected readonly error = computed(() => this.productService.error());

  protected readonly product = computed((): ProductModel | null => {
    const products = this.productService.products();
    return products.find(p => p.id === this.productId) || null;
  });

  protected readonly primaryImage = computed(() => {
    const p = this.product();
    if (!p) return '';
    const imgs = p.images ?? [];
    const primary = imgs.find((i) => i.isPrimary);
    return primary?.url ?? imgs[0]?.url ?? '';
  });

  protected readonly galleryImages = computed(() => {
    const p = this.product();
    return p?.images ?? [];
  });

  protected farmerProductImage(product: ProductModel): string {
    const images = product.images ?? [];
    const primary = images.find((image) => image.isPrimary);
    return primary?.url ?? images[0]?.url ?? '/placeholder.svg';
  }

  protected onFarmerProductImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = '/placeholder.svg';
  }

  protected readonly availableQuantity = computed(() => {
    const p = this.product();
    return p?.available ? p.quantity : 0;
  });

  ngOnInit(): void {
    this.productService.getById(this.productId).subscribe({
      next: (response) => {
        const product = response.data;
        if (response.success && product?.type === 'PRODUCE' && product.farmerId) {
          this.loadFarmerDetails(product.farmerId);
        }
      },
      error: () => {
        this.notification.error('Failed to load product');
      }
    });
  }

  private loadFarmerDetails(farmerId: string): void {
    this.farmerLoading.set(true);
    this.farmerService.getProfile(farmerId).pipe(
      finalize(() => this.farmerLoading.set(false)),
    ).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.farmerError.set(response.message || 'Farmer details are unavailable.');
          return;
        }
        this.farmerProfile.set(response.data);
      },
      error: () => this.farmerError.set('Farmer details could not be loaded.'),
    });

    this.farmerProductsLoading.set(true);
    this.productService.loadFarmerProducts(farmerId).pipe(
      finalize(() => this.farmerProductsLoading.set(false)),
    ).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.farmerProductsError.set(response.message || 'Farmer products are unavailable.');
          return;
        }
        this.farmerProducts.set(response.data.filter((item) => item.id !== this.productId));
      },
      error: () => this.farmerProductsError.set('Farmer products could not be loaded.'),
    });
  }

  protected increase(): void {
    const max = this.availableQuantity();
    this.quantity.update((v) => v < max ? v + 1 : v);
  }

  protected decrease(): void {
    this.quantity.update((v) => (v > 1 ? v - 1 : 1));
  }

  protected addToCart(): void {
    const product = this.product();
    if (!product) return;

    this.cartService.addItem(product, this.quantity()).subscribe({
      next: (res) => {
        if (res.success) {
          this.notification.success('Added to cart!');
        } else {
          this.notification.error(res.message || 'Failed to add to cart');
        }
      },
      error: (error) => {
        this.notification.error(error.error?.message || error.error?.error || error.message || 'Failed to add to cart');
      }
    });
  }

  protected viewCart(): void {
    this.router.navigate(['/cart']);
  }
}
