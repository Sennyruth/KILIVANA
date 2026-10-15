import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { HttpService } from './http';
import { ApiEndpoints } from '../../shared/api.config';
import type { ApiResponse } from '../../shared/api-response';
import {
  FarmerProfile,
  FarmerProfileResponse,
  toFarmerProfile,
} from '../../shared/farmer.model';

@Injectable({ providedIn: 'root' })
export class Farmer {
  private readonly http = inject(HttpService);

  getProfile(farmerId: string): Observable<ApiResponse<FarmerProfile>> {
    return this.http.get<FarmerProfileResponse>(
      ApiEndpoints.USERS.FARMER_PROFILE(farmerId),
    ).pipe(
      map((response) => ({
        ...response,
        data: toFarmerProfile(response.data),
      })),
    );
  }
}
