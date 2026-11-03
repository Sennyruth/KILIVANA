import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiEndpoints } from '../../shared/api.config';
import type { SellerLocationRequest } from '../../shared/seller-location.model';
import { SellerLocationService } from './seller-location';

describe('SellerLocationService', () => {
  let service: SellerLocationService;
  let httpTesting: HttpTestingController;

  const request: SellerLocationRequest = {
    name: 'Main store',
    address: 'Market Road',
    county: 'Nairobi',
    latitude: -1.2921,
    longitude: 36.8219,
    contactName: 'Alex',
    contactPhone: '+254700000000',
    operatingHours: 'Mon-Sat, 8:00-17:00',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SellerLocationService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('lists the supplier warehouses belonging to the signed-in supplier', () => {
    service.getMyLocations().subscribe();
    httpTesting.expectOne(ApiEndpoints.SELLER_LOCATIONS.LIST_MINE).flush({
      success: true,
      message: 'Success',
      data: [],
    });
  });

  it('creates a warehouse using the backend location request fields', () => {
    service.createLocation(request).subscribe();
    const req = httpTesting.expectOne(ApiEndpoints.SELLER_LOCATIONS.CREATE_MINE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ success: true, message: 'Created', data: { id: 1, ...request } });
  });

  it('updates, deactivates, and sets a warehouse as default on the documented routes', () => {
    service.updateLocation(1, request).subscribe();
    const update = httpTesting.expectOne(ApiEndpoints.SELLER_LOCATIONS.UPDATE(1));
    expect(update.request.method).toBe('PUT');
    update.flush({ success: true, message: 'Updated', data: { id: 1, ...request } });

    service.deactivateLocation(1).subscribe();
    const deactivate = httpTesting.expectOne(ApiEndpoints.SELLER_LOCATIONS.DEACTIVATE(1));
    expect(deactivate.request.method).toBe('DELETE');
    deactivate.flush({ success: true, message: 'Deactivated', data: { id: 1, ...request, active: false } });

    service.setDefaultLocation(1).subscribe();
    const setDefault = httpTesting.expectOne(ApiEndpoints.SELLER_LOCATIONS.SET_DEFAULT(1));
    expect(setDefault.request.method).toBe('PUT');
    setDefault.flush({ success: true, message: 'Default updated', data: { id: 1, ...request, defaultLocation: true } });
  });
});
