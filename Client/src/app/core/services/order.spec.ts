import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Auth } from './auth';
import { Order } from './order';
import { API_BASE } from '../../shared/api.config';

describe('Order', () => {
  let service: Order;
  let httpTesting: HttpTestingController;
  let currentUser: { id: string } | null;

  beforeEach(() => {
    currentUser = null;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Auth, useValue: { user: () => currentUser } },
      ],
    });
    service = TestBed.inject(Order);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('reads orders from the paged API response', () => {
    service.loadAll().subscribe();
    httpTesting.expectOne(`${API_BASE}/orders`).flush({
      success: true,
      message: 'Success',
      data: {
        content: [
          {
            id: 12,
            buyerId: 3,
            buyerName: 'Buyer One',
            status: 'PENDING',
            subtotal: 240,
            deliveryFee: 150,
            total: 409.2,
            paymentStatus: 'PENDING',
            paymentMethod: 'CASH',
            addressId: 4,
            deliveryAddress: 'Farm Road, Nairobi',
            phone: '+254700000001',
            cancellationReason: null,
            createdAt: '2026-10-07T10:00:00',
            updatedAt: '2026-10-07T10:00:00',
            items: [
              {
                id: 55,
                productId: 39,
                name: 'Tomatoes',
                price: 120,
                quantity: 2,
                unit: 'kg',
                lineTotal: 240,
              },
            ],
          },
        ],
      },
    });

    expect(service.orders()[0]).toMatchObject({
      id: '12',
      buyerId: '3',
      items: [
        {
          id: '55',
          productId: '39',
          name: 'Tomatoes',
          quantity: 2,
          lineTotal: 240,
        },
      ],
    });
  });

  it('loads only orders belonging to the signed-in seller', () => {
    currentUser = { id: '42' };
    const summaries = [
      {
        id: 12,
        status: 'PENDING',
        total: 240,
        createdAt: '2026-10-07T07:00:00',
        itemCount: 2,
      },
    ];

    service.loadSellerOrders().subscribe((response) => {
      expect(response.data).toEqual(summaries);
    });

    httpTesting.expectOne((request) =>
      request.url === `${API_BASE}/orders` && request.params.get('sellerId') === '42',
    ).flush({
      success: true,
      message: 'Success',
      data: summaries,
    });
  });

  it('loads the authenticated buyer order history endpoint', () => {
    service.loadMine().subscribe((response) => {
      expect(response.data).toEqual([]);
    });

    httpTesting.expectOne(`${API_BASE}/orders/mine`).flush({
      success: true,
      message: 'Success',
      data: [],
    });
  });

  it('loads the selected buyer history using a numeric buyer id', () => {
    service.loadMine('42').subscribe((response) => {
      expect(response.data).toEqual([]);
    });

    httpTesting.expectOne(`${API_BASE}/orders/buyer/42`).flush({
      success: true,
      message: 'Success',
      data: [],
    });
  });

  it('submits checkout details and reads the direct backend order response', () => {
    let createdOrderId: number | undefined;
    service.create({
      recipientName: 'Buyer One',
      deliveryAddress: 'Farm Road, Nairobi',
      phone: '+254700000001',
      paymentMethod: 'CASH',
    }).subscribe((response) => {
      createdOrderId = response.data.id;
    });

    const request = httpTesting.expectOne(`${API_BASE}/orders/checkout`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      recipientName: 'Buyer One',
      deliveryAddress: 'Farm Road, Nairobi',
      phone: '+254700000001',
      paymentMethod: 'CASH',
    });
    request.flush({
      success: true,
      message: 'Success',
      data: {
        id: 15,
        buyerId: 3,
        status: 'PENDING',
        subtotal: 240,
        deliveryFee: 150,
        total: 409.2,
        paymentStatus: 'PENDING',
        addressId: 4,
        cancellationReason: null,
        createdAt: '2026-10-07T10:00:00',
        updatedAt: '2026-10-07T10:00:00',
        items: [],
      },
    });

    expect(createdOrderId).toBe(15);
  });
});
