import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { signal, computed, type WritableSignal } from '@angular/core';
import { of } from 'rxjs';
import { BuyerDashboard } from './buyer-dashboard';
import { Order } from '../../../core/services/order';
import { Auth } from '../../../core/services/auth';
import type { Order as OrderModel, OrderStatus } from '../../../shared/order.model';

const STATUS_LABELS: Partial<Record<OrderStatus, string>> & { PROCESSING: string } = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

function createOrder(over: Partial<OrderModel> = {}): OrderModel {
  return {
    id: 'ord-0',
    buyerId: 'b-1',
    buyerName: 'Test Buyer',
    items: [],
    status: 'PENDING',
    subtotal: 0,
    deliveryFee: 0,
    total: 0,
    deliveryAddress: '',
    phone: '',
    paymentMethod: 'CASH',
    paymentStatus: 'PENDING',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

const mockOrders: OrderModel[] = [
  createOrder({
    id: 'ord-1',
    status: 'PENDING',
    total: 290,
    items: [
      {
        id: 'i-1',
        productId: 'p-1',
        name: 'Tomatoes',
        price: 145,
        quantity: 2,
        unit: 'kg',
        lineTotal: 290,
      },
    ],
    createdAt: '2026-09-15T10:30:00Z',
  }),
  createOrder({
    id: 'ord-2',
    status: 'DELIVERED',
    total: 580,
    items: [
      {
        id: 'i-2',
        productId: 'p-2',
        name: 'Kale',
        price: 145,
        quantity: 4,
        unit: 'bunch',
        lineTotal: 580,
      },
    ],
    createdAt: '2026-09-10T08:00:00Z',
  }),
  createOrder({
    id: 'ord-3',
    status: 'CANCELLED',
    total: 150,
    items: [
      {
        id: 'i-3',
        productId: 'p-3',
        name: 'Milk',
        price: 150,
        quantity: 1,
        unit: 'liter',
        lineTotal: 150,
      },
    ],
    createdAt: '2026-08-05T12:00:00Z',
    cancelledAt: '2026-08-06T09:00:00Z',
    cancelReason: 'Item unavailable',
  }),
];

describe('BuyerDashboard', () => {
  let component: BuyerDashboard;
  let fixture: ComponentFixture<BuyerDashboard>;

  let ordersSignal: WritableSignal<OrderModel[]>;
  let loadingSignal: WritableSignal<boolean>;
  let errorSignal: WritableSignal<string | null>;
  let nameSignal: WritableSignal<string>;
  let loadMineSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    ordersSignal = signal<OrderModel[]>([]);
    loadingSignal = signal(false);
    errorSignal = signal<string | null>(null);
    nameSignal = signal('John Doe');

    loadMineSpy = vi.fn(() =>
      of({ success: true, data: { orders: [] }, message: 'OK' }),
    );

    await TestBed.configureTestingModule({
      imports: [BuyerDashboard, RouterTestingModule],
      providers: [
        {
          provide: Order,
          useValue: {
            orders: ordersSignal,
            loading: loadingSignal,
            error: errorSignal,
            orders$: signal([]),
            loading$: signal(false),
            error$: signal(null),
            loadMine: loadMineSpy,
            statusLabel: (s: OrderStatus) => STATUS_LABELS[s] ?? s,
            statusColor: () => 'primary',
          },
        },
        {
          provide: Auth,
          useValue: {
            name: nameSignal,
            role: signal<'BUYER' | null>('BUYER'),
            isBuyer: computed(() => true),
            isAuthenticated: computed(() => true),
            user: signal(null),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BuyerDashboard);
    component = fixture.componentInstance;
  });

  describe('creation', () => {
    it('should create', () => {
      fixture.detectChanges();
      expect(component).toBeTruthy();
    });
  });

  describe('initialization', () => {
    it('should call loadMine on init', () => {
      fixture.detectChanges();
      expect(loadMineSpy).toHaveBeenCalledOnce();
    });

    it('should display the user name in the welcome header', () => {
      nameSignal.set('Alice');
      fixture.detectChanges();

      const title = fixture.debugElement.query(By.css('.dashboard__title'));
      expect(title.nativeElement.textContent).toContain('Alice');
    });

    it('should fall back to "Buyer" when name is empty', () => {
      nameSignal.set('');
      fixture.detectChanges();

      const title = fixture.debugElement.query(By.css('.dashboard__title'));
      expect(title.nativeElement.textContent).toContain('Buyer');
    });
  });

  describe('loading state', () => {
    it('should show a loading spinner when loading', () => {
      loadingSignal.set(true);
      fixture.detectChanges();

      const spinner = fixture.debugElement.query(By.css('.dashboard__spinner'));
      expect(spinner).toBeTruthy();
    });

    it('should not show content while loading', () => {
      loadingSignal.set(true);
      ordersSignal.set(mockOrders);
      fixture.detectChanges();

      const stats = fixture.debugElement.query(By.css('.dashboard__stats'));
      expect(stats).toBeFalsy();
    });
  });

  describe('error state', () => {
    it('should display the error message', () => {
      errorSignal.set('Something went wrong');
      fixture.detectChanges();

      const alert = fixture.debugElement.query(By.css('[role="alert"]'));
      expect(alert).toBeTruthy();
      expect(alert.nativeElement.textContent).toContain('Something went wrong');
    });

    it('should show a retry button', () => {
      errorSignal.set('Network error');
      fixture.detectChanges();

      const retryBtn = fixture.debugElement.query(
        By.css('button[aria-label="Retry loading orders"]'),
      );
      expect(retryBtn).toBeTruthy();
    });

    it('should call loadOrders when retry is clicked', () => {
      errorSignal.set('Network error');
      fixture.detectChanges();

      const retryBtn = fixture.debugElement.query(
        By.css('button[aria-label="Retry loading orders"]'),
      );
      retryBtn.nativeElement.click();

      expect(loadMineSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('empty state', () => {
    it('should show empty state when no orders', () => {
      fixture.detectChanges();

      const emptyState = fixture.debugElement.query(
        By.css('.dashboard__state--empty'),
      );
      expect(emptyState).toBeTruthy();
      expect(emptyState.nativeElement.textContent).toContain(
        "haven't placed any orders yet",
      );
    });

    it('should show a "Start Shopping" link', () => {
      fixture.detectChanges();

      const shopLink = fixture.debugElement.queryAll(
        By.css('.dashboard__state--empty a'),
      );
      expect(shopLink.length).toBe(1);
      expect(shopLink[0].nativeElement.textContent).toContain('Start Shopping');
    });
  });

  describe('order stats', () => {
    beforeEach(() => {
      ordersSignal.set(mockOrders);
      fixture.detectChanges();
    });

    it('should display total order count', () => {
      const statCards = fixture.debugElement.queryAll(
        By.css('.stat-card__value'),
      );
      expect(statCards[0].nativeElement.textContent).toContain('3');
    });

    it('should compute stats correctly', () => {
      const stats = (component as any).stats();
      expect(stats.total).toBe(3);
      expect(stats.pending).toBe(1);
      expect(stats.delivered).toBe(1);
      expect(stats.cancelled).toBe(1);
      expect(stats.processing).toBe(0);
      expect(stats.shipped).toBe(0);
    });

    it('should display each stat label', () => {
      const statCards = fixture.debugElement.queryAll(
        By.css('.stat-card__label'),
      );
      const labels = statCards.map((c) => c.nativeElement.textContent?.trim());
      expect(labels).toContain('Total Orders');
      expect(labels).toContain('Pending');
      expect(labels).toContain('Delivered');
      expect(labels).toContain('Cancelled');
    });
  });

  describe('recent orders', () => {
    beforeEach(() => {
      ordersSignal.set(mockOrders);
      fixture.detectChanges();
    });

    it('should render all recent orders (max 5)', () => {
      const orderCards = fixture.debugElement.queryAll(
        By.css('.order-card'),
      );
      expect(orderCards.length).toBe(3);
    });

    it('should display order ID', () => {
      const ids = fixture.debugElement.queryAll(
        By.css('.order-card__id'),
      );
      expect(ids[0].nativeElement.textContent).toContain('#ord-1');
    });

    it('should display order total with currency', () => {
      const totals = fixture.debugElement.queryAll(
        By.css('.order-card__total'),
      );
      expect(totals[0].nativeElement.textContent).toContain('KES');
    });

    it('should display order date', () => {
      const dates = fixture.debugElement.queryAll(
        By.css('.order-card__date'),
      );
      expect(dates[0].nativeElement.textContent).toBeTruthy();
    });

    it('should display item count', () => {
      const itemCounts = fixture.debugElement.queryAll(
        By.css('.order-card__items'),
      );
      expect(itemCounts[0].nativeElement.textContent).toContain('item');
    });

    it('should render a Track Order link for each order', () => {
      const trackLinks = fixture.debugElement.queryAll(
        By.css('.order-card__link'),
      );
      expect(trackLinks.length).toBe(3);
      expect(trackLinks[0].nativeElement.textContent).toContain(
        'Track Order',
      );
    });
  });

  describe('status badges', () => {
    it('should display correct status labels', () => {
      ordersSignal.set(mockOrders);
      fixture.detectChanges();

      const badges = fixture.debugElement.queryAll(
        By.css('.order-card__status'),
      );
      expect(badges[0].nativeElement.textContent).toContain('Pending');
      expect(badges[1].nativeElement.textContent).toContain('Delivered');
      expect(badges[2].nativeElement.textContent).toContain('Cancelled');
    });

    it('should apply correct CSS class for each status', () => {
      ordersSignal.set(mockOrders);
      fixture.detectChanges();

      const badges = fixture.debugElement.queryAll(
        By.css('.order-card__status'),
      );
      expect(badges[0].classes['order-status--pending']).toBe(true);
      expect(badges[1].classes['order-status--delivered']).toBe(true);
      expect(badges[2].classes['order-status--cancelled']).toBe(true);
    });

    it('should return correct status label from method', () => {
      expect((component as any).statusLabel('PENDING')).toBe('Pending');
      expect((component as any).statusLabel('CONFIRMED')).toBe('Confirmed');
      expect((component as any).statusLabel('PROCESSING')).toBe('Processing');
      expect((component as any).statusLabel('SHIPPED')).toBe('Shipped');
      expect((component as any).statusLabel('DELIVERED')).toBe('Delivered');
      expect((component as any).statusLabel('CANCELLED')).toBe('Cancelled');
    });

    it('should return correct status class from method', () => {
      expect((component as any).statusClass('PENDING')).toBe(
        'order-status order-status--pending',
      );
      expect((component as any).statusClass('CONFIRMED')).toBe(
        'order-status order-status--confirmed',
      );
      expect((component as any).statusClass('PROCESSING')).toBe(
        'order-status order-status--processing',
      );
      expect((component as any).statusClass('SHIPPED')).toBe(
        'order-status order-status--shipped',
      );
      expect((component as any).statusClass('DELIVERED')).toBe(
        'order-status order-status--delivered',
      );
      expect((component as any).statusClass('CANCELLED')).toBe(
        'order-status order-status--cancelled',
      );
    });
  });

  describe('computed properties', () => {
    it('should only show 5 recent orders', () => {
      const manyOrders = Array.from({ length: 8 }, (_, i) =>
        createOrder({
          id: `ord-${i + 1}`,
          status: 'PENDING',
          createdAt: `2026-09-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        }),
      );
      ordersSignal.set(manyOrders);
      fixture.detectChanges();

      const orderCards = fixture.debugElement.queryAll(
        By.css('.order-card'),
      );
      expect(orderCards.length).toBe(5);
    });

    it('should compute hasOrders correctly', () => {
      ordersSignal.set([]);
      fixture.detectChanges();
      expect((component as any).hasOrders()).toBe(false);

      ordersSignal.set(mockOrders);
      fixture.detectChanges();
      expect((component as any).hasOrders()).toBe(true);
    });

    it('should compute showContent correctly when loading', () => {
      loadingSignal.set(true);
      fixture.detectChanges();
      expect((component as any).showContent()).toBe(false);
    });

    it('should compute showContent correctly when error', () => {
      errorSignal.set('Failed');
      fixture.detectChanges();
      expect((component as any).showContent()).toBe(false);
    });

    it('should compute showContent correctly when idle', () => {
      fixture.detectChanges();
      expect((component as any).showContent()).toBe(true);
    });
  });

  describe('quick actions', () => {
    beforeEach(() => {
      ordersSignal.set(mockOrders);
      fixture.detectChanges();
    });

    it('should render quick action links', () => {
      const actions = fixture.debugElement.queryAll(
        By.css('.dashboard__actions a'),
      );
      expect(actions.length).toBe(3);
    });

    it('should have correct text for action links', () => {
      const actions = fixture.debugElement.queryAll(
        By.css('.dashboard__actions a'),
      );
      expect(actions[0].nativeElement.textContent).toContain('View All Orders');
      expect(actions[1].nativeElement.textContent).toContain('Browse All Products');
      expect(actions[2].nativeElement.textContent).toContain('View Cart');
    });
  });

  it('keeps the browse-inputs link visible while dashboard content is loading', () => {
    loadingSignal.set(true);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('.dashboard__browse-inputs') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/inputs');
  });
});
