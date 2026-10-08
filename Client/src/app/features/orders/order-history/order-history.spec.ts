import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Auth } from '../../../core/services/auth';
import { Order as OrderService } from '../../../core/services/order';
import type { Order } from '../../../shared/order.model';
import { OrderHistory } from './order-history';

describe('OrderHistory', () => {
  let fixture: ComponentFixture<OrderHistory>;
  let loadMine: ReturnType<typeof vi.fn>;
  let orders: ReturnType<typeof signal<Order[]>>;
  let loading: ReturnType<typeof signal<boolean>>;
  let error: ReturnType<typeof signal<string | null>>;
  let user: ReturnType<typeof signal<{ id: string; name: string; role: string } | null>>;

  const testOrder: Order = {
    id: '42',
    buyerId: '5',
    buyerName: 'Buyer',
    items: [
      {
        id: 'item-1',
        productId: '7',
        name: 'Maize',
        price: 150,
        quantity: 2,
        unit: 'kg',
        lineTotal: 300,
      },
    ],
    status: 'SHIPPED',
    subtotal: 300,
    deliveryFee: 0,
    total: 300,
    deliveryAddress: 'Nairobi',
    phone: '0700000000',
    paymentMethod: 'MPESA',
    paymentStatus: 'COMPLETED',
    createdAt: '2026-10-05T09:00:00Z',
    updatedAt: '2026-10-06T09:00:00Z',
  };

  beforeEach(async () => {
    orders = signal([testOrder]);
    loading = signal(false);
    error = signal<string | null>(null);
    user = signal({ id: '5', name: 'Buyer', role: 'BUYER' });
    loadMine = vi.fn(() => of({ success: true, message: 'Success', data: { orders: [testOrder] } }));

    await TestBed.configureTestingModule({
      imports: [OrderHistory],
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: { user },
        },
        {
          provide: OrderService,
          useValue: {
            orders: orders.asReadonly(),
            loading: loading.asReadonly(),
            error: error.asReadonly(),
            loadMine,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderHistory);
  });

  it('loads orders for the signed-in buyer using the numeric buyer endpoint', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadMine).toHaveBeenCalledWith('5');
  });

  it('shows shipment progress on each order with a link to detailed tracking', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Shipment progress');
    expect(fixture.nativeElement.textContent).toContain('Order placed');
    expect(fixture.nativeElement.textContent).toContain('Confirmed');
    expect(fixture.nativeElement.textContent).toContain('Shipped');
    expect(fixture.nativeElement.textContent).toContain('Delivered');
    expect(fixture.nativeElement.textContent).toContain('On the way');
    expect(
      fixture.nativeElement.querySelector('a[href="/tracking/42"]'),
    ).toBeTruthy();
  });

  it('shows cancelled and failed orders without implying active shipment progress', async () => {
    orders.set([{ ...testOrder, status: 'CANCELLED' }]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('This order was cancelled.');
    expect(fixture.nativeElement.textContent).not.toContain('Track shipment');
  });
});
