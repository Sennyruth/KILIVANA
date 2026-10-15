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
    service.getProfile('23').subscribe((response) => {
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
});
