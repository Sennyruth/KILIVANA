import { Component, computed, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CurrencyPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Cart } from '../../../core/services/cart';
import { Order as OrderService } from '../../../core/services/order';
import { Payment } from '../../../core/services/payment';

@Component({
  selector: 'app-checkout',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatRadioModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatListModule,
    MatProgressSpinnerModule,
    CurrencyPipe,
    ReactiveFormsModule,
  ],
  styleUrl: './checkout.scss',
  templateUrl: './checkout.html',
})
export class Checkout implements OnInit {
  protected readonly cart = inject(Cart);
  private readonly orderService = inject(OrderService);
  private readonly paymentService = inject(Payment);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  protected readonly form: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    address: ['', [Validators.required, Validators.minLength(10)]],
    county: ['', [Validators.required]],
    phone: ['', [Validators.required, Validators.pattern(/^\+254\d{9}$/)]],
    mpesaPhone: ['', [Validators.pattern(/^\+254\d{9}$/)]],
    paymentMethod: ['MPESA', [Validators.required]],
  });

  protected readonly loading = computed(() => this.orderService.loading());

  protected readonly subtotal = computed(() => this.cart.totalPrice());
  protected readonly delivery = computed(() => (this.cart.totalPrice() > 0 ? 150 : 0));
  protected readonly tax = computed(() => this.cart.totalPrice() * 0.08);
  protected readonly total = computed(() => this.subtotal() + this.delivery() + this.tax());

  ngOnInit(): void {
    this.cart.load().subscribe({
      error: () => {
        this.snackBar.open('Failed to load cart', 'Close', { duration: 3000 });
      }
    });
  }

  protected placeOrder(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Please fill in all required fields', 'Close', { duration: 3000 });
      return;
    }

    if (this.cart.items().length === 0) {
      this.snackBar.open('Your cart is empty', 'Close', { duration: 3000 });
      return;
    }

    const { address, county, phone, paymentMethod } = this.form.value;

    const orderData = {
      items: this.cart.items().map(({ productId, quantity }) => ({ productId, quantity })),
      deliveryAddress: `${address}, ${county}`,
      phone,
      paymentMethod,
    };

    this.orderService.create(orderData).subscribe({
      next: (res) => {
        if (res.success && res.data?.order) {
          if (paymentMethod === 'MPESA') {
            this.initiateMpesaPayment(res.data.order.id, res.data.order.total);
          } else {
            this.snackBar.open('Order placed successfully!', 'Close', { duration: 3000 });
            this.router.navigate(['/orders']);
          }
        } else {
          this.snackBar.open(res.message || 'Failed to place order', 'Close', { duration: 5000 });
        }
      },
      error: () => {
        this.snackBar.open('Failed to place order', 'Close', { duration: 5000 });
      },
    });
  }

  private initiateMpesaPayment(orderId: string, amount: number): void {
    const { mpesaPhone } = this.form.value;
    this.paymentService.initiateMpesa({ orderId, phone: mpesaPhone, amount }).subscribe({
      next: (res) => {
        if (res.success) {
          this.snackBar.open('Please complete M-Pesa payment on your phone', 'Close', { duration: 5000 });
          this.router.navigate(['/orders']);
        } else {
          this.snackBar.open(res.message || 'Failed to initiate payment', 'Close', { duration: 5000 });
        }
      },
      error: () => {
        this.snackBar.open('Failed to initiate payment', 'Close', { duration: 5000 });
      },
    });
  }
}
