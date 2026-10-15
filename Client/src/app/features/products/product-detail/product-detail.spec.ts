import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Cart } from '../../../core/services/cart';
import { Farmer } from '../../../core/services/farmer';
import { Product } from '../../../core/services/product';
import { NotificationService } from '../../../shared/notification/notification.service';
import type { Product as ProductModel } from '../../../shared/product.model';
import { ProductDetail } from './product-detail';

describe('ProductDetail', () => {
  let component: ProductDetail;
  let fixture: ComponentFixture<ProductDetail>;

  beforeEach(async () => {
    const product: ProductModel = {
      id: '39',
      name: 'Tomatoes',
      description: 'Fresh tomatoes',
      price: 120,
      quantity: 10,
      unit: 'kg',
      category: 'Vegetables',
      type: 'PRODUCE',
      images: [],
      farmerId: '8',
      farmerName: '',
      farmerVerified: false,
      location: '',
      rating: 0,
      reviewCount: 0,
      available: true,
      createdAt: '2026-10-07T10:00:00',
    };

    await TestBed.configureTestingModule({
      imports: [ProductDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '39' } } },
        },
        {
          provide: Product,
          useValue: {
            products: signal([product]),
            loading: signal(false),
            error: signal(null),
            getById: vi.fn(() => of({ success: true, data: product })),
            loadFarmerProducts: vi.fn(() =>
              of({
                success: true,
                data: [{
                  ...product,
                  id: '40',
                  name: 'Green Peppers',
                }],
              }),
            ),
          },
        },
        {
          provide: Farmer,
          useValue: {
            getProfile: vi.fn(() =>
              of({
                success: true,
                data: {
                  id: '8',
                  name: 'Jane Farmer',
                  region: 'Nakuru County',
                  verificationStatus: 'VERIFIED',
                },
              }),
            ),
          },
        },
        { provide: Cart, useValue: { addItem: vi.fn() } },
        { provide: NotificationService, useValue: { error: vi.fn(), success: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the farmer region and other active produce on the product detail page', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nakuru County');
    expect(fixture.nativeElement.textContent).toContain('Jane Farmer');
    expect(fixture.nativeElement.textContent).toContain('Green Peppers');
  });
});
