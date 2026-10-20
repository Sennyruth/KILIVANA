import { Component, computed, inject, OnInit } from '@angular/core';
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
import { NotificationService } from '../../../shared/notification/notification.service';

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
  private readonly notification = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  protected readonly form: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    address: ['', [Validators.required, Validators.minLength(10)]],
    county: ['', [Validators.required]],
    phone: ['', [Validators.required, Validators.pattern(/^\+254\d{9}$/)]],
  });

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
    this.notification.warning('Checkout is not available on the connected backend yet.');
  }

}
