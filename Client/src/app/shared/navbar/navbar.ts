import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatRippleModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Auth } from '../../core/services/auth';
import { Cart } from '../../core/services/cart';
import { Product } from '../../core/services/product';

@Component({
  selector: 'app-navbar',
  imports: [
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule,
    MatRippleModule,
    MatButtonModule,
    MatIconModule,
    NgOptimizedImage,
  ],
  styleUrl: './navbar.scss',
  templateUrl: './navbar.html',
})
export class Navbar {
  protected readonly auth = inject(Auth);
  protected readonly cart = inject(Cart);
  private readonly products = inject(Product);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly currentUrl = signal(this.router.url);
  protected readonly searchQuery = signal('');

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((event) => {
      this.currentUrl.set(event.urlAfterRedirects);
      this.searchQuery.set(this.router.parseUrl(event.urlAfterRedirects).queryParams['q'] ?? '');
    });

    effect((onCleanup) => {
      const user = this.auth.user();
      // Suppliers don't use the buyer basket.
      if (user && this.auth.isSupplier()) {
        this.cart.resetAfterLogout();
        return;
      }

      this.cart.resetAfterLogout();
      const subscription = this.cart.load().subscribe({
        next: (response) => {
          if (!response.success) {
            console.error(response.message || 'Failed to load cart');
          }
        },
        error: (error: unknown) => console.error('Failed to load cart', error),
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected readonly user = this.auth.user;
  protected readonly roleLabel = computed(() => {
    const r = this.auth.role();
    return r ? r.charAt(0) + r.slice(1).toLowerCase() : '';
  });
  protected readonly userInitials = computed(() => {
    const name = this.auth.user()?.name?.trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  });
  protected readonly itemCount = this.cart.itemCount;
  protected readonly mobileMenuOpen = signal(false);
  protected readonly produceCategories = computed(() => this.products.categories().filter((category) => category.type === 'FARMER'));
  protected readonly inputCategories = computed(() => this.products.categories().filter((category) => category.type === 'SUPPLIER'));
  protected readonly showSearch = computed(() => {
    const path = this.currentUrl().split(/[?#]/, 1)[0];
    return path === '/' || path === '/products' || path === '/inputs' ||
      path === '/dashboard/farmer' || path === '/dashboard/buyer' || path === '/dashboard/supplier';
  });
  protected readonly searchPlaceholder = computed(() =>
    this.currentUrl().includes('/dashboard/')
      ? 'Search dashboard products and orders'
      : 'Search products and farm inputs',
  );

  protected readonly firstName = computed(() => {
    const name = this.auth.user()?.name?.trim();
    return name ? name.split(/\s+/)[0] : 'there';
  });

  protected readonly showCart = computed(() => !this.auth.isSupplier());
  protected readonly showDashboardLink = computed(() => this.auth.isAuthenticated() && !this.auth.isSupplier());
  protected readonly navLinks = computed(() => {
    if (this.auth.isSupplier()) {
      return [
        { label: 'Dashboard', href: '/dashboard/supplier' },
        { label: 'Orders', href: '/dashboard/supplier/orders' },
      ];
    }

    if (this.auth.isFarmer()) {
      return [
        { label: 'Inputs', href: '/inputs' },
        { label: 'Cart', href: '/cart' },
        { label: 'Orders', href: '/orders' },
      ];
    }

    if (this.auth.isBuyer()) {
      return [
        { label: 'Products', href: '/products' },
        { label: 'Cart', href: '/cart' },
        { label: 'Orders', href: '/orders' },
      ];
    }

    return [
      { label: 'Home', href: '/' },
      { label: 'Shop Produce', href: '/products' },
      { label: 'Farm Supplies', href: '/inputs' },
      { label: 'Cart', href: '/cart' },
    ];
  });

  protected readonly dashboardHref = computed(() => {
    const r = this.auth.role();
    if (r === 'FARMER') return '/dashboard/farmer';
    if (r === 'SUPPLIER') return '/dashboard/supplier';
    return '/dashboard/buyer';
  });

  protected onSearchInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery.set(query);
    if (query.trim()) return;

    const path = this.currentUrl().split(/[?#]/, 1)[0];
    if ((path === '/products' || path === '/inputs' || path.startsWith('/dashboard/')) &&
        this.router.parseUrl(this.currentUrl()).queryParams['q']) {
      void this.router.navigate([path]);
    }
  }

  protected search(event: SubmitEvent): void {
    event.preventDefault();
    const query = this.searchQuery().trim();
    const path = this.currentUrl().split(/[?#]/, 1)[0];
    const target = path.startsWith('/dashboard/') ? path : path === '/inputs' ? '/inputs' : '/products';
    void this.router.navigate([target], {
      queryParams: query ? { q: query } : {},
    });
  }

  protected isActive(href: string): boolean {
    const currentUrl = this.router.url;
    if (currentUrl === href) return true;
    
    // Only use startsWith if the current URL doesn't exactly match any other link
    const otherLinks = this.navLinks().map(l => l.href);
    const hasExactMatch = otherLinks.some(link => link === currentUrl);
    
    if (!hasExactMatch) {
      return currentUrl.startsWith(href + '/');
    }
    
    return false;
  }

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen.update((v) => !v);
  }

  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  protected login(): void {
    this.closeMobileMenu();
    this.router.navigate(['/login']);
  }

  protected register(): void {
    this.closeMobileMenu();
    this.router.navigate(['/register']);
  }

  protected logout(): void {
    this.closeMobileMenu();
    this.router.navigate(['/logout']);
  }
}
