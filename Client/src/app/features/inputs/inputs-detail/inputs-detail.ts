import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurrencyPipe } from '@angular/common';
import { Product } from '../../../core/services/product';
import { Cart } from '../../../core/services/cart';
import { NotificationService } from '../../../shared/notification/notification.service';

@Component({
  selector: 'app-inputs-detail',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    CurrencyPipe,
  ],
  styleUrl: './inputs-detail.scss',
  templateUrl: './inputs-detail.html',
})
export class InputsDetail implements OnInit {
  protected readonly productService = inject(Product);
  protected readonly cartService = inject(Cart);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);

  protected readonly inputId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly input = computed(() => this.productService.products().find(p => p.id === this.inputId));
  protected readonly loading = computed(() => this.productService.loading());
  protected readonly isLoading = signal(true);

  ngOnInit(): void {
    this.loadInput();
  }

  private loadInput(): void {
    this.productService.getById(this.inputId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.isLoading.set(false);
        } else {
          this.notification.error(res.message || 'Failed to load input');
          this.router.navigate(['/inputs']);
        }
      },
      error: () => {
        this.notification.error('Failed to load input');
        this.router.navigate(['/inputs']);
      },
    });
  }

  protected addToCart(): void {
    const currentInput = this.input();
    if (!currentInput) return;

    if (!currentInput.available || currentInput.quantity === 0) {
      this.notification.warning('Input is out of stock');
      return;
    }

    this.cartService.addItem(currentInput, 1).subscribe({
      next: (res) => {
        if (res.success) {
          this.notification.success('Added to cart!');
        } else {
          this.notification.error(res.message || 'Failed to add to cart');
        }
      },
      error: (error) => {
        this.notification.error(error.error?.message || error.error?.error || error.message || 'Failed to add to cart');
      }
    });
  }

  protected goBack(): void {
    this.router.navigate(['/inputs']);
  }
}
