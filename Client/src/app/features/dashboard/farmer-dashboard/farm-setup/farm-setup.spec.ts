import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Auth } from '../../../../core/services/auth';
import { Farmer } from '../../../../core/services/farmer';
import type { FarmerFarm, FarmerFarmRequest } from '../../../../shared/farm.model';
import { FarmSetup } from './farm-setup';

describe('FarmSetup', () => {
  it('creates a farm with the entered coordinates when no farm exists yet', async () => {
    const requestFarmUpdate = vi.fn((farmId: number | string, request: FarmerFarmRequest) => of({
      success: true,
      message: 'Success',
      data: { id: farmId, farmerId: 8, ...request },
    }));
    const linkedFarm: FarmerFarm = {
      id: 12,
      farmerId: 8,
      name: 'Green Valley',
      county: 'Nakuru',
      address: 'Nakuru',
      sizeAcres: 10,
      ownershipType: 'OWNED',
      status: 'ACTIVE',
    };
    const getMyFarms = vi.fn()
      .mockReturnValueOnce(of({ success: true, message: 'Success', data: [] }))
      .mockReturnValueOnce(of({ success: true, message: 'Success', data: [linkedFarm] }));
    const createFarm = vi.fn();
    await TestBed.configureTestingModule({
      imports: [FarmSetup],
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: { user: signal({ id: '8', name: 'Jane Farmer', region: 'Nakuru' }) },
        },
        {
          provide: Farmer,
          useValue: {
            getProfile: vi.fn(() => of({
              success: true,
              message: 'Success',
              data: { id: '8', name: 'Jane Farmer', region: 'Nakuru', verificationStatus: 'VERIFIED' },
            })),
            getProfileImages: vi.fn(() => of({ success: true, message: 'Success', data: [] })),
            getMyFarms,
            updateProfile: vi.fn(() => of({ success: true, message: 'Success', data: {} })),
            createFarm,
            updateFarm: requestFarmUpdate,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(FarmSetup);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const setControl = (name: string, value: string) => {
      const control = fixture.nativeElement.querySelector(`[formControlName="${name}"]`) as HTMLInputElement;
      control.value = value;
      control.dispatchEvent(new Event('input', { bubbles: true }));
    };
    setControl('farmName', 'Green Valley');
    setControl('county', 'Nakuru');
    setControl('address', 'Farm road, Nakuru');
    setControl('latitude', '-1.2921');
    setControl('longitude', '36.8219');
    setControl('sizeAcres', '10');
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(requestFarmUpdate).toHaveBeenCalledWith(12, expect.objectContaining({
      name: 'Green Valley',
      latitude: -1.2921,
      longitude: 36.8219,
    }));
    expect(createFarm).not.toHaveBeenCalled();
  });
});
