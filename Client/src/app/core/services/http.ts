import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap, shareReplay, catchError } from 'rxjs/operators';
import { ApiResponse } from '../../shared/api-response';
import { API_BASE } from '../../shared/api.config';

@Injectable({ providedIn: 'root' })
export class HttpService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<unknown>>();
  private readonly baseUrl = API_BASE;

  get<T>(url: string, params?: Record<string, string | number | boolean>): Observable<ApiResponse<T>> {
    const httpParams = this.buildParams(params);
    const fullUrl = this.buildUrl(url);
    return this.http.get<ApiResponse<T>>(fullUrl, { params: httpParams });
  }

  post<T>(
    url: string,
    body: unknown,
    params?: Record<string, string | number | boolean>,
  ): Observable<ApiResponse<T>> {
    const fullUrl = this.buildUrl(url);
    return this.http.post<ApiResponse<T>>(fullUrl, body, { params: this.buildParams(params) });
  }

  put<T>(
    url: string,
    body: unknown,
    params?: Record<string, string | number | boolean>,
  ): Observable<ApiResponse<T>> {
    const fullUrl = this.buildUrl(url);
    return this.http.put<ApiResponse<T>>(fullUrl, body, { params: this.buildParams(params) });
  }

  patch<T>(url: string, body: unknown): Observable<ApiResponse<T>> {
    const fullUrl = this.buildUrl(url);
    return this.http.patch<ApiResponse<T>>(fullUrl, body);
  }

  delete<T>(url: string): Observable<ApiResponse<T>> {
    const fullUrl = this.buildUrl(url);
    return this.http.delete<ApiResponse<T>>(fullUrl);
  }

  cached<T>(url: string): Observable<ApiResponse<T>> {
    const cached = this.cache.get(url) as Observable<ApiResponse<T>> | undefined;
    if (cached) return cached;
    const request = this.get<T>(url).pipe(
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.cache.set(url, request);
    return request;
  }

  invalidate(url: string): void {
    this.cache.delete(url);
  }

  private buildUrl(url: string): string {
    if (url.startsWith('http')) return url;
    if (url === this.baseUrl || url.startsWith(`${this.baseUrl}/`)) return url;
    return url.startsWith('/') ? `${this.baseUrl}${url}` : `${this.baseUrl}/${url}`;
  }

  private buildParams(params?: Record<string, string | number | boolean>): HttpParams | undefined {
    if (!params) return undefined;
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return httpParams;
  }
}