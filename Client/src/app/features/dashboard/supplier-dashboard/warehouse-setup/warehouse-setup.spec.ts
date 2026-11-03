import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { Auth } from '../../../../core/services/auth';
import { SellerLocationService } from '../../../../core/services/seller-location';
import { WarehouseSetup } from './warehouse-setup';

describe('WarehouseSetup', () => {
  let fixture: ComponentFixture<WarehouseSetup>;
  let createLocation: ReturnType<typeof vi.fn>;
  let router: Router;

  beforeEach(async () => {
    createLocation = vi.fn(() => of({
      success: true,
      message: 'Created',
      data: { id: 1 },
    }));

    await TestBed.configureTestingModule({
      imports: [WarehouseSetup],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: { user: signal({ region: 'Nairobi' }) } },
        { provide: SellerLocationService, useValue: { createLocation } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WarehouseSetup);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('creates the first warehouse and continues to the supplier dashboard', async () => {
    const values: Record<string, string> = {
      name: 'Main store',
      address: 'Market Road',
      latitude: '-1.2921',
      longitude: '36.8219',
    };

    for (const [field, value] of Object.entries(values)) {
      const input = fixture.nativeElement.querySelector(`[formControlName="${field}"]`) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    }
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(createLocation).toHaveBeenCalledWith({
      name: 'Main store',
      address: 'Market Road',
      county: 'Nairobi',
      latitude: -1.2921,
      longitude: 36.8219,
      contactName: undefined,
      contactPhone: undefined,
      operatingHours: undefined,
    });
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/supplier']);
  });
});
