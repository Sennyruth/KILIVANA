import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login';
import { Register } from './features/auth/register/register';
import { ProductList } from './features/products/product-list/product-list';
import { ProductDetail } from './features/products/product-detail/product-detail';
import { CartView } from './features/cart/cart-view/cart-view';
import { Checkout } from './features/orders/checkout/checkout';
import { OrderHistory } from './features/orders/order-history/order-history';
import { OrderTracker } from './features/tracking/order-tracker/order-tracker';
import { FarmerDashboard } from './features/dashboard/farmer-dashboard/farmer-dashboard';
import { BuyerDashboard } from './features/dashboard/buyer-dashboard/buyer-dashboard';
import { SupplierDashboard } from './features/dashboard/supplier-dashboard/supplier-dashboard';
import { AddProduct } from './features/dashboard/farmer-dashboard/add-product/add-product';
import { EditProduct } from './features/dashboard/farmer-dashboard/edit-product/edit-product';
import { AddSupply } from './features/dashboard/supplier-dashboard/add-supply/add-supply';
import { EditSupply } from './features/dashboard/supplier-dashboard/edit-supply/edit-supply';
import { InputsList } from './features/inputs/inputs-list/inputs-list';
import { InputsDetail } from './features/inputs/inputs-detail/inputs-detail';
import { authGuard, unauthGuard, farmerGuard, buyerGuard, supplierGuard } from './shared/guards';

export const routes: Routes = [
  { path: '', redirectTo: 'products', pathMatch: 'full' },
  { path: 'login', component: Login, canActivate: [unauthGuard] },
  { path: 'register', component: Register, canActivate: [unauthGuard] },
  { path: 'products', component: ProductList },
  { path: 'products/:id', component: ProductDetail },
  { path: 'inputs', component: InputsList },
  { path: 'inputs/:id', component: InputsDetail },
  { path: 'cart', component: CartView, canActivate: [authGuard] },
  { path: 'checkout', component: Checkout, canActivate: [authGuard] },
  { path: 'orders', component: OrderHistory, canActivate: [authGuard] },
  { path: 'tracking/:orderId', component: OrderTracker, canActivate: [authGuard] },
  { path: 'dashboard/farmer', component: FarmerDashboard, canActivate: [farmerGuard] },
  { path: 'dashboard/farmer/add-product', component: AddProduct, canActivate: [farmerGuard] },
  { path: 'dashboard/farmer/edit-product/:id', component: EditProduct, canActivate: [farmerGuard] },
  { path: 'dashboard/buyer', component: BuyerDashboard, canActivate: [buyerGuard] },
  { path: 'dashboard/supplier', component: SupplierDashboard, canActivate: [supplierGuard] },
  { path: 'dashboard/supplier/add-supply', component: AddSupply, canActivate: [supplierGuard] },
  { path: 'dashboard/supplier/edit-supply/:id', component: EditSupply, canActivate: [supplierGuard] },
];