import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProductCard } from '../../../shared/product-card/product-card';
import { Product } from '../../../core/services/product';
import { Cart } from '../../../core/services/cart';
import type { ProductCategory } from '../../../shared/product.model';

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
  private readonly snackBar = inject(MatSnackBar);

  protected readonly searchQuery = signal('');
  protected readonly selectedCategory = signal<ProductCategory | 'ALL'>('ALL');

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
        this.snackBar.open('Failed to load products', 'Close', { duration: 3000 });
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

  protected addToCart(product: any): void {
    if (!product.available || product.quantity === 0) {
      this.snackBar.open('Product is out of stock', 'Close', { duration: 2000 });
      return;
    }
    
    this.cartService.addItem(product.id, 1).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('Added to cart!', 'Close', { duration: 2000 });
        } else {
          this.snackBar.open(res.message || 'Failed to add to cart', 'Close', { duration: 3000 });
        }
      },
      error: () => {
        this.snackBar.open('Failed to add to cart', 'Close', { duration: 3000 });
      }
    });
  }
}
