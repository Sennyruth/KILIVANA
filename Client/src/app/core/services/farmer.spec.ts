import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE } from '../../shared/api.config';
import { Farmer } from './farmer';

describe('Farmer', () => {
  let service: Farmer;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(Farmer);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads a farmer public profile including the region', () => {
    let profile: { id: string; name: string; region: string | null } | undefined;
    service.getPublicProfile('23').subscribe((response) => {
      profile = response.data;
    });

    httpTesting.expectOne(`${API_BASE}/users/farmers/23`).flush({
      success: true,
      message: 'Success',
      data: {
        id: 23,
        name: 'Jane Farmer',
        region: 'Nakuru County',
        verificationStatus: 'VERIFIED',
      },
    });

    expect(profile).toEqual({
      id: '23',
      name: 'Jane Farmer',
      region: 'Nakuru County',
      verificationStatus: 'VERIFIED',
      createdAt: undefined,
    });
  });

  it('creates a farm with latitude and longitude coordinates', () => {
    const request = {
      name: 'Green Valley Farm',
      county: 'Nakuru',
      address: 'Farm road, Nakuru',
      latitude: -1.2921,
      longitude: 36.8219,
      sizeAcres: 10,
      ownershipType: 'OWNED' as const,
    };

    service.createFarm(request).subscribe();

    const createRequest = httpTesting.expectOne(`${API_BASE}/farmers/me/farms`);
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toEqual(request);
    createRequest.flush({
      success: true,
      message: 'Success',
      data: { id: 1, farmerId: 23, ...request },
    });
  });
});
