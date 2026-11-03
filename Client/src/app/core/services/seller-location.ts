import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { HttpService } from './http';
import { ApiEndpoints } from '../../shared/api.config';
import type { ApiResponse } from '../../shared/api-response';
import type { SellerLocation, SellerLocationRequest } from '../../shared/seller-location.model';

@Injectable({ providedIn: 'root' })
export class SellerLocationService {
  private readonly http = inject(HttpService);

  getMyLocations(): Observable<ApiResponse<SellerLocation[]>> {
    return this.http.get<SellerLocation[]>(ApiEndpoints.SELLER_LOCATIONS.LIST_MINE);
  }

  getLocation(locationId: string | number): Observable<ApiResponse<SellerLocation>> {
    return this.http.get<SellerLocation>(ApiEndpoints.SELLER_LOCATIONS.DETAIL(locationId));
  }

  createLocation(request: SellerLocationRequest): Observable<ApiResponse<SellerLocation>> {
    return this.http.post<SellerLocation>(ApiEndpoints.SELLER_LOCATIONS.CREATE_MINE, request);
  }

  updateLocation(
    locationId: string | number,
    request: SellerLocationRequest,
  ): Observable<ApiResponse<SellerLocation>> {
    return this.http.put<SellerLocation>(ApiEndpoints.SELLER_LOCATIONS.UPDATE(locationId), request);
  }

  deactivateLocation(locationId: string | number): Observable<ApiResponse<SellerLocation>> {
    return this.http.delete<SellerLocation>(ApiEndpoints.SELLER_LOCATIONS.DEACTIVATE(locationId));
  }

  setDefaultLocation(locationId: string | number): Observable<ApiResponse<SellerLocation>> {
    return this.http.put<SellerLocation>(ApiEndpoints.SELLER_LOCATIONS.SET_DEFAULT(locationId), null);
  }
}
