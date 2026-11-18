import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProductCard } from '../../shared/product-card/product-card';
import { Product } from '../../core/services/product';
import { Cart } from '../../core/services/cart';
import { Auth } from '../../core/services/auth';
import { NotificationService } from '../../shared/notification/notification.service';
import type { Product as ProductModel } from '../../shared/product.model';

@Component({
  selector: 'app-landing',
  imports: [
    NgOptimizedImage,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ProductCard,
  ],
  styleUrl: './landing.scss',
  templateUrl: './landing.html',
})
export class Landing implements OnInit {
  protected readonly productService = inject(Product);
  private readonly cartService = inject(Cart);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);

  protected readonly isAuthenticated = computed(() => this.auth.isAuthenticated());
  protected readonly featuredLoadError = signal(false);
  protected readonly featured = computed(() =>
    this.productService
      .products()
      .filter((product) => product.type === 'PRODUCE' && product.status === 'ACTIVE' && product.available)
      .slice(0, 8),
  );

  ngOnInit(): void {
    if (this.productService.products().length === 0) this.loadFeaturedProducts();
  }

  protected retryFeaturedProducts(): void {
    this.loadFeaturedProducts();
  }

  private loadFeaturedProducts(): void {
    this.featuredLoadError.set(false);
    this.productService.loadAll().subscribe({
      next: (response) => {
        if (!response.success) this.featuredLoadError.set(true);
      },
      error: () => {
        this.featuredLoadError.set(true);
        this.notification.error('Featured products could not be loaded. Please try again.');
      },
    });
  }

  protected addToCart(product: ProductModel, quantity: number): void {
    this.cartService.addItem(product, quantity).subscribe({
      next: (res) => {
        if (res.success) {
          this.notification.success('Added to cart!');
        } else {
          this.notification.error(res.message || 'Failed to add to cart');
        }
      },
      error: () => this.notification.error('Failed to add to cart'),
    });
  }

  protected buyNow(product: ProductModel, quantity: number): void {
    this.cartService.addItem(product, quantity).subscribe({
      next: (res) => {
        if (!res.success) {
          this.notification.error(res.message || 'Could not prepare this item for checkout');
          return;
        }
        void this.router.navigate(['/checkout']);
      },
      error: () => this.notification.error('Could not prepare checkout'),
    });
  }

  protected dashboardHref(): string {
    const role = this.auth.role();
    if (role === 'FARMER') return '/dashboard/farmer';
    if (role === 'SUPPLIER') return '/dashboard/supplier';
    return '/dashboard/buyer';
  }
}
