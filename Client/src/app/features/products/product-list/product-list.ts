import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
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
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
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
  private readonly notification = inject(NotificationService);

  protected readonly searchQuery = signal('');
  protected readonly selectedCategory = signal<string>('ALL');

  protected selectCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  protected categoryIcon(category: string): string {
    const value = category.toLowerCase();
    if (value.includes('fruit')) return 'nutrition';
    if (value.includes('vegetable') || value.includes('green')) return 'spa';
    if (value.includes('grain') || value.includes('cereal') || value.includes('maize')) return 'grass';
    if (value.includes('dairy') || value.includes('milk')) return 'water_drop';
    if (value.includes('meat') || value.includes('poultry') || value.includes('livestock')) return 'pets';
    if (value.includes('seed')) return 'eco';
    return 'category';
  }

  protected readonly categories = computed(() => {
    const cats = new Set<string>(this.productService.products().filter(p => p.type === 'PRODUCE').map(p => p.category));
    return Array.from(cats).sort();
  });

  protected readonly filtered = computed(() => {
    const all = this.productService.products().filter(p => p.type === 'PRODUCE');
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
        this.notification.error('Failed to load products');
      }
    });
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
  }

  protected onCategory(event: any): void {
    this.selectedCategory.set(event.value as string);
  }

  protected addToCart(product: ProductModel): void {
    if (!product.available || product.quantity === 0) {
      this.notification.warning('Product is out of stock');
      return;
    }

    this.cartService.addItem(product, 1).subscribe({
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
