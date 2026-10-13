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
          { id: 3, status: 'IN_TRANSIT', note: null, createdAt: '2026-10-07T09:00:00' },
          { id: 1, status: 'PENDING', note: null, createdAt: '2026-10-05T09:00:00' },
          { id: 2, status: 'PREPARING', note: 'Being packed', createdAt: '2026-10-06T09:00:00' },
          { id: 4, status: 'CANCELLED', note: 'Buyer requested cancellation', createdAt: '2026-10-08T09:00:00' },
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
      currentStage: 'SHIPPED',
      events: [
        {
          id: '1',
          stage: 'ORDER_PLACED',
          status: 'COMPLETED',
          timestamp: '2026-10-05T09:00:00',
          label: 'Order placed',
        },
        {
          id: '2',
          stage: 'ORDER_CONFIRMED',
          status: 'COMPLETED',
          timestamp: '2026-10-06T09:00:00',
          label: 'Being prepared',
          note: 'Being packed',
        },
        {
          id: '3',
          stage: 'SHIPPED',
          status: 'COMPLETED',
          timestamp: '2026-10-07T09:00:00',
          label: 'In transit',
        },
        {
          id: '4',
          stage: 'SHIPPED',
          status: 'COMPLETED',
          timestamp: '2026-10-08T09:00:00',
          label: 'Cancelled',
          note: 'Buyer requested cancellation',
        },
      ],
    });
  });
});
