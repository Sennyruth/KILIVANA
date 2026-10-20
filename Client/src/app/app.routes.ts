import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';
import { ResetPassword } from './features/auth/reset-password/reset-password';
import { Logout } from './features/auth/logout/logout';
import { ProductList } from './features/products/product-list/product-list';
import { ProductDetail } from './features/products/product-detail/product-detail';
import { CartView } from './features/cart/cart-view/cart-view';
import { Checkout } from './features/orders/checkout/checkout';
import { OrderHistory } from './features/orders/order-history/order-history';
import { SupplierOrders } from './features/orders/supplier-orders/supplier-orders';
import { OrderTracker } from './features/tracking/order-tracker/order-tracker';
import { FarmerDashboard } from './features/dashboard/farmer-dashboard/farmer-dashboard';
import { BuyerDashboard } from './features/dashboard/buyer-dashboard/buyer-dashboard';
import { SupplierDashboard } from './features/dashboard/supplier-dashboard/supplier-dashboard';
import { AddProduct } from './features/dashboard/farmer-dashboard/add-product/add-product';
import { EditProduct } from './features/dashboard/farmer-dashboard/edit-product/edit-product';
import { AddSupply } from './features/dashboard/supplier-dashboard/add-supply/add-supply';
import { EditSupply } from './features/dashboard/supplier-dashboard/edit-supply/edit-supply';
import { FarmSetup } from './features/dashboard/farmer-dashboard/farm-setup/farm-setup';
import { InputsList } from './features/inputs/inputs-list/inputs-list';
import { InputsDetail } from './features/inputs/inputs-detail/inputs-detail';
import {
  authGuard,
  unauthGuard,
  farmerGuard,
  buyerGuard,
  supplierGuard,
  farmerDashboardGuard,
  shoppingGuard,
  produceCatalogGuard,
} from './shared/guards';

export const routes: Routes = [
  { path: '', redirectTo: 'products', pathMatch: 'full' },
  { path: 'login', component: Login, canActivate: [unauthGuard] },
  { path: 'register', component: Register, canActivate: [unauthGuard] },
  { path: 'forgot-password', component: ForgotPassword, canActivate: [unauthGuard] },
  { path: 'reset-password', component: ResetPassword },
  { path: 'logout', component: Logout, canActivate: [authGuard] },
  { path: 'products', component: ProductList, canActivate: [produceCatalogGuard] },
  { path: 'products/:id', component: ProductDetail, canActivate: [produceCatalogGuard] },
  { path: 'inputs', component: InputsList, canActivate: [farmerGuard] },
  { path: 'inputs/:id', component: InputsDetail, canActivate: [farmerGuard] },
  { path: 'cart', component: CartView, canActivate: [shoppingGuard] },
  { path: 'checkout', component: Checkout, canActivate: [shoppingGuard] },
  { path: 'orders', component: OrderHistory, canActivate: [shoppingGuard] },
  { path: 'dashboard/supplier/orders', component: SupplierOrders, canActivate: [supplierGuard] },
  { path: 'tracking/:orderId', component: OrderTracker, canActivate: [shoppingGuard] },
  { path: 'dashboard/farmer/setup', component: FarmSetup, canActivate: [farmerGuard] },
  { path: 'dashboard/farmer', component: FarmerDashboard, canActivate: [farmerDashboardGuard] },
  { path: 'dashboard/farmer/add-product', component: AddProduct, canActivate: [farmerGuard] },
  { path: 'dashboard/farmer/edit-product/:id', component: EditProduct, canActivate: [farmerGuard] },
  { path: 'dashboard/buyer', component: BuyerDashboard, canActivate: [buyerGuard] },
  { path: 'dashboard/supplier', component: SupplierDashboard, canActivate: [supplierGuard] },
  { path: 'dashboard/supplier/add-supply', component: AddSupply, canActivate: [supplierGuard] },
  { path: 'dashboard/supplier/edit-supply/:id', component: EditSupply, canActivate: [supplierGuard] },
];
