import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../core/services/auth';

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login']);
};

export const shoppingGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.isBuyer() || auth.isFarmer()) return true;
  if (auth.isAuthenticated()) return router.createUrlTree(['/dashboard/supplier']);
  return router.createUrlTree(['/login']);
};

export const produceCatalogGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.isSupplier()) return router.createUrlTree(['/dashboard/supplier']);
  return true;
};

export const farmerGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.isFarmer()) return true;
  if (auth.isAuthenticated()) return router.createUrlTree(['/dashboard/buyer']);
  return router.createUrlTree(['/login']);
};

export const buyerGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.isBuyer()) return true;
  if (auth.isAuthenticated()) return router.createUrlTree(['/dashboard/farmer']);
  return router.createUrlTree(['/login']);
};

export const supplierGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.isSupplier()) return true;
  if (auth.isAuthenticated()) return router.createUrlTree(['/dashboard/farmer']);
  return router.createUrlTree(['/login']);
};

export const unauthGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.isAuthenticated()) return router.createUrlTree(['/products']);
  return true;
};