import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProductCard } from '../../../shared/product-card/product-card';
import { Product } from '../../../core/services/product';
import { Cart } from '../../../core/services/cart';
import { NotificationService } from '../../../shared/notification/notification.service';
import type { Product as ProductModel } from '../../../shared/product.model';

@Component({
  selector: 'app-product-list',
  imports: [
    MatIconModule,
    MatProgressSpinnerModule,
    ProductCard,
  ],
  styleUrl: './product-list.scss',
  templateUrl: './product-list.html',
})
export class ProductList implements OnInit {
  protected readonly productService = inject(Product);
  protected readonly cartService = inject(Cart);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notification = inject(NotificationService);

  protected readonly searchQuery = signal('');
  protected readonly selectedCategory = signal<string>('ALL');

  protected readonly filtered = computed(() => {
    const all = this.productService.products().filter(p => p.type === 'PRODUCE');
    const query = this.searchQuery().toLowerCase();
    const cat = this.selectedCategory();
    return all.filter((p) => {
      const matchesSearch = !query || p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query);
      const matchesCat = cat === 'ALL' || p.category === cat;
      return matchesSearch && matchesCat;
    });
  });

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.searchQuery.set(params.get('q') ?? '');
      this.selectedCategory.set(params.get('category') ?? 'ALL');
    });

    this.productService.loadAll().subscribe({
      error: () => {
        this.notification.error('Failed to load products');
      }
    });
  }

  protected addToCart(product: ProductModel, quantity = 1): void {
    if (!product.available || product.quantity === 0) {
      this.notification.warning('Product is out of stock');
      return;
    }

    this.cartService.addItem(product, quantity).subscribe({
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

  protected buyNow(product: ProductModel, quantity: number): void {
    if (!product.available || product.quantity < quantity) {
      this.notification.warning('The requested quantity is not available');
      return;
    }

    this.cartService.addItem(product, quantity).subscribe({
      next: (res) => {
        if (!res.success) {
          this.notification.error(res.message || 'Could not prepare this item for checkout');
          return;
        }
        void this.router.navigate(['/checkout']);
      },
      error: (error) => this.notification.error(error.error?.message || error.message || 'Could not prepare checkout'),
    });
  }
}
