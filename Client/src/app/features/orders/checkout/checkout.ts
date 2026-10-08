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
import { CurrencyPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Cart } from '../../../core/services/cart';
import { Order as OrderService } from '../../../core/services/order';
import { NotificationService } from '../../../shared/notification/notification.service';

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
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  protected readonly form: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    address: ['', [Validators.required, Validators.minLength(10)]],
    county: ['', [Validators.required]],
    phone: ['', [Validators.required, Validators.pattern(/^\+254\d{9}$/)]],
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
        this.notification.error('Failed to load cart');
      }
    });
  }

  protected placeOrder(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notification.warning('Please fill in all required fields');
      return;
    }

    if (this.cart.items().length === 0) {
      this.notification.warning('Your cart is empty');
      return;
    }

    const { firstName, lastName, address, county, phone, paymentMethod } = this.form.value;
    const orderData = {
      recipientName: `${firstName} ${lastName}`.trim(),
      deliveryAddress: `${address}, ${county}`,
      phone,
      paymentMethod,
    };

    this.cart.syncMockCartForCheckout().subscribe({
      next: () => this.orderService.create(orderData).subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.cart.resetAfterCheckout();
            const message = paymentMethod === 'CASH'
              ? 'Order placed successfully. Payment is due on delivery.'
              : 'Order placed successfully. Payment is pending.';
            this.notification.success(message);
            this.router.navigate(['/orders']);
          } else {
            this.notification.error(res.message || 'Failed to place order');
          }
        },
        error: () => {
          this.notification.error('Failed to place order');
        },
      }),
      error: (error: Error) => {
        this.notification.error(error.message || 'Could not prepare cart for checkout');
      },
    });
  }

}
