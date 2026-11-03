import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Auth } from '../core/services/auth';
import { SellerLocationService } from '../core/services/seller-location';
import { produceCatalogGuard, shoppingGuard, supplierGuard, supplierRoleGuard } from './guards';
import { firstValueFrom, Observable, of } from 'rxjs';

describe('shoppingGuard', () => {
  function runGuard(role: 'BUYER' | 'FARMER' | 'SUPPLIER' | null): boolean | UrlTree {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: {
            isAuthenticated: () => role !== null,
            isBuyer: () => role === 'BUYER',
            isFarmer: () => role === 'FARMER',
          },
        },
      ],
    });
    return TestBed.runInInjectionContext(() =>
      shoppingGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as boolean | UrlTree;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('allows buyers and farmers to access their cart and checkout', () => {
    expect(runGuard('BUYER')).toBe(true);
    TestBed.resetTestingModule();
    expect(runGuard('FARMER')).toBe(true);
  });

  it('redirects suppliers to their dashboard', () => {
    const result = runGuard('SUPPLIER');
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/dashboard/supplier');
  });

  it('redirects signed-out users to login', () => {
    const result = runGuard(null);
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });
});

describe('produceCatalogGuard', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('redirects suppliers to My Supplies', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: { isSupplier: () => true },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      produceCatalogGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/dashboard/supplier');
  });

  it('allows buyer accounts to view farmer produce', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: { isSupplier: () => false, isFarmer: () => false },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      produceCatalogGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    expect(result).toBe(true);
  });

  it('redirects farmers away from the buyer product catalogue', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: {
            isSupplier: () => false,
            isFarmer: () => true,
          },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      produceCatalogGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/dashboard/farmer');
  });
});

describe('supplier onboarding guards', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('sends a supplier without an active warehouse to warehouse setup', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: { isSupplier: () => true, isAuthenticated: () => true } },
        { provide: SellerLocationService, useValue: { getMyLocations: () => of({ success: true, data: [] }) } },
      ],
    });

    const guardResult = TestBed.runInInjectionContext(() =>
      supplierGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    const result = await (guardResult instanceof Observable ? firstValueFrom(guardResult) : guardResult);
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/dashboard/supplier/setup');
  });

  it('allows a supplier with an active warehouse to access the dashboard', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: { isSupplier: () => true, isAuthenticated: () => true } },
        {
          provide: SellerLocationService,
          useValue: { getMyLocations: () => of({ success: true, data: [{ id: 1, active: true }] }) },
        },
      ],
    });

    const guardResult = TestBed.runInInjectionContext(() =>
      supplierGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    const result = await (guardResult instanceof Observable ? firstValueFrom(guardResult) : guardResult);
    expect(result).toBe(true);
  });

  it('allows a supplier to access setup before a warehouse exists', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: { isSupplier: () => true } },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      supplierRoleGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    expect(result).toBe(true);
  });
});
