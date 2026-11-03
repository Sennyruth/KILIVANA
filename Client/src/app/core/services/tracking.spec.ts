import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiEndpoints } from '../../shared/api.config';
import { HttpService } from './http';
import { Tracking } from './tracking';

describe('Tracking', () => {
  let service: Tracking;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    get = vi.fn(() =>
      of({
        success: true,
        message: 'Success',
        data: [
          { id: 3, status: 'in_transit', note: null, createdAt: '2026-10-07T09:00:00' },
          { id: 1, status: 'placed', note: null, createdAt: '2026-10-05T09:00:00' },
          { id: 2, status: 'preparing', note: 'Being packed', createdAt: '2026-10-06T09:00:00' },
          { id: 4, status: 'cancelled', note: 'Buyer requested cancellation', createdAt: '2026-10-08T09:00:00' },
        ],
      }),
    );
    TestBed.configureTestingModule({
      providers: [{ provide: HttpService, useValue: { get } }],
    });
    service = TestBed.inject(Tracking);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('loads and maps the order timeline into tracking history', () => {
    service.load('42').subscribe();

    expect(get).toHaveBeenCalledWith(ApiEndpoints.ORDERS.TIMELINE('42'));
    expect(service.history()).toEqual({
      orderId: '42',
      currentStage: 'IN_TRANSIT',
      events: [
        {
          id: '1',
          stage: 'PLACED',
          status: 'COMPLETED',
          timestamp: '2026-10-05T09:00:00',
          label: 'Order placed',
        },
        {
          id: '2',
          stage: 'CONFIRMED',
          status: 'COMPLETED',
          timestamp: '2026-10-06T09:00:00',
          label: 'Being prepared',
          note: 'Being packed',
        },
        {
          id: '3',
          stage: 'IN_TRANSIT',
          status: 'COMPLETED',
          timestamp: '2026-10-07T09:00:00',
          label: 'In transit',
        },
        {
          id: '4',
          stage: 'IN_TRANSIT',
          status: 'COMPLETED',
          timestamp: '2026-10-08T09:00:00',
          label: 'Cancelled',
          note: 'Buyer requested cancellation',
        },
      ],
    });
  });

  it('keeps the backend order lifecycle sequence through completed', () => {
    get.mockReturnValueOnce(
      of({
        success: true,
        message: 'Success',
        data: [
          { id: 1, status: 'placed', note: null, createdAt: '2026-10-05T09:00:00' },
          { id: 2, status: 'confirmed', note: null, createdAt: '2026-10-06T09:00:00' },
          { id: 3, status: 'in_transit', note: null, createdAt: '2026-10-07T09:00:00' },
          { id: 4, status: 'delivered', note: null, createdAt: '2026-10-08T09:00:00' },
          { id: 5, status: 'completed', note: null, createdAt: '2026-10-09T09:00:00' },
        ],
      }),
    );

    service.load('43').subscribe();

    expect(service.history()?.events.map((event) => event.stage)).toEqual([
      'PLACED',
      'CONFIRMED',
      'IN_TRANSIT',
      'DELIVERED',
      'COMPLETED',
    ]);
    expect(service.history()?.currentStage).toBe('COMPLETED');
  });

  it('loads real delivery tracking events and normalizes them to shipment updates', () => {
    get.mockReturnValueOnce(
      of({
        success: true,
        message: 'Success',
        data: [
          {
            id: 8,
            status: 'DELIVERED',
            note: 'Received by buyer',
            locationName: 'Nairobi',
            recordedAt: '2026-10-08T09:00:00',
          },
          {
            id: 7,
            status: 'IN_TRANSIT',
            note: 'Parcel picked up',
            locationName: null,
            recordedAt: '2026-10-07T09:00:00',
          },
        ],
      }),
    );

    let updates: unknown;
    service.loadDeliveryEvents(84).subscribe((response) => {
      updates = response.data;
    });

    expect(get).toHaveBeenCalledWith(ApiEndpoints.LOGISTICS.TRACKING_EVENTS(84));
    expect(updates).toEqual([
      {
        id: 'delivery-7',
        stage: 'IN_TRANSIT',
        status: 'COMPLETED',
        timestamp: '2026-10-07T09:00:00',
        label: 'In transit',
        note: 'Parcel picked up',
      },
      {
        id: 'delivery-8',
        stage: 'DELIVERED',
        status: 'COMPLETED',
        timestamp: '2026-10-08T09:00:00',
        label: 'Delivered',
        note: 'Received by buyer',
        location: 'Nairobi',
      },
    ]);
  });

  it('marks the latest active delivery scan as in progress', () => {
    get.mockReturnValueOnce(
      of({
        success: true,
        message: 'Success',
        data: [
          {
            id: 9,
            status: 'IN_TRANSIT',
            note: null,
            recordedAt: '2026-10-08T09:00:00',
          },
        ],
      }),
    );

    let updateStatus: string | undefined;
    service.loadDeliveryEvents(84).subscribe((response) => {
      updateStatus = response.data?.[0]?.status;
    });

    expect(updateStatus).toBe('IN_PROGRESS');
  });
});
