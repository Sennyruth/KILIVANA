import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Product } from '../../../core/services/product';
import { Order } from '../../../core/services/order';
import type { Product as ProductModel, ProductStatus } from '../../../shared/product.model';
import type { SellerOrderSummary } from '../../../shared/order.model';
import { NotificationService } from '../../../shared/notification/notification.service';

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
  private readonly notification = inject(NotificationService);
  private readonly _orders = signal<SellerOrderSummary[]>([]);
  protected readonly ordersError = signal<string | null>(null);

  protected readonly products = computed(() => this.productService.products().filter(p => p.type === 'PRODUCE'));
  protected readonly loading = computed(() => this.productService.loading());
  protected readonly orders = this._orders.asReadonly();

  protected readonly totalProducts = computed(() => this.products().length);
  protected readonly activeProducts = computed(() => this.products().filter(p => p.available).length);
  protected readonly totalOrders = computed(() => this.orders().length);
  protected readonly pendingOrders = computed(() => this.orders().filter(o => o.status === 'PENDING').length);

  ngOnInit(): void {
    this.loadData();
  }

  protected loadData(): void {
    this.productService.loadSellerProducts().subscribe({
      error: (error: { message?: string }) => {
        this.notification.error(error.message || 'Failed to load products');
      }
    });
    this.loadOrders();
  }

  protected loadOrders(): void {
    this.ordersError.set(null);
    this.orderService.loadSellerOrders().subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.ordersError.set(response.message || 'Failed to load orders.');
          return;
        }
        this._orders.set(response.data);
      },
      error: () => this.ordersError.set('Failed to load orders. Please try again.'),
    });
  }

  protected addProduct(): void {
    this.router.navigate(['/dashboard/farmer/add-product']);
  }

  protected editProduct(productId: string): void {
    this.router.navigate(['/dashboard/farmer/edit-product', productId]);
  }

  protected canToggleProduct(product: ProductModel): boolean {
    return product.status === 'ACTIVE' || product.status === 'INACTIVE';
  }

  protected toggleProductAvailability(product: ProductModel): void {
    if (!this.canToggleProduct(product)) {
      this.notification.warning('Only approved products can be activated or deactivated');
      return;
    }

    const status: Extract<ProductStatus, 'ACTIVE' | 'INACTIVE'> =
      product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.productService.updateStatus(product.id, status).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notification.error(response.message || 'Failed to update product status');
          return;
        }
        this.notification.success('Product availability updated');
        this.refreshProducts();
      },
      error: (error: { error?: { message?: string } }) => {
        this.notification.error(error.error?.message || 'Failed to update product status');
      },
    });
  }

  protected deleteProduct(productId: string): void {
    const product = this.products().find((item) => item.id === productId);
    if (!product || !window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;

    this.productService.delete(productId).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notification.error(response.message || 'Failed to delete product');
          return;
        }
        this.notification.success('Product deleted');
        this.refreshProducts();
      },
      error: (error: { error?: { message?: string } }) => {
        this.notification.error(error.error?.message || 'Failed to delete product');
      },
    });
  }

  protected loadImage(product: ProductModel): string {
    const imgs = (product.images ?? []).filter((image) => !!image.url?.trim());
    if (imgs.length > 0) {
      const primary = imgs.find((image) => image.isPrimary);
      return primary?.url ?? imgs[0].url;
    }
    return '/placeholder.svg';
  }

  protected productStatusLabel(product: ProductModel): string {
    switch (product.status) {
      case 'ACTIVE':
        return 'Active';
      case 'INACTIVE':
        return 'Inactive';
      case 'OUT_OF_STOCK':
        return 'Out of stock';
      case 'REJECTED':
        return 'Rejected';
      default:
        return 'Pending approval';
    }
  }

  protected productStatusClass(product: ProductModel): string {
    switch (product.status) {
      case 'ACTIVE':
        return 'dashboard__status--active';
      case 'INACTIVE':
        return 'dashboard__status--inactive';
      case 'REJECTED':
        return 'dashboard__status--rejected';
      default:
        return 'dashboard__status--pending';
    }
  }

  protected onProductImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith('/placeholder.svg')) image.src = '/placeholder.svg';
  }

  private refreshProducts(): void {
    this.productService.loadSellerProducts().subscribe({
      error: (error: { message?: string }) =>
        this.notification.error(error.message || 'Failed to refresh products'),
    });
  }

  protected orderIdLabel(orderId: number): string {
    return String(orderId).slice(-8).toUpperCase();
  }

  protected viewOrder(orderId: number): void {
    this.router.navigate(['/orders']);
  }
}
