import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Order as OrderService } from '../../../core/services/order';
import { Tracking } from '../../../core/services/tracking';
import type { TrackingHistory } from '../../../shared/tracking.model';
import { OrderTracker } from './order-tracker';

describe('OrderTracker', () => {
  let fixture: ComponentFixture<OrderTracker>;
  let trackingHistory: ReturnType<typeof signal<TrackingHistory | null>>;
  let loadTracking: ReturnType<typeof vi.fn>;
  let getById: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    trackingHistory = signal<TrackingHistory | null>({
      orderId: '42',
      currentStage: 'SHIPPED',
      events: [
        {
          id: 'placed',
          stage: 'ORDER_PLACED',
          status: 'COMPLETED',
          timestamp: '2026-10-05T09:00:00Z',
        },
        {
          id: 'shipped',
          stage: 'SHIPPED',
          status: 'IN_PROGRESS',
          timestamp: '2026-10-06T09:00:00Z',
          note: 'Your parcel is on its way.',
          location: 'Nairobi dispatch centre',
        },
      ],
    });
    loadTracking = vi.fn(() =>
      of({ success: true, message: 'Success', data: trackingHistory() }),
    );
    getById = vi.fn(() =>
      of({
        success: true,
        message: 'Success',
        data: {
          order: {
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
          },
        },
      }),
    );

    await TestBed.configureTestingModule({
      imports: [OrderTracker],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '42' } } },
        },
        {
          provide: Tracking,
          useValue: {
            history: trackingHistory.asReadonly(),
            loading: signal(false),
            clear: vi.fn(),
            load: loadTracking,
          },
        },
        {
          provide: OrderService,
          useValue: {
            getById,
            loadMine: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderTracker);
  });

  it('loads shipment progress and displays order and delivery details', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(loadTracking).toHaveBeenCalledWith('42');
    expect(getById).toHaveBeenCalledWith('42');
    expect(fixture.nativeElement.textContent).toContain('Shipment progress');
    expect(fixture.nativeElement.textContent).toContain('Nairobi dispatch centre');
    expect(fixture.nativeElement.textContent).toContain('Your parcel is on its way.');
    expect(fixture.nativeElement.textContent).toContain('Nairobi');
    expect(fixture.nativeElement.textContent).toContain('Maize');
  });

  it('sorts shipment activity newest first', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const events = Array.from(
      fixture.nativeElement.querySelectorAll('.order-tracker__event h3'),
    ) as HTMLElement[];
    expect(events[0]?.textContent).toContain('Shipped');
    expect(events[1]?.textContent).toContain('Order placed');
  });
});
