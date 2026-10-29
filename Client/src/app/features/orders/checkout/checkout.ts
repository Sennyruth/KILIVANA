import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurrencyPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Cart } from '../../../core/services/cart';
import { Auth } from '../../../core/services/auth';
import { HttpService } from '../../../core/services/http';
import { Order } from '../../../core/services/order';
import { Payment } from '../../../core/services/payment';
import { Product } from '../../../core/services/product';
import { ApiEndpoints } from '../../../shared/api.config';
import { NotificationService } from '../../../shared/notification/notification.service';

interface AddressResponse {
  id: number;
}

@Component({
  selector: 'app-checkout',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatListModule,
    MatProgressSpinnerModule,
    CurrencyPipe,
    ReactiveFormsModule,
    RouterLink,
  ],
  styleUrl: './checkout.scss',
  templateUrl: './checkout.html',
})
export class Checkout implements OnInit {
  protected readonly cart = inject(Cart);
  private readonly auth = inject(Auth);
  private readonly http = inject(HttpService);
  private readonly orderService = inject(Order);
  private readonly payment = inject(Payment);
  private readonly productService = inject(Product);
  private readonly notification = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  protected readonly submitting = signal(false);
  protected readonly paymentMessage = signal<string | null>(null);
  protected readonly paymentState = signal<'idle' | 'pending' | 'paid' | 'failed'>('idle');
  private readonly savedAddressId = signal<number | null>(null);
  protected readonly pendingOrderId = signal<number | null>(null);

  protected readonly form: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    address: ['', [Validators.required, Validators.minLength(10)]],
    county: ['', [Validators.required]],
    phone: ['', [Validators.required, Validators.pattern(/^\+254[17]\d{8}$/)]],
  });

  protected readonly subtotal = computed(() => this.cart.totalPrice());
  protected readonly delivery = computed(() => (this.cart.totalPrice() > 0 ? 1 : 0));
  protected readonly total = computed(() => this.subtotal() + this.delivery());

  ngOnInit(): void {
    this.cart.load().subscribe({
      error: () => {
        this.notification.error('Failed to load cart');
      }
    });
  }

  protected placeOrder(): void {
    if (this.form.invalid || this.cart.items().length === 0 || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    const buyerId = Number(this.auth.user()?.id);
    if (!Number.isSafeInteger(buyerId) || buyerId <= 0) {
      this.notification.error('Please sign in again before placing your order.');
      return;
    }

    this.submitting.set(true);
    this.paymentMessage.set(null);
    const continueWithPayment = (orderId: number): void => this.startBuyerPayment(orderId);
    const existingOrderId = this.pendingOrderId();
    if (existingOrderId) {
      continueWithPayment(existingOrderId);
      return;
    }

    const value = this.form.getRawValue();
    const createOrder = (addressId: number): void => {
      this.savedAddressId.set(addressId);
      this.orderService.create({
        buyerId,
        addressId,
        items: this.cart.items().map((item) => ({
          productId: Number(item.productId),
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        deliveryFee: this.delivery(),
        subtotal: this.subtotal(),
        total: this.total(),
      }).subscribe({
        next: (response) => {
          if (!response.success || !response.data) {
            this.submitting.set(false);
            this.notification.error(response.message || 'We could not place your order.');
            return;
          }
          this.pendingOrderId.set(response.data.id);
          const orderedItems = this.cart.items().map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          }));
          this.productService.applyStockReservation(orderedItems);
          this.cart.clear().subscribe();
          continueWithPayment(response.data.id);
        },
        error: (error) => {
          this.submitting.set(false);
          this.notification.error(error?.error?.message || 'We could not place your order. Please try again.');
        },
      });
    };

    const addressId = this.savedAddressId();
    if (addressId) {
      createOrder(addressId);
      return;
    }

    this.http.post<AddressResponse>(ApiEndpoints.USERS.CREATE_OWN_ADDRESS, {
      label: `${value.firstName} ${value.lastName}`.trim(),
      addressText: `${value.address}, ${value.county}`,
    }).subscribe({
      next: (response) => {
        if (!response.success || !response.data?.id) {
          this.submitting.set(false);
          this.notification.error(response.message || 'We could not save your delivery address.');
          return;
        }
        createOrder(response.data.id);
      },
      error: (error) => {
        this.submitting.set(false);
        this.notification.error(error?.error?.message || 'We could not save your delivery address.');
      },
    });
  }

  protected retryPayment(): void {
    const orderId = this.pendingOrderId();
    if (!orderId || this.submitting()) return;
    this.paymentState.set('idle');
    this.submitting.set(true);
    this.startBuyerPayment(orderId);
  }

  private startBuyerPayment(orderId: number): void {
    const phoneNumber = String(this.form.get('phone')?.value ?? '').replace(/^\+/, '');
    this.payment.initiateMpesa('buyer', { orderId, phoneNumber }).subscribe({
      next: (response) => {
        this.submitting.set(false);
        if (!response.success || !response.data) {
          this.paymentState.set('failed');
          this.paymentMessage.set(response.message || 'Your order was placed, but the M-Pesa prompt could not be sent.');
          this.notification.error(this.paymentMessage()!);
          return;
        }

        const darajaResponse = response.data.darajaResponse;
        if (darajaResponse?.responseCode !== '0') {
          this.paymentState.set('failed');
          const message = darajaResponse?.customerMessage
            || darajaResponse?.responseDescription
            || 'Daraja did not confirm the M-Pesa prompt. Check the phone number and try again.';
          this.paymentMessage.set(message);
          this.notification.error(message);
          return;
        }

        this.paymentState.set('pending');
        this.paymentMessage.set('M-Pesa prompt sent. Enter your PIN on your phone to approve the payment.');
        this.payment.pollStatus(response.data.paymentId).subscribe({
          next: (status) => {
            if (status.paymentStatus === 'PAID' || status.paymentStatus === 'HELD' || status.paymentStatus === 'SETTLED') {
              this.paymentState.set('paid');
              this.paymentMessage.set('Payment received. Your order is confirmed.');
              this.notification.success('M-Pesa payment received.');
            } else if (status.paymentStatus === 'FAILED' || status.paymentStatus === 'REFUNDED') {
              this.paymentState.set('failed');
              this.paymentMessage.set('The payment was not completed. Contact the seller to retry payment for this order.');
              this.notification.error(this.paymentMessage()!);
            }
          },
          error: () => {
            this.paymentMessage.set('The M-Pesa prompt was sent. We could not refresh its status; check your orders shortly.');
          },
        });
      },
      error: (error) => {
        this.submitting.set(false);
        this.paymentState.set('failed');
        const message = error?.error?.message || 'Your order was placed, but the M-Pesa prompt could not be sent. Try again.';
        this.paymentMessage.set(message);
        this.notification.error(message);
      },
    });
  }

}
