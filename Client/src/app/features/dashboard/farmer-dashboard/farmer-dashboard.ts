import { Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Product } from '../../../core/services/product';
import { Order } from '../../../core/services/order';

@Component({
  selector: 'app-farmer-dashboard',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    CurrencyPipe,
    DatePipe,
  ],
  styleUrl: './farmer-dashboard.scss',
  templateUrl: './farmer-dashboard.html',
})
export class FarmerDashboard implements OnInit {
  protected readonly productService = inject(Product);
  protected readonly orderService = inject(Order);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly products = computed(() => this.productService.products().filter(p => p.type === 'PRODUCE'));
  protected readonly loading = computed(() => this.productService.loading());
  protected readonly orders = computed(() => this.orderService.orders());

  protected readonly totalProducts = computed(() => this.products().length);
  protected readonly activeProducts = computed(() => this.products().filter(p => p.available).length);
  protected readonly totalOrders = computed(() => this.orders().length);
  protected readonly pendingOrders = computed(() => this.orders().filter(o => o.status === 'PENDING').length);

  ngOnInit(): void {
    this.loadData();
  }

  protected loadData(): void {
    this.productService.loadAll().subscribe({
      error: () => {
        this.snackBar.open('Failed to load products', 'Close', { duration: 3000 });
      }
    });
    this.orderService.loadAll().subscribe({
      error: () => {
        this.snackBar.open('Failed to load orders', 'Close', { duration: 3000 });
      }
    });
  }

  protected addProduct(): void {
    this.router.navigate(['/dashboard/farmer/add-product']);
  }

  protected editProduct(productId: string): void {
    this.router.navigate(['/dashboard/farmer/edit-product', productId]);
  }

  protected toggleProductAvailability(product: any): void {
    // This would call an API to toggle availability
    this.snackBar.open('Product availability updated', 'Close', { duration: 2000 });
  }

  protected deleteProduct(productId: string): void {
    // This would call an API to delete the product
    this.snackBar.open('Product deleted', 'Close', { duration: 2000 });
  }

  protected loadImage(product: any): string {
    const imgs = product.images ?? [];
    if (imgs.length > 0) {
      const primary = imgs.find((i: any) => i.isPrimary);
      return primary?.url ?? imgs[0]?.url ?? '/placeholder.svg';
    }
    return '/placeholder.svg';
  }

  protected viewOrder(orderId: string): void {
    this.router.navigate(['/orders']);
  }
}
