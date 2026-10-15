import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Product } from '../../../core/services/product';
import { Order } from '../../../core/services/order';
import { NotificationService } from '../../../shared/notification/notification.service';
import { FarmerDashboard } from './farmer-dashboard';

describe('FarmerDashboard', () => {
  let component: FarmerDashboard;
  let fixture: ComponentFixture<FarmerDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FarmerDashboard],
      providers: [
        provideRouter([]),
        {
          provide: Product,
          useValue: {
            products: signal([]),
            loading: signal(false),
            loadSellerProducts: () => of({ success: true, data: [] }),
          },
        },
        { provide: Order, useValue: { loadSellerOrders: () => of({ success: true, data: [] }) } },
        { provide: NotificationService, useValue: { error: vi.fn(), success: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FarmerDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the browse-inputs link on the dashboard header', () => {
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('.dashboard__browse-inputs') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/inputs');
  });

  it('shows product and orders empty states without decorative icons', () => {
    fixture.detectChanges();
    const cards = Array.from(
      fixture.nativeElement.querySelectorAll('.dashboard__card'),
    ) as HTMLElement[];
    const ordersCard = cards.find((card) =>
      card.querySelector('.dashboard__card-title')?.textContent?.includes('Recent Orders'),
    );

    expect(fixture.nativeElement.querySelector('.dashboard__empty-icon')).toBeNull();
    expect(ordersCard?.querySelector('.dashboard__card-title mat-icon')).toBeNull();
    expect(ordersCard?.querySelector('.dashboard__orders-placeholder mat-icon')).toBeNull();
  });
});
