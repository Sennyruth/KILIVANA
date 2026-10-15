import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Auth } from '../core/services/auth';
import { produceCatalogGuard, shoppingGuard } from './guards';

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
