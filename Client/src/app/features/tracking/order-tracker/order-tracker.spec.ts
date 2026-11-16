import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Order as OrderService } from '../../../core/services/order';
import { Tracking } from '../../../core/services/tracking';
import { Auth } from '../../../core/services/auth';
import type { DeliverySummary, TrackingHistory } from '../../../shared/tracking.model';
import type { DeliveryStatus } from '../../../shared/order.model';
import { OrderTracker } from './order-tracker';

describe('OrderTracker', () => {
  let fixture: ComponentFixture<OrderTracker>;
  let trackingHistory: ReturnType<typeof signal<TrackingHistory | null>>;
  let loadTracking: ReturnType<typeof vi.fn>;
  let loadDeliveryEvents: ReturnType<typeof vi.fn>;
  let getById: ReturnType<typeof vi.fn>;
  let orderStatus: string;
  let deliveryStatus: DeliveryStatus | null;
  let logisticsJobId: number | undefined;
  let buyerDeliverySummary: DeliverySummary;
  let sellerDeliverySummary: DeliverySummary;
  let sellerPerspective: string | null;
  let currentUser: ReturnType<typeof signal<{ role: string } | null>>;
  let loadBuyerDeliverySummary: ReturnType<typeof vi.fn>;
  let loadSellerDeliverySummary: ReturnType<typeof vi.fn>;
  let loadSellerOrders: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    orderStatus = 'SHIPPED';
    deliveryStatus = null;
    logisticsJobId = undefined;
    sellerPerspective = null;
    currentUser = signal({ role: 'BUYER' });
    buyerDeliverySummary = { orderId: 42, orderStatus: 'SHIPPED', deliveries: [] };
    sellerDeliverySummary = { orderId: 42, orderStatus: 'SHIPPED', deliveries: [] };
    trackingHistory = signal<TrackingHistory | null>({
      orderId: '42',
      currentStage: 'IN_TRANSIT',
      events: [
        {
          id: 'placed',
          stage: 'PLACED',
          status: 'COMPLETED',
          timestamp: '2026-10-05T09:00:00Z',
        },
        {
          id: 'shipped',
          stage: 'IN_TRANSIT',
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
    loadDeliveryEvents = vi.fn(() =>
      of({
        success: true,
        message: 'Success',
        data: [
          {
            id: 'delivery-3',
            stage: 'DELIVERED',
            status: 'COMPLETED',
            timestamp: '2026-10-07T09:00:00Z',
            label: 'Delivered',
            note: 'Received by buyer',
          },
        ],
      }),
    );
    loadBuyerDeliverySummary = vi.fn(() =>
      of({ success: true, message: 'Success', data: buyerDeliverySummary }),
    );
    loadSellerDeliverySummary = vi.fn(() =>
      of({ success: true, message: 'Success', data: sellerDeliverySummary }),
    );
    loadSellerOrders = vi.fn(() =>
      of({
        success: true,
        message: 'Success',
        data: [{
          id: 42,
          status: 'SHIPPED',
          total: 300,
          createdAt: '2026-10-05T09:00:00Z',
          itemCount: 2,
        }],
      }),
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
            status: orderStatus,
            deliveryStatus,
            ...(logisticsJobId ? { logisticsJobId } : {}),
            subtotal: 300,
            deliveryFee: 0,
            total: 300,
            deliveryAddress: 'Nairobi',
            phone: '0700000000',
            paymentMethod: 'MPESA',
            paymentStatus: 'PAID',
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
          useValue: {
            snapshot: {
              paramMap: { get: () => '42' },
              queryParamMap: { get: () => sellerPerspective },
            },
          },
        },
        {
          provide: Auth,
          useValue: {
            user: currentUser,
            isFarmer: () => false,
            isSupplier: () => false,
          },
        },
        {
          provide: Tracking,
          useValue: {
            history: trackingHistory.asReadonly(),
            loading: signal(false),
            clear: vi.fn(),
            load: loadTracking,
            loadDeliveryEvents,
            loadBuyerDeliverySummary,
            loadSellerDeliverySummary,
          },
        },
        {
          provide: OrderService,
          useValue: {
            getById,
            loadMine: vi.fn(),
            loadSellerOrders,
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
    expect(events[0]?.textContent).toContain('In transit');
    expect(events[1]?.textContent).toContain('Order placed');
  });

  it('includes backend delivery events in shipment updates', async () => {
    buyerDeliverySummary = {
      orderId: 42,
      orderStatus: 'IN_TRANSIT',
      deliveries: [{
        deliveryJobId: 24,
        status: 'IN_TRANSIT',
        destinationType: 'DOOR_DELIVERY',
        assignedAt: null,
        acceptedAt: null,
        pickedUpAt: null,
        completedAt: null,
      }],
    };
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(loadDeliveryEvents).toHaveBeenCalledWith(24);
    expect(loadBuyerDeliverySummary).toHaveBeenCalledWith('42');
    expect(fixture.nativeElement.textContent).toContain('Delivered');
    expect(fixture.nativeElement.textContent).toContain('Received by buyer');
    expect(fixture.nativeElement.textContent).toContain('door delivery');
  });

  it.each(['FARMER', 'SUPPLIER'])(
    'loads seller-scoped delivery jobs for a %s seller',
    async (role) => {
      sellerPerspective = 'seller';
      currentUser.set({ role });
      fixture.destroy();
      fixture = TestBed.createComponent(OrderTracker);
      sellerDeliverySummary = {
        orderId: 42,
        orderStatus: 'IN_TRANSIT',
        deliveries: [
          {
            deliveryJobId: 24,
            status: 'IN_TRANSIT',
            destinationType: 'DOOR_DELIVERY',
            assignedAt: null,
            acceptedAt: null,
            pickedUpAt: null,
            completedAt: null,
          },
          {
            deliveryJobId: 25,
            status: 'DELIVERED',
            destinationType: 'PICKUP_STATION',
            assignedAt: null,
            acceptedAt: null,
            pickedUpAt: null,
            completedAt: '2026-10-07T09:00:00Z',
          },
        ],
      };

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(loadSellerOrders).toHaveBeenCalled();
      expect(loadSellerDeliverySummary).toHaveBeenCalledWith('42');
      expect(loadDeliveryEvents).toHaveBeenNthCalledWith(1, 24);
      expect(loadDeliveryEvents).toHaveBeenNthCalledWith(2, 25);
      expect(fixture.nativeElement.textContent).toContain('YOUR SALE');
      expect(fixture.nativeElement.textContent).toContain('Delivery #24');
      expect(fixture.nativeElement.textContent).toContain('Delivery #25');
      expect(getById).toHaveBeenCalledWith('42');
      expect(fixture.nativeElement.textContent).toContain('Buyer: Buyer');
      expect(fixture.nativeElement.textContent).toContain('Nairobi');
      expect(fixture.nativeElement.textContent).toContain('0700000000');
    },
  );

  it('keeps the active stage aligned with the order and delivery statuses', async () => {
    orderStatus = 'DELIVERED';
    deliveryStatus = 'DELIVERED';
    trackingHistory.set({
      orderId: '42',
      currentStage: 'COMPLETED',
      events: [],
    });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const activeStage = fixture.nativeElement.querySelector(
      '.tracking-stepper__stage--active .tracking-stepper__stage-name',
    ) as HTMLElement | null;
    expect(activeStage?.textContent?.trim()).toBe('Delivered');
    expect(
      fixture.nativeElement.querySelector('.tracking-stepper__stage--active mat-icon')?.textContent?.trim(),
    ).toBe('check');
  });

  it('shows a terminal message instead of active progress for cancelled orders', async () => {
    orderStatus = 'CANCELLED';
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cancelled');
    expect(fixture.nativeElement.textContent).toContain('This order will not continue to delivery.');
    expect(fixture.nativeElement.querySelector('app-tracking-stepper')).toBeNull();
  });
});
