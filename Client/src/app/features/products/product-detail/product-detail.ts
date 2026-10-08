import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Product } from '../../../core/services/product';
import { Cart } from '../../../core/services/cart';
import { NotificationService } from '../../../shared/notification/notification.service';
import type { Product as ProductModel } from '../../../shared/product.model';

@Component({
  selector: 'app-product-detail',
  imports: [
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
  private readonly cartService = inject(Cart);
  private readonly notification = inject(NotificationService);
  
  protected readonly productId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly quantity = signal(1);
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

  protected readonly availableQuantity = computed(() => {
    const p = this.product();
    return p?.available ? p.quantity : 0;
  });

  ngOnInit(): void {
    this.productService.getById(this.productId).subscribe({
      error: () => {
        this.notification.error('Failed to load product');
      }
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
