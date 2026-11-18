import { Component, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CurrencyPipe, TitleCasePipe } from '@angular/common';
import { Product } from '../product.model';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, MatIconModule, CurrencyPipe, TitleCasePipe],
  styleUrl: './product-card.scss',
  templateUrl: './product-card.html',
})
export class ProductCard {
  readonly product = input<Product | null>(null);
  readonly canPurchase = input(true);
  readonly onAddToCart = output<number>();
  readonly onBuyNow = output<number>();
  protected readonly selectedQuantity = signal(1);

  get maxQuantity(): number {
    const quantity = this.product()?.quantity ?? 0;
    return Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  }

  decreaseQuantity(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedQuantity.update((quantity) => Math.max(1, quantity - 1));
  }

  increaseQuantity(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectedQuantity.update((quantity) => Math.min(this.maxQuantity, quantity + 1));
  }

  get detailRoute(): string {
    return this.product()?.type === 'INPUT' ? '/inputs' : '/products';
  }

  get primaryImage(): string {
    const imgs = this.product()?.images ?? [];
    if (imgs.length > 0) {
      const primary = imgs.find((i) => i.isPrimary);
      return primary?.url ?? imgs[0]?.url ?? '';
    }
    return '';
  }

  get minOrderLabel(): string {
    const p = this.product();
    const min = p?.minimumOrderQty;
    if (!p || !min || min <= 1) return '';
    return `Min. order ${min} ${p.unit}`;
  }

  get categoryLabel(): string | null {
    const item = this.product();
    const category = item?.category.trim();
    if (!item || !category) return null;
    if (category.toLowerCase() !== 'other') return category;

    const name = item.name.toLowerCase();
    if (/\b(egg|eggs|chicken|poultry)\b/.test(name)) return 'Poultry & Eggs';
    if (/\b(strawberry|strawberries|apple|apples|banana|bananas|mango|mangoes|orange|oranges|avocado|avocados|pineapple|watermelon)\b/.test(name)) return 'Fruits';
    if (/\b(capsicum|pepper|tomato|tomatoes|onion|onions|carrot|carrots|cabbage|spinach|kale|sukuma|potato|potatoes|vegetable|vegetables)\b/.test(name)) return 'Vegetables';
    if (/\b(maize|corn|rice|wheat|beans|peas|lentils|grain|grains|cereal|cereals)\b/.test(name)) return 'Grains & Legumes';
    return null;
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

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = '/placeholder.svg';
  }

  addToCart(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.onAddToCart.emit(Math.min(this.selectedQuantity(), this.maxQuantity));
  }

  buyNow(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.onBuyNow.emit(Math.min(this.selectedQuantity(), this.maxQuantity));
  }
}
