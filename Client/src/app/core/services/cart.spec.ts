import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Cart } from './cart';
import { Product as ProductModel } from '../../shared/product.model';
import { Auth } from './auth';
import { API_BASE } from '../../shared/api.config';

describe('Cart', () => {
  let service: Cart;
  let httpTesting: HttpTestingController;
  let user: ReturnType<typeof signal<{ id: string; role: string } | null>>;

  const product: ProductModel = {
    id: '39',
    name: 'Tomatoes',
    description: 'Fresh local tomatoes',
    price: 120,
    quantity: 8,
    unit: 'kg',
    category: 'VEGETABLES',
    type: 'PRODUCE',
    images: [{
      id: 1,
      url: 'https://images.example/tomatoes.jpg',
      publicId: 'tomatoes',
      assetId: null,
      sortOrder: 0,
      isPrimary: true,
      createdAt: '2026-10-07T10:00:00',
    }],
    farmerId: '3',
    farmerName: 'Farmer One',
    farmerVerified: true,
    location: 'Nakuru',
    rating: 4.5,
    reviewCount: 10,
    available: true,
    createdAt: '2026-10-07T10:00:00',
  };

  beforeEach(() => {
    localStorage.removeItem('kilivana_mock_cart_buyer_3');
    localStorage.removeItem('kilivana_mock_cart_farmer_3');
    user = signal({ id: '3', role: 'BUYER' });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Auth, useValue: { user } },
      ],
    });
    service = TestBed.inject(Cart);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.removeItem('kilivana_mock_cart_buyer_3');
    localStorage.removeItem('kilivana_mock_cart_farmer_3');
  });

  it('adds a product to the mock cart and calculates totals', () => {
    service.addItem(product, 2).subscribe((response) => {
      expect(response.success).toBe(true);
    });

    expect(service.items()).toEqual([{
      id: 'mock-39',
      productId: '39',
      name: 'Tomatoes',
      price: 120,
      unit: 'kg',
      quantity: 2,
      availableQuantity: 8,
      imageUrl: 'https://images.example/tomatoes.jpg',
      sellerName: 'Farmer One',
      lineTotal: 240,
    }]);
    expect(service.itemCount()).toBe(2);
    expect(service.totalPrice()).toBe(240);
  });

  it('increments the quantity when the same product is added again', () => {
    service.addItem(product, 2).subscribe();
    service.addItem(product, 3).subscribe();

    expect(service.items()).toHaveLength(1);
    expect(service.items()[0].quantity).toBe(5);
    expect(service.totalPrice()).toBe(600);
  });

  it('persists mock cart items and restores them when loaded again', () => {
    service.addItem(product, 1).subscribe();
    service.resetAfterLogout();
    service.load().subscribe();

    expect(service.itemCount()).toBe(1);
    expect(service.items()[0].name).toBe('Tomatoes');
  });

  it('keeps the farmer and buyer carts separate for the same browser', () => {
    service.addItem(product, 2).subscribe();

    user.set({ id: '3', role: 'FARMER' });
    service.resetAfterLogout();
    service.load().subscribe();
    expect(service.items()).toEqual([]);

    service.addItem(product, 1).subscribe();
    user.set({ id: '3', role: 'BUYER' });
    service.resetAfterLogout();
    service.load().subscribe();
    expect(service.items()[0].quantity).toBe(2);

    user.set({ id: '3', role: 'FARMER' });
    service.resetAfterLogout();
    service.load().subscribe();
    expect(service.items()[0].quantity).toBe(1);
  });

  it('updates and removes cart items locally', () => {
    service.addItem(product, 2).subscribe();
    service.updateItem('mock-39', 4).subscribe();

    expect(service.totalPrice()).toBe(480);

    service.removeItem('mock-39').subscribe();
    expect(service.items()).toEqual([]);
    expect(service.itemCount()).toBe(0);
  });

  it('rejects unavailable products and quantities over stock', () => {
    service.addItem(product, 9).subscribe((response) => {
      expect(response.success).toBe(false);
      expect(response.message).toContain('insufficient stock');
    });

    expect(service.items()).toEqual([]);
  });

  it('sends the signed-in user mock cart to the backend before checkout', () => {
    service.addItem(product, 2).subscribe();
    let completed = false;

    service.syncMockCartForCheckout().subscribe(() => {
      completed = true;
    });

    const clear = httpTesting.expectOne(`${API_BASE}/cart`);
    expect(clear.request.method).toBe('DELETE');
    clear.flush({ success: true, message: 'Cart cleared', data: null });

    const add = httpTesting.expectOne(`${API_BASE}/cart/items`);
    expect(add.request.method).toBe('POST');
    expect(add.request.body).toEqual({ productId: 39, quantity: 2 });
    add.flush({ success: true, message: 'Added', data: null });

    expect(completed).toBe(true);
  });
});
