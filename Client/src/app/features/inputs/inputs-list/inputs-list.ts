import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { ProductCard } from '../../../shared/product-card/product-card';
import { Product } from '../../../core/services/product';
import { Cart } from '../../../core/services/cart';
import type { Product as ProductModel } from '../../../shared/product.model';
import { NotificationService } from '../../../shared/notification/notification.service';

@Component({
  selector: 'app-inputs-list',
  imports: [
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
  private readonly notification = inject(NotificationService);

  protected readonly searchQuery = signal('');
  protected readonly selectedCategory = signal<string>('ALL');

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

  protected addToCart(input: ProductModel): void {
    if (!input.available || input.quantity === 0) {
      this.notification.warning('Input is out of stock');
      return;
    }

    this.cartService.addItem(input, 1).subscribe({
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
}
