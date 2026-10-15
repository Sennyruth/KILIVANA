import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Order as OrderService } from '../../../core/services/order';
import { NotificationService } from '../../../shared/notification/notification.service';
import { SupplierOrders } from './supplier-orders';

describe('SupplierOrders', () => {
  let fixture: ComponentFixture<SupplierOrders>;
  let loadSellerOrders: ReturnType<typeof vi.fn>;
  let notificationError: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    notificationError = vi.fn();
    loadSellerOrders = vi.fn(() =>
      of({
        success: true,
        message: 'Success',
        data: [
          { id: 12, status: 'PENDING', total: 240, createdAt: '2026-10-07T07:00:00', itemCount: 2 },
          { id: 13, status: 'DELIVERED', total: 480, createdAt: '2026-10-06T07:00:00', itemCount: 1 },
          { id: 14, status: 'CANCELLED', total: 100, createdAt: '2026-10-05T07:00:00', itemCount: 1 },
        ],
      }),
    );

    await TestBed.configureTestingModule({
      imports: [SupplierOrders],
      providers: [
        provideRouter([]),
        { provide: OrderService, useValue: { loadSellerOrders } },
        { provide: NotificationService, useValue: { error: notificationError } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SupplierOrders);
  });

  it('loads the seller-specific orders and displays their tracking status', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(loadSellerOrders).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).toContain('KV-12');
    expect(fixture.nativeElement.textContent).toContain('Pending');
    expect(fixture.nativeElement.textContent).toContain('Delivered');
  });

  it('filters orders by status group', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    buttons.find((button) => button.textContent?.trim() === 'In progress')?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('KV-12');
    expect(fixture.nativeElement.textContent).not.toContain('KV-13');
    expect(fixture.nativeElement.textContent).not.toContain('KV-14');
  });

  it('notifies when orders fail to load on the orders page', async () => {
    loadSellerOrders.mockReturnValue(throwError(() => new Error('Request failed')));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(notificationError).toHaveBeenCalledWith(
      'Failed to load your orders. Please try again.',
    );
  });
});
