import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Auth } from '../../core/services/auth';
import { Cart } from '../../core/services/cart';
import { NotificationService } from '../notification/notification.service';
import { Navbar } from './navbar';

describe('Navbar', () => {
  let fixture: ComponentFixture<Navbar>;
  let user: ReturnType<typeof signal<{ id: string; name: string; role: string } | null>>;
  let role: ReturnType<typeof signal<string>>;
  let loadCart: ReturnType<typeof vi.fn>;
  let resetCart: ReturnType<typeof vi.fn>;
  let showError: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    user = signal({ id: '3', name: 'Test Buyer', role: 'BUYER' });
    role = signal('BUYER');
    loadCart = vi.fn(() => of({ success: true, message: 'Success', data: null }));
    resetCart = vi.fn();
    showError = vi.fn();

    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: {
            user,
            role,
            isAuthenticated: signal(true),
            isBuyer: () => role() === 'BUYER',
            isFarmer: () => role() === 'FARMER',
            isSupplier: () => role() === 'SUPPLIER',
          },
        },
        {
          provide: Cart,
          useValue: {
            itemCount: signal(0),
            load: loadCart,
            resetAfterLogout: resetCart,
          },
        },
        {
          provide: NotificationService,
          useValue: { error: showError },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Navbar);
  });

  it('loads the cart for an authenticated buyer', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadCart).toHaveBeenCalledOnce();
  });

  it('loads a separate cart for an authenticated farmer', async () => {
    role.set('FARMER');
    user.set({ id: '3', name: 'Test Farmer', role: 'FARMER' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadCart).toHaveBeenCalledOnce();
    const links = Array.from(fixture.nativeElement.querySelectorAll('.navbar__link')) as HTMLAnchorElement[];
    expect(links.map((link) => link.textContent?.trim())).toEqual(['Inputs', 'Cart', 'Orders', 'Dashboard']);
    expect(links.some((link) => link.getAttribute('href') === '/products')).toBe(false);
  });

  it('does not load the cart for a supplier', async () => {
    role.set('SUPPLIER');
    user.set({ id: '3', name: 'Test Supplier', role: 'SUPPLIER' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadCart).not.toHaveBeenCalled();
    const links = Array.from(fixture.nativeElement.querySelectorAll('.navbar__link')) as HTMLAnchorElement[];
    expect(links.map((link) => link.textContent?.trim())).toContain('Orders');
    expect(links.some((link) => link.getAttribute('href') === '/dashboard/supplier/orders')).toBe(true);
  });

  it('clears the cart when the user logs out', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    user.set(null);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(resetCart).toHaveBeenCalled();
  });
});
