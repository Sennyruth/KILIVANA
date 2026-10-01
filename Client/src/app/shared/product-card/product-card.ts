import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatBadgeModule } from '@angular/material/badge';
import { MatIconModule } from '@angular/material/icon';
import { CurrencyPipe, TitleCasePipe } from '@angular/common';
import { Product } from '../product.model';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, MatCardModule, MatBadgeModule, MatIconModule, CurrencyPipe, TitleCasePipe],
  styleUrl: './product-card.scss',
  templateUrl: './product-card.html',
})
export class ProductCard {
  readonly product = input<Product | null>(null);
  readonly onAddToCart = output<void>();

  get primaryImage(): string {
    const imgs = this.product()?.images ?? [];
    if (imgs.length > 0) {
      const primary = imgs.find((i) => i.isPrimary);
      return primary?.url ?? imgs[0]?.url ?? '';
    }
    return '';
  }

  get stockLabel(): string {
    const p = this.product();
    if (!p) return '';
    if (!p.available || p.quantity === 0) return 'Out of stock';
    if (p.quantity <= 5) return `Only ${p.quantity} left`;
    return 'In stock';
  }

  get stockClass(): string {
    const p = this.product();
    if (!p || !p.available || p.quantity === 0) return 'product-card__stock--none';
    if (p.quantity <= 5) return 'product-card__stock--low';
    return 'product-card__stock--ok';
  }

  addToCart(event: Event): void {
    event.preventDefault();
    this.onAddToCart.emit();
  }
}