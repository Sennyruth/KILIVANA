import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Auth } from '../../../core/services/auth';
import { Order } from '../../../core/services/order';
import { Product } from '../../../core/services/product';
import { NotificationService } from '../../../shared/notification/notification.service';
import { SupplierDashboard } from './supplier-dashboard';

describe('SupplierDashboard', () => {
  let component: SupplierDashboard;
  let fixture: ComponentFixture<SupplierDashboard>;
  let loadSellerOrders: ReturnType<typeof vi.fn>;
  let loadSellerProducts: ReturnType<typeof vi.fn>;
  let notificationError: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    notificationError = vi.fn();
    loadSellerOrders = vi.fn(() =>
      of({ success: true, message: 'Success', data: [] }),
    );
    loadSellerProducts = vi.fn(() =>
      of({ success: true, message: 'Success', data: [] }),
    );

    await TestBed.configureTestingModule({
      imports: [SupplierDashboard],
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: {
            user: signal({ id: '3', name: 'Test Supplier', role: 'SUPPLIER' }),
            name: signal('Test Supplier'),
          },
        },
        {
          provide: Order,
          useValue: { loadSellerOrders },
        },
        {
          provide: Product,
          useValue: {
            products: signal([]),
            loading: signal(false),
            loadSellerProducts,
          },
        },
        {
          provide: NotificationService,
          useValue: { error: notificationError },
        },
      ],
    }).compileComponents();
  });

  async function createDashboardFixture(): Promise<void> {
    fixture = TestBed.createComponent(SupplierDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  it('should create', async () => {
    await createDashboardFixture();
    expect(component).toBeTruthy();
  });

  it('provides direct links to the supplier orders page from the dashboard', async () => {
    await createDashboardFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const links = Array.from(
      fixture.nativeElement.querySelectorAll('a[routerLink="/dashboard/supplier/orders"]'),
    ) as HTMLAnchorElement[];
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(fixture.nativeElement.textContent).toContain('View Orders');
    expect(fixture.nativeElement.textContent).toContain('View all');
    expect(loadSellerOrders).toHaveBeenCalledOnce();
  });

  it('shows the browse-inputs link on the dashboard header', async () => {
    await createDashboardFixture();
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('.dashboard__browse-inputs') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/inputs');
  });

  it('does not show an orders toast while loading the dashboard', async () => {
    loadSellerOrders.mockReturnValue(throwError(() => new Error('Request failed')));
    await createDashboardFixture();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(notificationError).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('Failed to load orders');
  });

  it('shows supply and orders empty states without decorative icons', async () => {
    await createDashboardFixture();
    fixture.detectChanges();
    const cards = Array.from(
      fixture.nativeElement.querySelectorAll('.dashboard__card'),
    ) as HTMLElement[];
    const ordersCard = cards.find((card) =>
      card.querySelector('.dashboard__card-title')?.textContent?.includes('Recent Orders'),
    );

    expect(fixture.nativeElement.querySelector('.dashboard__empty-icon')).toBeNull();
    expect(ordersCard?.querySelector('.dashboard__card-title mat-icon')).toBeNull();
    expect(ordersCard?.querySelector('.dashboard__empty mat-icon')).toBeNull();
  });
});
