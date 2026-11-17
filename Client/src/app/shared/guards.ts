import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { Auth } from '../core/services/auth';
import { Farmer } from '../core/services/farmer';
import { SellerLocationService } from '../core/services/seller-location';

function loginRedirect(router: Router, state?: RouterStateSnapshot): UrlTree {
  const returnUrl = state?.url;
  return router.createUrlTree(['/login'], returnUrl ? { queryParams: { returnUrl } } : {});
}

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  if (auth.user()?.email && auth.user()?.emailVerified === false) {
    return router.createUrlTree(['/email-verification'], { queryParams: { email: auth.user()?.email } });
  }
  return loginRedirect(router, state);
};

export const shoppingGuard: CanActivateFn = (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.isBuyer() || auth.isFarmer()) return true;
  if (auth.isAuthenticated()) return router.createUrlTree(['/dashboard/supplier']);
  return loginRedirect(router, state);
};

export const trackingGuard: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const sellerTracking = route.queryParamMap.get('perspective') === 'seller';

  if (sellerTracking && (auth.isFarmer() || auth.isSupplier())) return true;
  if (!sellerTracking && (auth.isBuyer() || auth.isFarmer())) return true;
  if (auth.isAuthenticated()) {
    return router.createUrlTree([auth.isSupplier() ? '/dashboard/supplier' : '/dashboard/farmer']);
  }
  return loginRedirect(router, state);
};

export const produceCatalogGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.isSupplier()) return router.createUrlTree(['/dashboard/supplier']);
  if (auth.isFarmer()) return router.createUrlTree(['/dashboard/farmer']);
  return true;
};

/** Keep suppliers in their dashboard while allowing public access to the input catalog. */
export const inputsCatalogGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.isSupplier()) return router.createUrlTree(['/dashboard/supplier']);
  return true;
};

export const farmerGuard: CanActivateFn = (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.isFarmer()) return true;
  if (auth.isSupplier()) return router.createUrlTree(['/dashboard/supplier']);
  if (auth.isBuyer()) return router.createUrlTree(['/dashboard/buyer']);
  return loginRedirect(router, state);
};

/** Keep farmers on inspection setup until their farm record and at least one profile photo exist. */
export const farmerDashboardGuard: CanActivateFn = (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const farmer = inject(Farmer);
  if (!auth.isFarmer()) {
    if (auth.isSupplier()) return router.createUrlTree(['/dashboard/supplier']);
    if (auth.isBuyer()) return router.createUrlTree(['/dashboard/buyer']);
    return loginRedirect(router, state);
  }
  const farmerId = auth.user()?.id;
  if (!farmerId) return loginRedirect(router, state);

  const setup = router.createUrlTree(['/dashboard/farmer/setup']);
  return forkJoin({ profile: farmer.getProfile(farmerId), farms: farmer.getMyFarms() }).pipe(
    switchMap(({ profile, farms }) => profile.success && profile.data && farms.success && (farms.data?.length ?? 0) > 0
      ? farmer.getProfileImages(farmerId)
      : of(null)),
    map((images) => images?.success && (images.data?.length ?? 0) > 0 ? true : setup),
    catchError(() => of(setup)),
  );
};

export const buyerGuard: CanActivateFn = (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.isBuyer()) return true;
  if (auth.isAuthenticated()) return router.createUrlTree(['/dashboard/farmer']);
  return loginRedirect(router, state);
};

export const supplierRoleGuard: CanActivateFn = (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.isSupplier()) return true;
  if (auth.isAuthenticated()) return router.createUrlTree(['/dashboard/farmer']);
  return loginRedirect(router, state);
};

/** Require suppliers to save a warehouse before accessing supplier tools. */
export const supplierGuard: CanActivateFn = (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const locations = inject(SellerLocationService);
  if (!auth.isSupplier()) {
    if (auth.isAuthenticated()) return router.createUrlTree(['/dashboard/farmer']);
    return loginRedirect(router, state);
  }
  return locations.getMyLocations().pipe(
    map((response) => response.success && response.data?.some((location) => location.active)
      ? true
      : router.createUrlTree(['/dashboard/supplier/setup'])),
    catchError(() => of(router.createUrlTree(['/dashboard/supplier/setup']))),
  );
};

export const unauthGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (auth.isFarmer()) return router.createUrlTree(['/dashboard/farmer']);
  if (auth.isSupplier()) return router.createUrlTree(['/dashboard/supplier']);
  if (auth.isAuthenticated()) return router.createUrlTree(['/products']);
  return true;
};
