import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Auth } from '../../../core/services/auth';
import { Order } from '../../../core/services/order';
import { Product } from '../../../core/services/product';
import type { Product as ProductModel } from '../../../shared/product.model';

@Component({
  selector: 'app-supplier-dashboard',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    CurrencyPipe,
    DatePipe,
  ],
  styleUrl: './supplier-dashboard.scss',
  templateUrl: './supplier-dashboard.html',
})
export class SupplierDashboard implements OnInit {
  protected readonly auth = inject(Auth);
  protected readonly orderService = inject(Order);
  protected readonly productService = inject(Product);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly userName = this.auth.name;
  protected readonly orders = computed(() => this.orderService.orders());
  protected readonly loading = computed(() => this.orderService.loading());
  protected readonly products = computed(() => this.productService.products());
  protected readonly productsLoading = computed(() => this.productService.loading());

  protected readonly totalOrders = computed(() => this.orders().length);
  protected readonly pendingOrders = computed(() => this.orders().filter(o => o.status === 'PENDING').length);
  protected readonly packedOrders = computed(() => this.orders().filter(o => o.status === 'PACKED').length);
  protected readonly shippedOrders = computed(() => this.orders().filter(o => o.status === 'SHIPPED').length);
  protected readonly deliveredOrders = computed(() => this.orders().filter(o => o.status === 'DELIVERED').length);
  protected readonly totalRevenue = computed(() => this.orders().reduce((sum, o) => sum + (o.status === 'DELIVERED' ? o.total : 0), 0));
  protected readonly totalSupplies = computed(() => this.products().filter(p => p.type === 'INPUT').length);
  protected readonly activeSupplies = computed(() => this.products().filter(p => p.type === 'INPUT' && p.available).length);

  ngOnInit(): void {
    this.loadData();
  }

  protected loadData(): void {
    this.loadOrders();
    this.loadSupplies();
  }

  protected loadOrders(): void {
    this.orderService.loadAll().subscribe({
      error: () => {
        this.snackBar.open('Failed to load orders', 'Close', { duration: 3000 });
      }
    });
  }

  protected loadSupplies(): void {
    this.productService.loadAll().subscribe({
      error: () => {
        this.snackBar.open('Failed to load supplies', 'Close', { duration: 3000 });
      }
    });
  }

  protected addSupply(): void {
    this.router.navigate(['/dashboard/supplier/add-supply']);
  }

  protected editSupply(supplyId: string): void {
    this.router.navigate(['/dashboard/supplier/edit-supply', supplyId]);
  }

  protected toggleSupplyAvailability(supply: ProductModel): void {
    // This would call an API to toggle availability
    this.snackBar.open('Supply availability updated', 'Close', { duration: 2000 });
  }

  protected deleteSupply(supplyId: string): void {
    // This would call an API to delete the supply
    this.snackBar.open('Supply deleted', 'Close', { duration: 2000 });
  }

  protected viewOrder(orderId: string): void {
    this.router.navigate(['/orders']);
  }

  protected statusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'Pending',
      CONFIRMED: 'Confirmed',
      PACKED: 'Packed',
      SHIPPED: 'Shipped',
      OUT_FOR_DELIVERY: 'Out for Delivery',
      DELIVERED: 'Delivered',
      CANCELLED: 'Cancelled',
    };
    return labels[status] || status;
  }

  protected loadImage(supply: ProductModel): string {
    const imgs = supply.images ?? [];
    if (imgs.length > 0) {
      const primary = imgs.find((i) => i.isPrimary);
      return primary?.url ?? imgs[0]?.url ?? '/placeholder.svg';
    }
    return '/placeholder.svg';
  }
}
