import { Service, inject, computed } from '@angular/core';
import { BehaviorSubject, Observable, EMPTY, of, switchMap, tap, map, shareReplay, filter, take, firstValueFrom } from 'rxjs';

import { HttpService } from './http';
import { ApiEndpoints } from '../../shared/api.config';
import { User, AuthTokens, AuthUserResponse, UserRole } from '../../shared/user.model';

const ACCESS_KEY = 'kilivana_access_token';
const REFRESH_KEY = 'kilivana_refresh_token';
const USER_KEY = 'kilivana_user';

@Service()
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

  readonly isAuthenticated = computed(() => this._user.value !== null);
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

  register(
    name: string,
    email: string,
    phone: string,
    password: string,
    role: UserRole,
  ): Observable<import('../../shared/api-response').ApiResponse<AuthUserResponse>> {
    this._loading.next(true);
    this._error.next(null);
    return this.http
      .post<AuthUserResponse>(ApiEndpoints.AUTH.REGISTER, { name, email, phone, password, role })
      .pipe(
        tap((res) => {
          if (res.success && res.data) this.storeAuth(res.data);
          this._loading.next(false);
        }),
      );
  }

  login(
    email: string,
    password: string,
  ): Observable<import('../../shared/api-response').ApiResponse<AuthUserResponse>> {
    this._loading.next(true);
    this._error.next(null);
    return this.http
      .post<AuthUserResponse>(ApiEndpoints.AUTH.LOGIN, { email, password })
      .pipe(
        tap((res) => {
          if (res.success && res.data) this.storeAuth(res.data);
          this._loading.next(false);
        }),
      );
  }

  fetchProfile(): Observable<import('../../shared/api-response').ApiResponse<{ user: User }>> {
    return this.http.get<{ user: User }>(ApiEndpoints.AUTH.PROFILE).pipe(
      tap((res) => {
        if (res.success && res.data?.user) {
          this._user.next(res.data.user);
          localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
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
      this.http.post<AuthTokens>(ApiEndpoints.AUTH.REFRESH, { refreshToken: rt }),
    ).then((res) => {
      if (res.success && res.data) {
        this.storeTokens(res.data);
        return res.data.accessToken;
      }
      throw new Error(res.message || 'Refresh failed');
    }).finally(() => {
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

  private storeAuth(data: AuthUserResponse): void {
    this.storeTokens(data.tokens);
    this._user.next(data.user);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }

  private storeTokens(tokens: AuthTokens): void {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
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