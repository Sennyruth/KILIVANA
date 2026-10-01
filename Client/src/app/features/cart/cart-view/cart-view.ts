import { Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CurrencyPipe } from '@angular/common';
import { Cart } from '../../../core/services/cart';

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
  ],
  styleUrl: './cart-view.scss',
  templateUrl: './cart-view.html',
})
export class CartView implements OnInit {
  protected readonly cart = inject(Cart);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly subtotal = computed(() => this.cart.totalPrice());

  protected readonly total = computed(() => {
    const sub = this.subtotal();
    const delivery = sub > 0 ? 150 : 0;
    return sub + delivery;
  });

  protected readonly deliveryFee = computed(() => (this.subtotal() > 0 ? 150 : 0));

  protected readonly tax = computed(() => this.subtotal() * 0.08);

  protected readonly grandTotal = computed(() => this.total() + this.tax());

  ngOnInit(): void {
    this.cart.load().subscribe({
      error: () => {
        this.snackBar.open('Failed to load cart', 'Close', { duration: 3000 });
      }
    });
  }

  protected updateQuantity(itemId: string, newQuantity: number): void {
    if (newQuantity < 1) return;
    
    this.cart.updateItem(itemId, newQuantity).subscribe({
      next: (res) => {
        if (!res.success) {
          this.snackBar.open(res.message || 'Failed to update quantity', 'Close', { duration: 3000 });
        }
      },
      error: () => {
        this.snackBar.open('Failed to update quantity', 'Close', { duration: 3000 });
      }
    });
  }

  protected removeItem(itemId: string): void {
    this.cart.removeItem(itemId).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('Item removed from cart', 'Close', { duration: 2000 });
        } else {
          this.snackBar.open(res.message || 'Failed to remove item', 'Close', { duration: 3000 });
        }
      },
      error: () => {
        this.snackBar.open('Failed to remove item', 'Close', { duration: 3000 });
      }
    });
  }

  protected proceedToCheckout(): void {
    if (this.cart.items().length === 0) {
      this.snackBar.open('Your cart is empty', 'Close', { duration: 2000 });
      return;
    }
    this.router.navigate(['/checkout']);
  }
}
