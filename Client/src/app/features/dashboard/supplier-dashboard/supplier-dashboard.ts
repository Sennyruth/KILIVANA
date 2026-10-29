import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Auth } from '../../../core/services/auth';
import { Order } from '../../../core/services/order';
import { Product } from '../../../core/services/product';
import type { Product as ProductModel } from '../../../shared/product.model';
import type { SellerOrderSummary } from '../../../shared/order.model';
import { NotificationService } from '../../../shared/notification/notification.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-supplier-dashboard',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    RouterLink,
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
  private readonly notification = inject(NotificationService);
  private readonly _orders = signal<SellerOrderSummary[]>([]);
  protected readonly ordersLoading = signal(false);
  protected readonly ordersError = signal<string | null>(null);
  private readonly _selectedCategory = signal<string>('ALL');

  protected readonly userName = this.auth.name;
  protected readonly orders = this._orders.asReadonly();
  protected readonly selectedCategory = this._selectedCategory.asReadonly();
  
  protected readonly allProducts = computed(() => {
    const supplierId = Number(this.auth.user()?.id);
    return this.productService.products().filter(
      (product) => Number(product.farmerId) === supplierId,
    );
  });
  
  protected readonly products = computed(() => {
    const category = this._selectedCategory();
    if (category === 'ALL') {
      return this.allProducts();
    }
    return this.allProducts().filter(p => p.category === category);
  });
  
  protected readonly productsLoading = computed(() => this.productService.loading());
  
  protected readonly categories = computed(() => {
    const cats = new Set<string>(this.allProducts().map(p => p.category));
    return Array.from(cats).sort();
  });

  protected readonly totalOrders = computed(() => this.orders().length);
  protected readonly pendingOrders = computed(() => this.orders().filter(o => o.status === 'PENDING').length);
  protected readonly packedOrders = computed(() => this.orders().filter(o => o.status === 'PACKED').length);
  protected readonly shippedOrders = computed(() => this.orders().filter(o => o.status === 'SHIPPED').length);
  protected readonly deliveredOrders = computed(() => this.orders().filter(o => o.status === 'DELIVERED').length);
  protected readonly totalRevenue = computed(() => this.orders().reduce((sum, o) => sum + (o.status === 'DELIVERED' ? o.total : 0), 0));
  protected readonly totalSupplies = computed(() => this.allProducts().length);
  protected readonly activeSupplies = computed(() => this.allProducts().filter(p => p.available).length);
  protected readonly filteredSuppliesCount = computed(() => this.products().length);

  ngOnInit(): void {
    this.loadData();
  }

  protected loadData(): void {
    this.loadOrders();
    this.loadSupplies();
  }

  protected loadOrders(): void {
    this.ordersLoading.set(true);
    this.ordersError.set(null);
    this.orderService.loadSupplierOrders().pipe(
      finalize(() => this.ordersLoading.set(false)),
    ).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.ordersError.set(response.message || 'Orders cannot be listed for suppliers by the connected backend yet.');
          return;
        }
        this._orders.set(response.data);
      },
      error: () => this.ordersError.set('Orders cannot be listed for suppliers by the connected backend yet.'),
    });
  }

  protected loadSupplies(): void {
    this.productService.loadSellerProducts().subscribe({
      next: (response) => {
        if (!response.success) {
          this.notification.error(response.message || 'Failed to load supplies');
        }
      },
      error: (error: { message?: string }) => {
        this.notification.error(error.message || 'Failed to load supplies');
      }
    });
  }

  protected addSupply(): void {
    this.router.navigate(['/dashboard/supplier/add-supply']);
  }

  protected editSupply(supplyId: string): void {
    this.router.navigate(['/dashboard/supplier/edit-supply', supplyId]);
  }

  protected deleteSupply(supplyId: string): void {
    const supply = this.products().find((item) => item.id === supplyId);
    if (!supply || !window.confirm(`Delete "${supply.name}"? This cannot be undone.`)) return;

    this.productService.delete(supplyId).subscribe({
      next: (response) => {
        if (!response.success) {
          this.notification.error(response.message || 'Failed to delete supply');
          return;
        }
        this.notification.success('Supply deleted');
        this.loadSupplies();
      },
      error: (error: { error?: { message?: string } }) => {
        this.notification.error(error.error?.message || 'Failed to delete supply');
      },
    });
  }

  protected supplyStatusLabel(supply: ProductModel): string {
    if (supply.status === 'ACTIVE' && supply.quantity <= 0) return 'Out of stock';
    switch (supply.status) {
      case 'ACTIVE':
        return 'Active';
      case 'REJECTED':
        return 'Rejected';
      case 'SUSPENDED':
        return 'Suspended';
      default:
        return 'Pending approval';
    }
  }

  protected supplyStatusClass(supply: ProductModel): string {
    if (supply.status === 'ACTIVE' && supply.quantity <= 0) return 'dashboard__status--unavailable';
    switch (supply.status) {
      case 'ACTIVE':
        return 'dashboard__status--active';
      case 'REJECTED':
        return 'dashboard__status--rejected';
      case 'SUSPENDED':
        return 'dashboard__status--rejected';
      default:
        return 'dashboard__status--pending';
    }
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

  protected orderIdLabel(orderId: number): string {
    return String(orderId).slice(-8).toUpperCase();
  }

  protected loadImage(supply: ProductModel): string {
    const imgs = (supply.images ?? []).filter((image) => !!image.url?.trim());
    if (imgs.length > 0) {
      const primary = imgs.find((i) => i.isPrimary);
      return primary?.url ?? imgs[0].url;
    }
    return '/placeholder.svg';
  }

  protected onSupplyImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith('/placeholder.svg')) image.src = '/placeholder.svg';
  }

  protected selectCategory(category: string): void {
    this._selectedCategory.set(category);
  }

  protected categoryLabel(category: string): string {
    if (category === 'ALL') return 'All Categories';
    return category;
  }
}
