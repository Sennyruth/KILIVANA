import { Component, OnInit, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurrencyPipe } from '@angular/common';
import { Cart } from '../../../core/services/cart';
import { NotificationService } from '../../../shared/notification/notification.service';

@Component({
  selector: 'app-cart-view',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    CurrencyPipe,
    RouterLink,
  ],
  styleUrl: './cart-view.scss',
  templateUrl: './cart-view.html',
})
export class CartView implements OnInit {
  protected readonly cart = inject(Cart);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);

  protected readonly subtotal = computed(() => this.cart.totalPrice());

  protected readonly total = computed(() => {
    const sub = this.subtotal();
    const delivery = sub > 0 ? 1 : 0;
    return sub + delivery;
  });

  protected readonly deliveryFee = computed(() => (this.subtotal() > 0 ? 1 : 0));

  protected readonly tax = computed(() => this.subtotal() * 0.08);

  protected readonly grandTotal = computed(() => this.total() + this.tax());

  ngOnInit(): void {
    this.cart.load().subscribe({
      next: (response) => {
        if (!response.success) {
          this.notification.error(response.message || 'Failed to load cart');
        }
      },
      error: () => {
        this.notification.error('Failed to load cart');
      }
    });
  }

  protected updateQuantity(itemId: string | number, newQuantity: number): void {
    if (newQuantity < 1) return;

    this.cart.updateItem(String(itemId), newQuantity).subscribe({
      next: (res) => {
        if (!res.success) {
          this.notification.error(res.message || 'Failed to update quantity');
        }
      },
      error: () => {
        this.notification.error('Failed to update quantity');
      }
    });
  }

  protected removeItem(itemId: string | number): void {
    this.cart.removeItem(String(itemId)).subscribe({
      next: (res) => {
        if (res.success) {
          this.notification.success('Item removed from cart');
        } else {
          this.notification.error(res.message || 'Failed to remove item');
        }
      },
      error: () => {
        this.notification.error('Failed to remove item');
      }
    });
  }

  protected onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = '/placeholder.svg';
  }

  protected proceedToCheckout(): void {
    if (this.cart.items().length === 0) {
      this.notification.warning('Your cart is empty');
      return;
    }
    this.router.navigate(['/checkout']);
  }
}
