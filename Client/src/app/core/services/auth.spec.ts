import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Auth } from './auth';
import { ApiEndpoints } from '../../shared/api.config';

describe('Auth', () => {
  let auth: Auth;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(Auth);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(auth).toBeTruthy();
  });

  it('trims the email and stores tokens after successful login', () => {
    auth.login(' Buyer@Example.com ', 'password123').subscribe();

    const request = httpTesting.expectOne(ApiEndpoints.AUTH.LOGIN);
    expect(request.request.body).toEqual({
      email: 'buyer@example.com',
      password: 'password123',
    });
    request.flush({
      success: true,
      message: 'Login successful',
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        user: {
          id: 7,
          name: 'Buyer',
          email: 'buyer@example.com',
          phone: '+254700000000',
          username: 'buyer',
          referenceCode: null,
          region: null,
          role: 'BUYER',
          status: 'ACTIVE',
          verificationStatus: 'NOT_REQUIRED',
          createdAt: '2026-10-07T08:00:00',
        },
      },
    });

    expect(auth.token).toBe('access-token');
    expect(auth.loading()).toBe(false);
    expect(auth.error()).toBeNull();
  });

  it('trims registration fields and omits optional empty fields', () => {
    auth.register(
      ' Buyer ',
      ' buyer@example.com ',
      ' +254700000000 ',
      'password123',
      'BUYER',
      ' ',
      ' ',
    ).subscribe();

    const request = httpTesting.expectOne(ApiEndpoints.AUTH.REGISTER);
    expect(request.request.body).toEqual({
      name: 'Buyer',
      email: 'buyer@example.com',
      phone: '+254700000000',
      password: 'password123',
      role: 'BUYER',
      username: undefined,
      region: undefined,
    });
    request.flush({
      success: true,
      message: 'Created',
      data: {
        id: 7,
        name: 'Buyer',
        email: 'buyer@example.com',
        phone: '+254700000000',
        username: null,
        referenceCode: null,
        region: null,
        role: 'BUYER',
        status: 'ACTIVE',
        verificationStatus: 'NOT_REQUIRED',
        createdAt: '2026-10-07T08:00:00',
      },
    });

    expect(auth.loading()).toBe(false);
    expect(auth.error()).toBeNull();
  });

  it('surfaces registration validation errors and clears loading', () => {
    let failed = false;
    auth.register(
      'Buyer',
      'taken@example.com',
      '+254700000000',
      'password123',
      'BUYER',
      '',
      '',
    ).subscribe({
      error: () => {
        failed = true;
      },
    });

    httpTesting.expectOne(ApiEndpoints.AUTH.REGISTER).flush(
      {
        success: false,
        message: 'Email already exists',
        data: null,
      },
      { status: 409, statusText: 'Conflict' },
    );

    expect(failed).toBe(true);
    expect(auth.error()).toBe('Email already exists');
    expect(auth.loading()).toBe(false);
  });

  it('surfaces the backend login error and clears loading after a 401', () => {
    let failed = false;
    auth.login('buyer@example.com', 'wrong-password').subscribe({
      error: () => {
        failed = true;
      },
    });

    httpTesting.expectOne(ApiEndpoints.AUTH.LOGIN).flush(
      {
        success: false,
        message: 'Invalid email or password',
        data: null,
      },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(failed).toBe(true);
    expect(auth.error()).toBe('Invalid email or password');
    expect(auth.loading()).toBe(false);
  });
});
