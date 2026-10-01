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
  private readonly snackBar = inject(MatSnackBar);

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
        this.snackBar.open('Failed to load inputs', 'Close', { duration: 3000 });
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

  protected addToCart(input: any): void {
    if (!input.available || input.quantity === 0) {
      this.snackBar.open('Input is out of stock', 'Close', { duration: 2000 });
      return;
    }
    
    this.cartService.addItem(input.id, 1).subscribe({
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
