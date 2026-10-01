import { Component, computed, inject, signal } from '@angular/core';
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

  protected readonly navLinks = [
    { label: 'Products', href: '/products' },
    { label: 'Inputs', href: '/inputs' },
    { label: 'Cart', href: '/cart' },
    { label: 'Orders', href: '/orders' },
  ];

  protected readonly dashboardHref = computed(() => {
    const r = this.auth.role();
    if (r === 'FARMER') return '/dashboard/farmer';
    if (r === 'SUPPLIER') return '/dashboard/supplier';
    return '/dashboard/buyer';
  });

  protected isActive(href: string): boolean {
    return this.router.url === href || this.router.url.startsWith(href + '/');
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
    this.auth.logout();
    this.router.navigate(['/products']);
  }
}