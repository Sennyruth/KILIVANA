import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { EMPTY, from, catchError, switchMap, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { Auth } from '../services/auth';
import { API_BASE, API_ORIGIN } from '../../shared/api.config';

function isApiRequest(url: string): boolean {
  if (url.startsWith(API_BASE)) return true;
  if (url.startsWith('/api/v1/')) return true;
  if (url.startsWith('/uploads/')) return true;

  try {
    const requestUrl = new URL(url);
    return requestUrl.origin === API_ORIGIN &&
      (requestUrl.pathname.startsWith('/api/v1/') || requestUrl.pathname.startsWith('/uploads/'));
  } catch {
    return false;
  }
}

/** Adds the ngrok bypass header (so ngrok returns your API, not its warning page) and the auth token. */
function withHeaders(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  const headers: Record<string, string> = {};

  const isApi = isApiRequest(req.url);
  if (isApi && API_ORIGIN.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }
  if (isApi && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return Object.keys(headers).length ? req.clone({ setHeaders: headers }) : req;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const isApi = isApiRequest(req.url);

  const isAuthEndpoint =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/register') ||
    req.url.includes('/auth/refresh');

  // Do NOT send Authorization header for refresh endpoint
  const shouldSendToken = isApi && !req.url.includes('/auth/refresh');

  return next(withHeaders(req, shouldSendToken ? auth.token : null)).pipe(
    catchError((err: HttpErrorResponse) => {
      if (isApi && err.status === 401 && !isAuthEndpoint) {
        return from(auth.refreshAccessToken()).pipe(
          switchMap(() => next(withHeaders(req, auth.token))),
          catchError(() => {
            auth.logout();
            return EMPTY;
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
