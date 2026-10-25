import { Component, computed, effect, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatRippleModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Auth } from '../../core/services/auth';
import { Cart } from '../../core/services/cart';

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
  private readonly router = inject(Router);

  constructor() {
    effect((onCleanup) => {
      const user = this.auth.user();
      if (!user || (!this.auth.isBuyer() && !this.auth.isFarmer())) {
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

  protected readonly canShop = computed(() => this.auth.isBuyer() || this.auth.isFarmer());
  protected readonly showDashboardLink = computed(() => !this.auth.isSupplier());
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
        { label: 'Orders', href: '/dashboard/farmer' },
      ];
    }

    const links = [{ label: 'Products', href: '/products' }];
    if (this.auth.isBuyer()) {
      links.push({ label: 'Cart', href: '/cart' }, { label: 'Orders', href: '/orders' });
    }
    return links;
  });

  protected readonly dashboardHref = computed(() => {
    const r = this.auth.role();
    if (r === 'FARMER') return '/dashboard/farmer';
    if (r === 'SUPPLIER') return '/dashboard/supplier';
    return '/dashboard/buyer';
  });

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

  protected logout(): void {
    this.closeMobileMenu();
    this.router.navigate(['/logout']);
  }
}
