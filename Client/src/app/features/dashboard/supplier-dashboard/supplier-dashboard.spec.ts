import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
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

  beforeEach(async () => {
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
          useValue: { error: vi.fn() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SupplierDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('provides direct links to the supplier orders page from the dashboard', async () => {
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

  it('shows the browse-inputs link on the dashboard header', () => {
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('.dashboard__browse-inputs') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/inputs');
  });
});
