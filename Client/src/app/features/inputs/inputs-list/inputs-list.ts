import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProductCard } from '../../../shared/product-card/product-card';
import { Product } from '../../../core/services/product';
import { Cart } from '../../../core/services/cart';
import type { Product as ProductModel, ProductCategory } from '../../../shared/product.model';
import { NotificationService } from '../../../shared/notification/notification.service';

const INPUT_CATEGORIES: ProductCategory[] = [
  'FERTILIZERS',
  'SEEDS',
  'PESTICIDES',
  'EQUIPMENT',
  'TOOLS',
  'OTHER',
] as ProductCategory[];

@Component({
  selector: 'app-inputs-list',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
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
  protected readonly selectedCategory = signal<ProductCategory | 'ALL'>('ALL');
  protected readonly categories = signal(INPUT_CATEGORIES);

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

  protected onCategory(event: any): void {
    this.selectedCategory.set(event.value as ProductCategory | 'ALL');
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
