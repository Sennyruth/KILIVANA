import { Injectable, inject, computed, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, tap, firstValueFrom, catchError, finalize, throwError } from 'rxjs';

import { HttpService } from './http';
import { ApiEndpoints } from '../../shared/api.config';
import { User, UserRole, UserResponse, AuthTokenResponse, toUser } from '../../shared/user.model';
import { ApiResponse } from '../../shared/api-response';

const ACCESS_KEY = 'kilivana_access_token';
const REFRESH_KEY = 'kilivana_refresh_token';
const USER_KEY = 'kilivana_user';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpService);

  private readonly _user = signal<User | null>(this.loadUser());
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private refreshPromise$: Promise<string> | null = null;

  readonly user = this._user.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly role = computed<UserRole | null>(() => this._user()?.role ?? null);
  readonly isFarmer = computed(() => this._user()?.role === 'FARMER');
  readonly isBuyer = computed(() => this._user()?.role === 'BUYER');
  readonly isSupplier = computed(() => this._user()?.role === 'SUPPLIER');
  readonly name = computed(() => this._user()?.name ?? '');
  readonly avatarUrl = computed(() => this._user()?.avatarUrl ?? '');

  get token(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
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
    this._loading.set(true);
    this._error.set(null);
    return this.http
      .post<UserResponse>(ApiEndpoints.AUTH.REGISTER, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        role,
        username: username.trim() || undefined,
        region: region.trim() || undefined,
      })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          const body = error.error as { message?: string; error?: { details?: string } } | null;
          this._error.set(
            body?.message ||
              body?.error?.details ||
              (error.status === 0
                ? 'Unable to reach the server. Check your connection and try again.'
                : 'Registration failed. Check your details and try again.'),
          );
          return throwError(() => error);
        }),
        finalize(() => this._loading.set(false)),
      );
  }

  login(email: string, password: string): Observable<ApiResponse<AuthTokenResponse>> {
    this._loading.set(true);
    this._error.set(null);
    return this.http
      .post<AuthTokenResponse>(ApiEndpoints.AUTH.LOGIN, {
        email: email.trim().toLowerCase(),
        password,
      })
      .pipe(
        tap((res) => {
          if (res.success && res.data) this.storeAuth(res.data);
        }),
        catchError((error: HttpErrorResponse) => {
          const body = error.error as { message?: string } | null;
          this._error.set(
            body?.message ||
              (error.status === 0
                ? 'Unable to reach the server. Check your connection and try again.'
                : 'Login failed. Please check your email and password and try again.'),
          );
          return throwError(() => error);
        }),
        finalize(() => this._loading.set(false)),
      );
  }

  fetchProfile(): Observable<ApiResponse<UserResponse | { user: UserResponse }>> {
    return this.http.get<UserResponse | { user: UserResponse }>(ApiEndpoints.AUTH.PROFILE).pipe(
      tap((res) => {
        const responseUser = res.data && 'user' in res.data ? res.data.user : res.data;
        if (res.success && responseUser) {
          const user = toUser(responseUser);
          this._user.set(user);
          localStorage.setItem(USER_KEY, JSON.stringify(user));
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
    ).then((res) => {
      if (res.success && res.data) {
        this.storeAuth(res.data);
        return res.data.accessToken;
      }
      throw new Error(res.message || 'Refresh failed');
    }).finally(() => {
      this.refreshPromise$ = null;
    });
    return this.refreshPromise$;
  }

  forgotPassword(email: string): Observable<ApiResponse<string>> {
    this._loading.set(true);
    this._error.set(null);
    return this.http.post<string>(
      ApiEndpoints.AUTH.FORGOT_PASSWORD,
      {},
      { email: email.trim().toLowerCase() },
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        const body = error.error as { message?: string } | null;
        this._error.set(
          body?.message ||
            (error.status === 0
              ? 'Unable to reach the server. Check your connection and try again.'
              : 'Unable to request a password reset. Please try again.'),
        );
        return throwError(() => error);
      }),
      finalize(() => this._loading.set(false)),
    );
  }

  resetPassword(token: string, newPassword: string): Observable<ApiResponse<string>> {
    this._loading.set(true);
    this._error.set(null);
    return this.http.post<string>(ApiEndpoints.AUTH.RESET_PASSWORD, {
      token,
      newPassword,
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        const body = error.error as { message?: string } | null;
        this._error.set(
          body?.message ||
            (error.status === 0
              ? 'Unable to reach the server. Check your connection and try again.'
              : 'Unable to reset your password. The link may have expired.'),
        );
        return throwError(() => error);
      }),
      finalize(() => this._loading.set(false)),
    );
  }

  logout(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    this._user.set(null);
    this._error.set(null);
  }

  private storeAuth(data: AuthTokenResponse): void {
    localStorage.setItem(ACCESS_KEY, data.accessToken);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
    const user = toUser(data.user);
    this._user.set(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
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
