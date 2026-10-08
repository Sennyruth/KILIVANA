import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { EMPTY, from, catchError, switchMap, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { Auth } from '../services/auth';

/** Adds the ngrok bypass header (so ngrok returns your API, not its warning page) and the auth token. */
function withHeaders(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  const headers: Record<string, string> = {};

  if (req.url.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return Object.keys(headers).length ? req.clone({ setHeaders: headers }) : req;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);

  const isAuthEndpoint =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/register') ||
    req.url.includes('/auth/refresh');

  return next(withHeaders(req, auth.token)).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !isAuthEndpoint) {
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