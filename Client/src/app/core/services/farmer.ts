import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { HttpService } from './http';
import { API_BASE, API_ORIGIN, ApiEndpoints } from '../../shared/api.config';
import type { ApiResponse } from '../../shared/api-response';
import type { FarmerFarm, FarmerFarmRequest } from '../../shared/farm.model';
import type { FarmOwnershipType } from '../../shared/farm.model';
import {
  FarmerProfile,
  FarmerProfileImage,
  FarmerProfileResponse,
  toFarmerProfile,
} from '../../shared/farmer.model';

export interface FarmerProfileRequest {
  farmName: string;
  location: string;
  farmDetails?: string;
  verificationInfo?: string;
  sizeAcres?: number;
  ownershipType?: FarmOwnershipType;
}

@Injectable({ providedIn: 'root' })
export class Farmer {
  private readonly http = inject(HttpService);
  private readonly imageHttp = inject(HttpClient);

  getMyFarms(): Observable<ApiResponse<FarmerFarm[]>> {
    return this.http.get<FarmerFarm[]>(ApiEndpoints.FARMER_FARMS.LIST_MINE);
  }

  createFarm(request: FarmerFarmRequest): Observable<ApiResponse<FarmerFarm>> {
    return this.http.post<FarmerFarm>(ApiEndpoints.FARMER_FARMS.CREATE_MINE, request);
  }

  updateFarm(farmId: string | number, request: FarmerFarmRequest): Observable<ApiResponse<FarmerFarm>> {
    return this.http.put<FarmerFarm>(ApiEndpoints.FARMER_FARMS.UPDATE_MINE(farmId), request);
  }

  getProfile(farmerId: string): Observable<ApiResponse<FarmerProfile>> {
    return this.http.get<FarmerProfileResponse>(
      ApiEndpoints.PROFILES.FARMER(farmerId),
    ).pipe(
      map((response) => ({
        ...response,
        data: toFarmerProfile(response.data),
      })),
    );
  }

  getPublicProfile(farmerId: string): Observable<ApiResponse<FarmerProfile>> {
    return this.http.get<FarmerProfileResponse>(
      ApiEndpoints.USERS.PUBLIC_FARMER(farmerId),
    ).pipe(
      map((response) => ({
        ...response,
        data: toFarmerProfile(response.data),
      })),
    );
  }

  createProfile(farmerId: string, request: FarmerProfileRequest): Observable<ApiResponse<FarmerProfile>> {
    return this.http.post<FarmerProfileResponse>(ApiEndpoints.PROFILES.FARMER(farmerId), request).pipe(
      map((response) => ({ ...response, data: toFarmerProfile(response.data) })),
    );
  }

  updateProfile(farmerId: string, request: FarmerProfileRequest): Observable<ApiResponse<FarmerProfile>> {
    return this.http.put<FarmerProfileResponse>(ApiEndpoints.PROFILES.FARMER(farmerId), request).pipe(
      map((response) => ({ ...response, data: toFarmerProfile(response.data) })),
    );
  }

  getProfileImages(farmerId: string): Observable<ApiResponse<FarmerProfileImage[]>> {
    return this.http.get<FarmerProfileImage[]>(ApiEndpoints.PROFILES.FARMER_IMAGES(farmerId)).pipe(
      map((response) => ({
        ...response,
        data: Array.isArray(response.data)
          ? response.data.map((image) => ({ ...image, url: resolveImageUrl(image.url) }))
          : [],
      })),
    );
  }

  getImageObjectUrl(url: string): Observable<string> {
    return this.imageHttp.get(resolveImageUrl(url), { responseType: 'blob' }).pipe(
      map((blob) => URL.createObjectURL(blob)),
    );
  }

  uploadProfileImage(
    farmerId: string,
    file: File,
    isPrimary: boolean,
  ): Observable<ApiResponse<FarmerProfileImage[]>> {
    const body = new FormData();
    body.append('image', file);
    return this.http.post<FarmerProfileImage[]>(
      ApiEndpoints.PROFILES.FARMER_IMAGES(farmerId),
      body,
      { isPrimary },
    ).pipe(
      map((response) => ({
        ...response,
        data: Array.isArray(response.data)
          ? response.data.map((image) => ({ ...image, url: resolveImageUrl(image.url) }))
          : [],
      })),
    );
  }
}

function resolveImageUrl(url: string): string {
  if (!url || /^(data:|blob:|\/\/)/i.test(url)) return url;
  const apiOrigin = API_BASE.startsWith('http') ? new URL(API_BASE).origin : API_ORIGIN;
  const isBackendImage = (path: string) =>
    path.startsWith('/api/v1/images/') || path.startsWith('/uploads/');

  if (/^https?:\/\//i.test(url)) {
    const parsed = new URL(url);
    return apiOrigin && isBackendImage(parsed.pathname)
      ? new URL(`${parsed.pathname}${parsed.search}`, apiOrigin).toString()
      : url;
  }

  const path = url.startsWith('/') ? url : `/${url}`;
  if (apiOrigin && isBackendImage(path)) return new URL(path, apiOrigin).toString();
  if (API_BASE.startsWith('http')) return new URL(path, new URL(API_BASE).origin).toString();
  return path;
}
