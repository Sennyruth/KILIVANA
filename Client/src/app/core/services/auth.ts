import { Injectable, inject, computed } from '@angular/core';
import { BehaviorSubject, Observable, throwError, switchMap, tap, finalize, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpErrorResponse } from '@angular/common/http';

import { HttpService } from './http';
import { ApiEndpoints } from '../../shared/api.config';
import { ApiResponse } from '../../shared/api-response';
import { AuthTokenResponse, User, UserResponse, UserRole, toUser } from '../../shared/user.model';

const ACCESS_KEY = 'kilivana_access_token';
const REFRESH_KEY = 'kilivana_refresh_token';
const USER_KEY = 'kilivana_user';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpService);

  private readonly _user = new BehaviorSubject<User | null>(this.loadUser());
  private readonly _loading = new BehaviorSubject<boolean>(false);
  private readonly _error = new BehaviorSubject<string | null>(null);
  private refreshPromise$: Promise<string> | null = null;

  readonly user$ = this._user.asObservable();
  readonly loading$ = this._loading.asObservable();
  readonly error$ = this._error.asObservable();

  readonly user = computed(() => this._user.value);
  readonly loading = computed(() => this._loading.value);
  readonly error = computed(() => this._error.value);

  readonly isAuthenticated = computed(() => this._user.value !== null && this.token !== null);
  readonly role = computed<UserRole | null>(() => this._user.value?.role ?? null);
  readonly isFarmer = computed(() => this._user.value?.role === 'FARMER');
  readonly isBuyer = computed(() => this._user.value?.role === 'BUYER');
  readonly isSupplier = computed(() => this._user.value?.role === 'SUPPLIER');
  readonly name = computed(() => this._user.value?.name ?? '');
  readonly avatarUrl = computed(() => this._user.value?.avatarUrl ?? '');

  get token(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  login(email: string, password: string): Observable<ApiResponse<AuthTokenResponse>> {
    this._loading.next(true);
    this._error.next(null);
    return this.http.post<AuthTokenResponse>(ApiEndpoints.AUTH.LOGIN, { email, password }).pipe(
      tap((res) => {
        if (res.success && res.data?.accessToken) {
          this.storeAuth(res.data);
        }
      }),
      catchError((err: HttpErrorResponse) => this.fail(err)),
      finalize(() => this._loading.next(false)),
    );
  }

  register(
    name: string,
    email: string,
    phone: string,
    password: string,
    role: UserRole,
    username: string,
    region: string,
  ): Observable<ApiResponse<UserResponse>> {
    this._loading.next(true);
    this._error.next(null);
    return this.http
      .post<UserResponse>(ApiEndpoints.AUTH.REGISTER, { name, email, phone, password, role, username, region })
      .pipe(catchError((err: HttpErrorResponse) => this.fail(err)), finalize(() => this._loading.next(false)));
  }

  fetchProfile(): Observable<ApiResponse<UserResponse>> {
    return this.http.get<UserResponse>(ApiEndpoints.AUTH.PROFILE).pipe(
      tap((res) => {
        if (res.success && res.data) {
          this.storeUser(res.data);
        }
      }),
    );
  }

  refreshAccessToken(): Promise<string> {
    const existing = this.refreshPromise$;
    if (existing) return existing;
    const rt = this.refreshToken;
    if (!rt) return Promise.reject('No refresh token');

    this.refreshPromise$ = firstValueFrom(
      this.http.post<AuthTokenResponse>(ApiEndpoints.AUTH.REFRESH, { refreshToken: rt }),
    )
      .then((res) => {
        if (res.success && res.data?.accessToken) {
          localStorage.setItem(ACCESS_KEY, res.data.accessToken);
          if (res.data.refreshToken) {
            localStorage.setItem(REFRESH_KEY, res.data.refreshToken);
          }
          return res.data.accessToken;
        }
        throw new Error(res.message || 'Refresh failed');
      })
      .catch((err) => {
        this.logout();
        return Promise.reject(err);
      })
      .finally(() => {
        this.refreshPromise$ = null;
      });
    return this.refreshPromise$;
  }

  logout(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.next(null);
    this._error.next(null);
  }

  private storeAuth(data: AuthTokenResponse): void {
    localStorage.setItem(ACCESS_KEY, data.accessToken);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
    this.storeUser(data.user);
  }

  private storeUser(response: UserResponse): void {
    const user = toUser(response);
    this._user.next(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  private fail(err: HttpErrorResponse): Observable<never> {
    const body = err.error as Partial<ApiResponse<unknown>> | string | null;
    const message =
      typeof body === 'object' && body?.message
        ? body.message
        : err.status === 0
          ? 'Cannot reach the server. Check your connection.'
          : 'Something went wrong. Please try again.';
    this._error.next(message);
    return throwError(() => err);
  }

  private loadUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }
}