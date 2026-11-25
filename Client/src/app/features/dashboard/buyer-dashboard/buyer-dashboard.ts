import { Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { CurrencyPipe, DatePipe, NgOptimizedImage } from '@angular/common';
import { Auth } from '../../../core/services/auth';
import { Order } from '../../../core/services/order';
import { Product } from '../../../core/services/product';
import { Cart } from '../../../core/services/cart';
import { ProductCard } from '../../../shared/product-card/product-card';
import type { OrderStatus } from '../../../shared/order.model';
import { deliveryStatusLabel } from '../../../shared/order.model';
import type { Product as ProductModel } from '../../../shared/product.model';
import { NotificationService } from '../../../shared/notification/notification.service';
import { OrderProgress } from '../../orders/order-history/order-progress/order-progress';

@Component({
  selector: 'app-buyer-dashboard',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    CurrencyPipe,
    DatePipe,
    NgOptimizedImage,
    ProductCard,
    OrderProgress,
  ],
  styleUrl: './buyer-dashboard.scss',
  templateUrl: './buyer-dashboard.html',
})
export class BuyerDashboard implements OnInit {
  protected readonly auth = inject(Auth);
  protected readonly order = inject(Order);
  protected readonly productService = inject(Product);
  protected readonly cartService = inject(Cart);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);

  protected readonly userName = this.auth.name;
  protected readonly dashboardSearch = signal('');
  protected readonly orders = this.order.orders;
  protected readonly loading = this.order.loading;
  protected readonly error = this.order.error;
  private readonly _selectedCategory = signal<string>('ALL');
  protected readonly selectedCategory = this._selectedCategory.asReadonly();
  
  protected readonly allProducts = computed(() => 
    this.productService.products().filter(p => p.type === 'PRODUCE')
  );
  
  protected readonly products = computed(() => {
    const category = this._selectedCategory();
    const query = this.dashboardSearch().trim().toLowerCase();
    if (category === 'ALL') {
      return this.allProducts().filter((product) => this.matchesProduct(product, query));
    }
    return this.allProducts().filter(p => p.category === category && this.matchesProduct(p, query));
  });
  
  protected readonly productsLoading = computed(() => this.productService.loading());
  
  protected readonly categories = computed(() => {
    const cats = new Set<string>(this.allProducts().map(p => p.category));
    return Array.from(cats).sort();
  });

  protected readonly stats = computed(() => {
    const items = this.orders();
    const count = (status: OrderStatus) =>
      items.filter((o) => o.status === status).length;
    return {
      total: items.length,
      pending: count('PENDING'),
      confirmed: count('CONFIRMED'),
      packed: count('PACKED'),
      shipped: count('SHIPPED'),
      outForDelivery: count('OUT_FOR_DELIVERY'),
      delivered: count('DELIVERED'),
      cancelled: count('CANCELLED'),
    };
  });

  protected readonly recentOrders = computed(() => {
    const query = this.dashboardSearch().trim().toLowerCase();
    return this.orders().filter((order) => !query ||
      order.id.toLowerCase().includes(query) ||
      order.status.toLowerCase().includes(query) ||
      order.items.some((item) => item.name.toLowerCase().includes(query)),
    ).slice(0, 5);
  });

  protected readonly hasOrders = computed(() => this.orders().length > 0);

  protected readonly showContent = computed(
    () => !this.loading() && !this.error(),
  );

  private matchesProduct(product: ProductModel, query: string): boolean {
    return !query || [product.name, product.description, product.category].some((value) => value.toLowerCase().includes(query));
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.dashboardSearch.set(params.get('q') ?? '');
    });
    this.loadOrders();
    this.loadProducts();
  }

  @HostListener('window:focus')
  protected refreshOrdersOnFocus(): void {
    if (!this.order.loading()) this.loadOrders();
    if (!this.productService.loading()) this.loadProducts();
  }

  protected loadOrders(): void {
    const buyerId = this.auth.user()?.id;
    if (!buyerId || !/^\d+$/.test(buyerId)) {
      this.notification.error('Could not identify your buyer account. Please sign in again.');
      return;
    }

    this.order.loadMine(buyerId).subscribe({
      error: () => {
        this.notification.error('Failed to load orders');
      }
    });
  }

  protected loadProducts(): void {
    this.productService.loadAll().subscribe({
      error: () => {
        this.notification.error('Failed to load products');
      }
    });
  }

  protected statusLabel(status: OrderStatus, deliveryStatus?: string | null): string {
    const dispatchLabel = deliveryStatusLabel(deliveryStatus);
    if (dispatchLabel) return dispatchLabel;
    return this.order.statusLabel(status);
  }

  protected statusClass(status: OrderStatus): string {
    switch (status) {
      case 'PENDING':
        return 'order-status order-status--pending';
      case 'CONFIRMED':
        return 'order-status order-status--confirmed';
      case 'PACKED':
        return 'order-status order-status--packed';
      case 'SHIPPED':
        return 'order-status order-status--shipped';
      case 'OUT_FOR_DELIVERY':
        return 'order-status order-status--out-for-delivery';
      case 'DELIVERED':
        return 'order-status order-status--delivered';
      case 'CANCELLED':
        return 'order-status order-status--cancelled';
      default:
        return 'order-status';
    }
  }

  protected selectCategory(category: string): void {
    this._selectedCategory.set(category);
  }

  protected categoryLabel(category: string): string {
    if (category === 'ALL') return 'All Categories';
    return category;
  }

  protected addToCart(product: ProductModel, quantity = 1): void {
    if (!product.available || product.quantity === 0) {
      this.notification.warning('Product is out of stock');
      return;
    }

    this.cartService.addItem(product, quantity).subscribe({
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

  protected buyNow(product: ProductModel, quantity: number): void {
    if (!product.available || product.quantity < quantity) {
      this.notification.warning('The requested quantity is not available');
      return;
    }

    this.cartService.addItem(product, quantity).subscribe({
      next: (res) => {
        if (!res.success) {
          this.notification.error(res.message || 'Could not prepare this item for checkout');
          return;
        }
        void this.router.navigate(['/checkout']);
      },
      error: (error) => this.notification.error(error.error?.message || error.message || 'Could not prepare checkout'),
    });
  }
}
