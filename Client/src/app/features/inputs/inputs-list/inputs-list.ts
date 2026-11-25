import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { ProductCard } from '../../../shared/product-card/product-card';
import { Product } from '../../../core/services/product';
import { Cart } from '../../../core/services/cart';
import { Auth } from '../../../core/services/auth';
import type { Product as ProductModel } from '../../../shared/product.model';
import { NotificationService } from '../../../shared/notification/notification.service';

@Component({
  selector: 'app-inputs-list',
  imports: [
    NgOptimizedImage,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    ProductCard,
  ],
  styleUrl: './inputs-list.scss',
  templateUrl: './inputs-list.html',
})
export class InputsList implements OnInit {
  protected readonly productService = inject(Product);
  protected readonly cartService = inject(Cart);
  protected readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);

  protected readonly searchQuery = signal('');
  protected readonly selectedCategory = signal<string>('ALL');
  protected readonly canPurchaseInputs = computed(() =>
    !this.auth.isAuthenticated() || this.auth.isFarmer(),
  );

  protected readonly categories = computed(() => {
    const cats = new Set<string>(this.productService.products().filter(p => p.type === 'INPUT').map(p => p.category));
    return Array.from(cats).sort();
  });

  protected readonly filtered = computed(() => {
    const all = this.productService.products().filter(p => p.type === 'INPUT');
    const q = this.searchQuery().toLowerCase();
    const cat = this.selectedCategory();
    return all.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
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
        this.notification.error('Failed to load inputs');
      }
    });
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  protected selectCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  protected categoryIcon(category: string): string {
    const value = category.toLowerCase();
    if (value.includes('fertilizer') || value.includes('compost')) return 'compost';
    if (value.includes('seed')) return 'eco';
    if (value.includes('tool') || value.includes('equipment')) return 'handyman';
    if (value.includes('feed')) return 'pets';
    if (value.includes('chemical') || value.includes('pesticide')) return 'science';
    return 'category';
  }

  protected addToCart(input: ProductModel, quantity = 1): void {
    if (!input.available || input.quantity === 0) {
      this.notification.warning('Input is out of stock');
      return;
    }

    this.cartService.addItem(input, quantity).subscribe({
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

  protected buyNow(input: ProductModel, quantity: number): void {
    if (!input.available || input.quantity < quantity) {
      this.notification.warning('The requested quantity is not available');
      return;
    }

    this.cartService.addItem(input, quantity).subscribe({
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
