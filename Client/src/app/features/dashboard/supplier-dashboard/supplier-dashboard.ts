import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Auth } from '../../../core/services/auth';
import { Order } from '../../../core/services/order';
import { Product } from '../../../core/services/product';
import { SellerLocationService } from '../../../core/services/seller-location';
import type { Product as ProductModel } from '../../../shared/product.model';
import type { SellerOrderSummary } from '../../../shared/order.model';
import { deliveryStatusLabel } from '../../../shared/order.model';
import type { SellerLocation, SellerLocationRequest } from '../../../shared/seller-location.model';
import { NotificationService } from '../../../shared/notification/notification.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-supplier-dashboard',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
  ],
  styleUrl: './supplier-dashboard.scss',
  templateUrl: './supplier-dashboard.html',
})
export class SupplierDashboard implements OnInit {
  protected readonly auth = inject(Auth);
  protected readonly orderService = inject(Order);
  protected readonly productService = inject(Product);
  protected readonly locationService = inject(SellerLocationService);
  private readonly router = inject(Router);
  private readonly notification = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  private readonly _orders = signal<SellerOrderSummary[]>([]);
  protected readonly ordersLoading = signal(false);
  protected readonly ordersError = signal<string | null>(null);
  protected readonly locations = signal<SellerLocation[]>([]);
  protected readonly locationsLoading = signal(false);
  protected readonly locationsSaving = signal(false);
  protected readonly locationsError = signal<string | null>(null);
  protected readonly editingLocationId = signal<string | number | null>(null);
  protected readonly locationFormOpen = signal(false);
  protected readonly locationForm = this.fb.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(255)]],
    address: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)]],
    county: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)]],
    latitude: [null as number | null, [Validators.required, Validators.min(-90), Validators.max(90)]],
    longitude: [null as number | null, [Validators.required, Validators.min(-180), Validators.max(180)]],
    contactName: ['', Validators.maxLength(255)],
    contactPhone: ['', Validators.maxLength(32)],
    operatingHours: ['', Validators.maxLength(255)],
  });
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

  @HostListener('window:focus')
  protected refreshOrdersOnFocus(): void {
    if (!this.ordersLoading()) this.loadOrders();
  }

  protected loadData(): void {
    this.loadOrders();
    this.loadSupplies();
    this.loadLocations();
  }

  protected loadLocations(): void {
    this.locationsLoading.set(true);
    this.locationsError.set(null);
    this.locationService.getMyLocations().pipe(
      finalize(() => this.locationsLoading.set(false)),
    ).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.locationsError.set(response.message || 'Could not load your warehouse locations.');
          return;
        }
        this.locations.set(response.data);
        if (!response.data.some((location) => location.active)) this.locationFormOpen.set(true);
      },
      error: (error: { error?: { message?: string } }) =>
        this.locationsError.set(error.error?.message || 'Could not load your warehouse locations. Try again.'),
    });
  }

  protected saveLocation(): void {
    if (this.locationForm.invalid || this.locationsSaving()) {
      this.locationForm.markAllAsTouched();
      return;
    }

    const value = this.locationForm.getRawValue();
    if (value.latitude === null || value.longitude === null) {
      this.locationForm.controls.latitude.markAsTouched();
      this.locationForm.controls.longitude.markAsTouched();
      return;
    }
    const request: SellerLocationRequest = {
      name: value.name?.trim() ?? '',
      address: value.address?.trim() ?? '',
      county: value.county?.trim() ?? '',
      latitude: value.latitude,
      longitude: value.longitude,
      contactName: value.contactName?.trim() || undefined,
      contactPhone: value.contactPhone?.trim() || undefined,
      operatingHours: value.operatingHours?.trim() || undefined,
    };
    const locationId = this.editingLocationId();
    this.locationsSaving.set(true);
    this.locationsError.set(null);
    const saveRequest = locationId === null
      ? this.locationService.createLocation(request)
      : this.locationService.updateLocation(locationId, request);

    saveRequest.pipe(finalize(() => this.locationsSaving.set(false))).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.locationsError.set(response.message || 'Could not save this warehouse location.');
          return;
        }
        this.locations.update((items) => {
          const index = items.findIndex((item) => item.id === response.data.id);
          if (index < 0) return [...items, response.data];
          return items.map((item, itemIndex) => itemIndex === index ? response.data : item);
        });
        this.cancelLocationEdit();
      },
      error: (error: { error?: { message?: string } }) =>
        this.locationsError.set(error.error?.message || 'Could not save this warehouse location. Try again.'),
    });
  }

  protected editLocation(location: SellerLocation): void {
    this.locationFormOpen.set(true);
    this.editingLocationId.set(location.id);
    this.locationsError.set(null);
    this.locationForm.patchValue({
      name: location.name,
      address: location.address,
      county: location.county,
      latitude: location.latitude,
      longitude: location.longitude,
      contactName: location.contactName ?? '',
      contactPhone: location.contactPhone ?? '',
      operatingHours: location.operatingHours ?? '',
    });
  }

  protected cancelLocationEdit(): void {
    this.editingLocationId.set(null);
    this.locationFormOpen.set(false);
    this.locationForm.reset({
      name: '',
      address: '',
      county: '',
      latitude: null,
      longitude: null,
      contactName: '',
      contactPhone: '',
      operatingHours: '',
    });
  }

  protected openLocationForm(): void {
    this.editingLocationId.set(null);
    this.locationFormOpen.set(true);
    this.locationForm.reset({
      name: '',
      address: '',
      county: '',
      latitude: null,
      longitude: null,
      contactName: '',
      contactPhone: '',
      operatingHours: '',
    });
  }

  protected setDefaultLocation(location: SellerLocation): void {
    if (!location.active || location.defaultLocation) return;
    this.locationsError.set(null);
    this.locationService.setDefaultLocation(location.id).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.locationsError.set(response.message || 'Could not set the default warehouse.');
          return;
        }
        this.locations.update((items) => items.map((item) => ({
          ...item,
          defaultLocation: item.id === response.data.id,
        })));
      },
      error: (error: { error?: { message?: string } }) =>
        this.locationsError.set(error.error?.message || 'Could not set the default warehouse. Try again.'),
    });
  }

  protected deactivateLocation(location: SellerLocation): void {
    if (!location.active || !window.confirm(`Deactivate "${location.name}"?`)) return;
    this.locationsError.set(null);
    this.locationService.deactivateLocation(location.id).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.locationsError.set(response.message || 'Could not deactivate this warehouse.');
          return;
        }
        if (this.editingLocationId() === location.id) this.cancelLocationEdit();
        this.loadLocations();
      },
      error: (error: { error?: { message?: string } }) =>
        this.locationsError.set(error.error?.message || 'Could not deactivate this warehouse. Try again.'),
    });
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

  protected statusLabel(status: string, deliveryStatus?: string | null): string {
    const dispatchLabel = deliveryStatusLabel(deliveryStatus);
    if (dispatchLabel) return dispatchLabel;
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
