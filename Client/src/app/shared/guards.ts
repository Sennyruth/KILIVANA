import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { Auth } from '../core/services/auth';
import { Farmer } from '../core/services/farmer';

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
  if (auth.isFarmer()) return router.createUrlTree(['/dashboard/farmer']);
  return true;
};

export const farmerGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.isFarmer()) return true;
  if (auth.isSupplier()) return router.createUrlTree(['/dashboard/supplier']);
  if (auth.isBuyer()) return router.createUrlTree(['/dashboard/buyer']);
  return router.createUrlTree(['/login']);
};

/** Keep farmers on inspection setup until their farm record and at least one profile photo exist. */
export const farmerDashboardGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  const farmer = inject(Farmer);
  if (!auth.isFarmer()) {
    if (auth.isSupplier()) return router.createUrlTree(['/dashboard/supplier']);
    if (auth.isBuyer()) return router.createUrlTree(['/dashboard/buyer']);
    return router.createUrlTree(['/login']);
  }
  const farmerId = auth.user()?.id;
  if (!farmerId) return router.createUrlTree(['/login']);

  const setup = router.createUrlTree(['/dashboard/farmer/setup']);
  return forkJoin({ profile: farmer.getProfile(farmerId), farms: farmer.getMyFarms() }).pipe(
    switchMap(({ profile, farms }) => profile.success && profile.data && farms.success && (farms.data?.length ?? 0) > 0
      ? farmer.getProfileImages(farmerId)
      : of(null)),
    map((images) => images?.success && (images.data?.length ?? 0) > 0 ? true : setup),
    catchError(() => of(setup)),
  );
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
  if (auth.isFarmer()) return router.createUrlTree(['/dashboard/farmer']);
  if (auth.isSupplier()) return router.createUrlTree(['/dashboard/supplier']);
  if (auth.isAuthenticated()) return router.createUrlTree(['/products']);
  return true;
};
