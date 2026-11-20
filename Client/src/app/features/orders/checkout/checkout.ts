import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Cart } from '../../../core/services/cart';
import { Auth } from '../../../core/services/auth';
import { HttpService } from '../../../core/services/http';
import { Order } from '../../../core/services/order';
import { Payment } from '../../../core/services/payment';
import { Product } from '../../../core/services/product';
import { ApiEndpoints } from '../../../shared/api.config';
import { NotificationService } from '../../../shared/notification/notification.service';
import { normalizePaymentStatus, type PaymentStatus, type StkPushInitiateResponse } from '../../../shared/payment.model';
import type { Subscription } from 'rxjs';

interface PickupStation {
  id: number;
  name: string;
  address: string;
  region: string;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
  openingHours?: string;
  hours?: string;
  pickupInstructions?: string;
  contactPhone?: string | null;
  phone?: string | null;
  isAvailable: boolean;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface PickupStationWithDistance {
  station: PickupStation;
  distanceKm: number | null;
}

export function pickupDistanceKm(
  station: { latitude?: number | null; longitude?: number | null },
  location: Coordinates,
): number | null {
  const stationLatitude = station.latitude;
  const stationLongitude = station.longitude;
  if (
    stationLatitude == null ||
    stationLongitude == null ||
    !Number.isFinite(stationLatitude) ||
    !Number.isFinite(stationLongitude) ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude) ||
    Math.abs(stationLatitude) > 90 ||
    Math.abs(location.latitude) > 90 ||
    Math.abs(stationLongitude) > 180 ||
    Math.abs(location.longitude) > 180
  ) {
    return null;
  }

  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDifference = radians(location.latitude - stationLatitude);
  const longitudeDifference = radians(location.longitude - stationLongitude);
  const haversine = Math.min(1, Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(radians(stationLatitude)) * Math.cos(radians(location.latitude))
    * Math.sin(longitudeDifference / 2) ** 2);

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function formatCheckoutError(message: string): string {
  if (
    /null value in column[\s\S]*order_id|order_id[\s\S]*not-null constraint/i.test(message)
    && /payments/i.test(message)
  ) {
    return 'The payment service could not save your pending payment. Check whether an M-Pesa prompt arrived before trying again. No order can be shown until payment is confirmed.';
  }
  if (/product dispatch location requires an address and valid coordinates/i.test(message)) {
    return 'A farmer or supplier has not added a valid dispatch address and map pin. The seller must update their farm or warehouse location before checkout can continue.';
  }
  return message;
}

interface DeliveryQuote {
  quoteId: string;
  deliveryFee: number;
  subtotal: number;
  total: number;
  currency: string;
}

@Component({
  selector: 'app-checkout',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatListModule,
    MatProgressSpinnerModule,
    CurrencyPipe,
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
  ],
  styleUrl: './checkout.scss',
  templateUrl: './checkout.html',
})
export class Checkout implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly cart = inject(Cart);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly http = inject(HttpService);
  private readonly orderService = inject(Order);
  private readonly payment = inject(Payment);
  private readonly productService = inject(Product);
  private readonly notification = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  private paymentPolling?: Subscription;
  protected readonly paymentStatus = signal<PaymentStatus['paymentStatus'] | null>(null);
  protected readonly submitting = signal(false);
  protected readonly paymentMessage = signal<string | null>(null);
  protected readonly paymentState = signal<'idle' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'unknown'>('idle');
  protected readonly paymentDetails = signal<PaymentStatus | null>(null);
  protected readonly checkingPaymentStatus = signal(false);
  protected readonly pendingOrderId = signal<number | null>(null);
  protected readonly pendingPaymentId = signal<number | null>(null);
  private pendingCheckoutItems: Array<{ productId: string; quantity: number }> = [];
  private checkoutFinalized = false;
  protected readonly canRetryPayment = computed(() =>
    this.paymentState() === 'cancelled' || this.paymentState() === 'failed',
  );
  protected readonly pickupStations = signal<PickupStation[]>([]);
  protected readonly selectedPickupStationId = signal<number | null>(null);
  protected readonly stationsLoading = signal(false);
  protected readonly locatingNearestStation = signal(false);
  protected readonly deliveryMethod = signal<'door' | 'pickup'>('pickup');
  protected readonly pickupChoice = signal<'station' | 'typed'>('station');
  private readonly userLocation = signal<Coordinates | null>(null);
  private readonly quotedSubtotal = signal<number | null>(null);
  private readonly quotedDelivery = signal<number | null>(null);
  protected readonly pickupStationsByDistance = computed<PickupStationWithDistance[]>(() => {
    const location = this.userLocation();
    return this.pickupStations()
      .map((station) => ({
        station,
        distanceKm: location ? pickupDistanceKm({
          latitude: station.latitude ?? station.lat,
          longitude: station.longitude ?? station.lng,
        }, location) : null,
      }))
      .sort((first, second) => (first.distanceKm ?? Infinity) - (second.distanceKm ?? Infinity));
  });
  protected readonly selectedPickupStation = computed(() =>
    this.pickupStations().find((station) => station.id === this.selectedPickupStationId()) ?? null,
  );

  protected readonly form: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    address: ['', [Validators.required, Validators.minLength(10)]],
    county: ['', [Validators.required]],
    pickupLocation: ['', [Validators.maxLength(500)]],
    phone: [this.savedPhoneNumber(), [Validators.pattern(/^\+254[17]\d{8}$/)]],
  });

  protected readonly subtotal = computed(() => this.quotedSubtotal() ?? this.cart.totalPrice());
  protected readonly delivery = computed(() => this.quotedDelivery() ?? (this.cart.totalPrice() > 0 ? 1 : 0));
  protected readonly total = computed(() => this.subtotal() + this.delivery());

  ngOnInit(): void {
    this.stationsLoading.set(true);
    this.http.get<PickupStation[]>(ApiEndpoints.PICKUP_STATIONS.AVAILABLE).subscribe({
      next: (response) => {
        const stations = response.success && Array.isArray(response.data)
          ? response.data.filter((station) => station.isAvailable)
          : [];
        this.pickupStations.set(stations);
        this.selectedPickupStationId.set(stations[0]?.id ?? null);
        this.stationsLoading.set(false);
        if (!stations.length) this.notification.warning('No pickup stations are currently available.');
      },
      error: () => {
        this.stationsLoading.set(false);
        this.notification.error('Could not load pickup stations. Please try again.');
      },
    });
    this.cart.load().subscribe({
      error: () => {
        this.notification.error('Failed to load cart');
      }
    });
  }

  protected findNearestPickupStation(): void {
    if (!navigator.geolocation) {
      this.notification.warning('Location is not available in this browser. Choose a pickup point manually.');
      return;
    }

    this.locatingNearestStation.set(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.locatingNearestStation.set(false);
        const location = { latitude: coords.latitude, longitude: coords.longitude };
        if (pickupDistanceKm(location, location) === null) {
          this.notification.error('Your location could not be read. Choose a pickup point manually.');
          return;
        }

        this.userLocation.set(location);
        const nearest = this.pickupStationsByDistance().find((item) => item.distanceKm !== null);
        if (!nearest) {
          this.notification.warning('Pickup point coordinates are not available yet. Choose a point manually.');
          return;
        }
        this.selectedPickupStationId.set(nearest.station.id);
      },
      () => {
        this.locatingNearestStation.set(false);
        this.notification.error('We could not access your location. Check browser permissions or choose a pickup point manually.');
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  }

  protected mapUrl(station: PickupStation): string | null {
    const latitude = station.latitude ?? station.lat;
    const longitude = station.longitude ?? station.lng;
    if (latitude == null || longitude == null
      || pickupDistanceKm({ latitude, longitude }, { latitude, longitude }) === null) {
      return null;
    }
    return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
  }

  protected placeOrder(): void {
    const pickupSelected = this.deliveryMethod() === 'pickup';
    const typedPickupLocation = String(this.form.get('pickupLocation')?.value ?? '').trim();
    const typedPickupSelected = pickupSelected && this.pickupChoice() === 'typed';
    const pickupInvalid = pickupSelected && (typedPickupSelected
      ? !typedPickupLocation || typedPickupLocation.length > 500
      : !this.selectedPickupStationId());
    if (this.form.get('phone')?.invalid || (!pickupSelected && this.form.invalid) || this.cart.items().length === 0 || this.submitting() || pickupInvalid) {
      this.form.markAllAsTouched();
      if (pickupInvalid) this.notification.warning(typedPickupSelected
        ? 'Enter a pickup location (up to 500 characters).'
        : 'Choose an available pickup station to continue.');
      return;
    }

    this.submitting.set(true);
    this.paymentMessage.set(null);
    if (!pickupSelected) {
      this.saveDoorAddressAndCheckout();
      return;
    }
    const pickupDetails = this.pickupChoice() === 'typed'
      ? { pickupLocation: typedPickupLocation }
      : { pickupStationId: this.selectedPickupStationId() };
    this.beginQuotedCheckout({ deliveryMethod: 'PICKUP_STATION', ...pickupDetails });
  }

  private saveDoorAddressAndCheckout(): void {
    const value = this.form.getRawValue();
    this.http.post<{ id: number }>(ApiEndpoints.USERS.CREATE_OWN_ADDRESS, {
      label: `${value.firstName} ${value.lastName}`.trim(),
      addressText: `${value.address}, ${value.county}`,
    }).subscribe({
      next: (response) => {
        if (!response.success || !response.data?.id) {
          this.failCheckout(response.message || 'We could not save your delivery address.');
          return;
        }
        this.beginQuotedCheckout({ deliveryMethod: 'DOOR_DELIVERY', addressId: response.data.id });
      },
      error: (error) => this.failCheckout(error?.error?.message || 'We could not save your delivery address.'),
    });
  }

  private beginQuotedCheckout(quoteRequest: Record<string, unknown>): void {
    this.pendingCheckoutItems = this.cart.items().map((item) => ({ productId: item.productId, quantity: item.quantity }));
    this.checkoutFinalized = false;
    this.cart.syncMockCartForCheckout().subscribe({
      next: () => this.http.post<void>(ApiEndpoints.CHECKOUT.START, {}).subscribe({
        next: (startResponse) => {
          if (!startResponse.success) {
            this.failCheckout(startResponse.message || 'We could not start checkout.');
            return;
          }
          this.http.post<DeliveryQuote>(ApiEndpoints.CHECKOUT.DELIVERY_QUOTE, quoteRequest).subscribe({
            next: (quoteResponse) => {
              if (!quoteResponse.success || !quoteResponse.data?.quoteId) {
                this.failCheckout(quoteResponse.message || 'We could not calculate the delivery fee.');
                return;
              }
              const quotedSubtotal = Number(quoteResponse.data.subtotal);
              const basketSubtotal = this.cart.totalPrice();
              if (!Number.isFinite(quotedSubtotal) || Math.abs(quotedSubtotal - basketSubtotal) > 0.01) {
                this.failCheckout(
                  `Your basket is ${this.formatKes(basketSubtotal)}, but checkout quoted ${this.formatKes(quotedSubtotal)}. No payment was sent. Refresh your basket and try again.`,
                );
                return;
              }
              const quoteTotal = Number(quoteResponse.data.total);
              const deliveryFee = Number(quoteResponse.data.deliveryFee);
              const expectedTotal = quotedSubtotal + deliveryFee;
              if (!Number.isFinite(deliveryFee) || deliveryFee < 0
                || !Number.isFinite(quoteTotal) || quoteTotal <= 0
                || Math.abs(quoteTotal - expectedTotal) > 0.01) {
                this.failCheckout(
                  `The checkout quote is inconsistent: items ${this.formatKes(quotedSubtotal)} + delivery ${this.formatKes(deliveryFee)} should total ${this.formatKes(expectedTotal)}, but the server returned ${this.formatKes(quoteTotal)}. No payment prompt was sent.`,
                );
                return;
              }
              this.quotedSubtotal.set(quotedSubtotal);
              this.quotedDelivery.set(deliveryFee);
              const productCount = this.cart.items().length;
              const formattedTotal = new Intl.NumberFormat('en-KE', {
                style: 'currency',
                currency: quoteResponse.data.currency || 'KES',
              }).format(quoteTotal);
              const confirmed = window.confirm(
                `The total for all ${productCount} ${productCount === 1 ? 'product' : 'products'}, including delivery, is ${formattedTotal}. Continue to M-Pesa?`,
              );
              if (!confirmed) {
                this.submitting.set(false);
                return;
              }
              const phoneNumber = String(this.form.get('phone')?.value ?? '').replace(/\s+/g, '').replace(/^\+/, '');
              this.http.post<StkPushInitiateResponse>(ApiEndpoints.CHECKOUT.CREATE_ORDER, {
                quoteId: quoteResponse.data.quoteId,
                ...(phoneNumber ? { phoneNumber } : {}),
              }).subscribe({
                next: (checkoutResponse) => {
                  const initiation = checkoutResponse.data;
                  if (!checkoutResponse.success || !initiation || !Number.isSafeInteger(Number(initiation.paymentId))) {
                    this.failCheckout(checkoutResponse.message || 'We could not start your M-Pesa payment.');
                    return;
                  }
                  this.submitting.set(false);
                  this.pendingPaymentId.set(Number(initiation.paymentId));
                  const status = normalizePaymentStatus(initiation.status || 'PENDING');
                  const darajaResponse = initiation.darajaResponse;
                  const phoneNumber = String(this.form.get('phone')?.value ?? '').replace(/\s+/g, '').replace(/^\+/, '');
                  this.paymentDetails.set({
                    paymentId: Number(initiation.paymentId),
                    orderId: initiation.orderId == null ? null : String(initiation.orderId),
                    paymentStatus: status,
                    amount: Number(initiation.amount),
                    merchantRequestId: darajaResponse?.merchantRequestID,
                    checkoutRequestId: darajaResponse?.checkoutRequestID,
                    phoneNumber,
                  });
                  if (status === 'PENDING' && darajaResponse?.responseCode && darajaResponse.responseCode !== '0') {
                    this.submitting.set(false);
                    const message = darajaResponse.customerMessage || darajaResponse.responseDescription || 'Daraja could not send the M-Pesa prompt.';
                    this.applyPaymentStatus({
                      orderId: null,
                      paymentId: Number(initiation.paymentId),
                      amount: Number(initiation.amount),
                      paymentStatus: 'FAILED',
                    });
                    this.paymentMessage.set(message);
                    return;
                  }
                  this.applyPaymentStatus({
                    orderId: initiation.orderId == null ? null : String(initiation.orderId),
                    paymentId: Number(initiation.paymentId),
                    amount: Number(initiation.amount),
                    paymentStatus: status,
                    checkoutRequestId: darajaResponse?.checkoutRequestID,
                    merchantRequestId: darajaResponse?.merchantRequestID,
                    phoneNumber,
                  });
                  if (status === 'PENDING' || (['PAID', 'HELD', 'SETTLED'].includes(status) && initiation.orderId == null)) {
                    this.watchPaymentStatus(Number(initiation.paymentId));
                  }
                },
                error: (error) => this.failCheckout(error?.error?.message || 'We could not start your M-Pesa payment.'),
              });
            },
            error: (error) => this.failCheckout(error?.error?.message || 'We could not calculate the delivery fee.'),
          });
        },
        error: (error) => this.failCheckout(error?.error?.message || 'We could not start checkout.'),
      }),
      error: (error) => this.failCheckout(error?.message || 'We could not prepare your cart for checkout.'),
    });
  }

  private failCheckout(message: string): void {
    this.submitting.set(false);
    const visibleMessage = formatCheckoutError(message);
    this.paymentStatus.set('FAILED');
    this.paymentState.set('failed');
    this.paymentMessage.set(visibleMessage);
    this.notification.error(visibleMessage);
  }

  private formatKes(amount: number): string {
    if (!Number.isFinite(amount)) return 'unavailable';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  }

  protected retryPayment(): void {
    if (!this.canRetryPayment() || this.submitting()) return;
    this.paymentPolling?.unsubscribe();
    this.paymentState.set('idle');
    this.paymentStatus.set(null);
    this.paymentDetails.set(null);
    this.pendingOrderId.set(null);
    this.pendingPaymentId.set(null);
    this.paymentMessage.set(null);
    this.checkoutFinalized = false;
  }

  protected checkPaymentStatus(): void {
    const paymentId = this.pendingPaymentId();
    if (!paymentId || this.checkingPaymentStatus()) return;
    this.checkingPaymentStatus.set(true);
    this.payment.getStatus(paymentId).subscribe({
      next: (response) => {
        this.checkingPaymentStatus.set(false);
        if (!response.success || !response.data) {
          this.notification.warning(response.message || 'No payment status is available yet. We are still waiting for Daraja.');
          return;
        }
        this.paymentDetails.set(response.data);
        this.applyPaymentStatus(response.data);
      },
      error: () => {
        this.checkingPaymentStatus.set(false);
        this.notification.warning('Could not refresh payment status. Automatic checks will continue.');
      },
    });
  }

  private applyPaymentStatus(status: PaymentStatus): void {
    this.paymentStatus.set(status.paymentStatus);
    const orderId = status.orderId ? Number(status.orderId) : NaN;
    const paymentAccepted = ['PAID', 'HELD', 'SETTLED'].includes(status.paymentStatus);
    const successfulPayment = status.paymentStatus === 'PAID' || status.paymentStatus === 'SETTLED';
    const hasOrderId = Number.isSafeInteger(orderId) && orderId > 0;
    const orderIdChanged = hasOrderId && this.pendingOrderId() !== orderId;
    if (paymentAccepted && (hasOrderId || successfulPayment)) {
      if (hasOrderId) {
        this.paymentPolling?.unsubscribe();
        this.pendingOrderId.set(orderId);
      }
      this.paymentState.set('paid');
      this.paymentMessage.set(hasOrderId
        ? 'Payment successful. Your order is confirmed.'
        : 'Payment successful. We are finalizing your order now.');
      if (!this.checkoutFinalized) {
        this.checkoutFinalized = true;
        this.productService.applyStockReservation(this.pendingCheckoutItems);
        this.cart.clear().subscribe();
        this.notification.success(this.paymentMessage()!);
        this.refreshOrderAfterPayment();
      }
      if (hasOrderId) {
        this.paymentMessage.set('Payment successful. Your order is confirmed.');
      }
      // A paid callback may arrive before its order ID. Refresh again once the
      // backend attaches that ID; the first successful callback already caused
      // an order-list refresh above.
      if (this.checkoutFinalized && orderIdChanged && hasOrderId) this.refreshOrderAfterPayment();
      if (orderIdChanged && hasOrderId) void this.router.navigate(['/orders']);
    } else if (paymentAccepted) {
      this.paymentState.set('pending');
      this.paymentMessage.set('Payment received. We are waiting for order confirmation.');
    } else if (status.paymentStatus === 'CANCELLED') {
      this.paymentPolling?.unsubscribe();
      this.paymentState.set('cancelled');
      this.paymentMessage.set('You cancelled the M-Pesa payment. No order was created. You can start checkout again when you are ready.');
      this.notification.warning(this.paymentMessage()!);
    } else if (status.paymentStatus === 'FAILED') {
      this.paymentPolling?.unsubscribe();
      this.paymentState.set('failed');
      this.paymentMessage.set('Payment was unsuccessful. No order was created. You can start checkout again.');
      this.notification.error(this.paymentMessage()!);
    } else if (status.paymentStatus === 'PENDING') {
      this.paymentState.set('pending');
      this.paymentMessage.set('M-Pesa request sent. Please enter your PIN on your phone and wait while we confirm your payment.');
    } else if (status.paymentStatus === 'REFUNDED') {
      this.paymentState.set('failed');
      this.paymentMessage.set('This payment was refunded. No order is available from this checkout.');
      this.notification.info(this.paymentMessage()!);
    } else if (status.paymentStatus === 'UNKNOWN') {
      this.paymentPolling?.unsubscribe();
      this.paymentState.set('unknown');
      this.paymentMessage.set('We could not recognize the payment status. Check your orders or contact support.');
      this.notification.warning(this.paymentMessage()!);
    }
  }

  protected statusTitle(): string {
    switch (this.paymentStatus()) {
      case 'PAID': return 'Payment successful';
      case 'PENDING': return 'Approve the M-Pesa prompt';
      case 'CANCELLED': return 'Payment cancelled';
      case 'FAILED': return 'Payment not completed';
      case 'HELD': return 'Payment held';
      case 'SETTLED': return 'Payment settled';
      case 'REFUNDED': return 'Payment refunded';
      case 'UNKNOWN': return 'Payment status unavailable';
      default: return this.paymentState() === 'paid' ? 'Payment successful' : 'Payment not completed';
    }
  }

  private refreshOrderAfterPayment(): void {
    const buyerId = this.auth.user()?.id;
    if (buyerId) this.orderService.loadMine(buyerId).subscribe();
  }

  private savedPhoneNumber(): string {
    const phone = this.auth.user()?.phone?.replace(/\s+/g, '') ?? '';
    if (/^\+254[17]\d{8}$/.test(phone)) return phone;
    if (/^254[17]\d{8}$/.test(phone)) return `+${phone}`;
    if (/^0[17]\d{8}$/.test(phone)) return `+254${phone.slice(1)}`;
    return '';
  }

  private watchPaymentStatus(paymentId: number): void {
    this.paymentPolling?.unsubscribe();
    this.paymentPolling = this.payment.pollPaymentStatus(paymentId, 5_000, 30 * 60 * 1_000)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (status) => {
        this.paymentDetails.set(status);
        this.applyPaymentStatus(status);
      },
      error: () => {
        this.paymentStatus.set('FAILED');
        this.paymentState.set('failed');
        this.paymentMessage.set('Payment timed out after 30 minutes. No order was created. Start checkout again if you still want to buy these items.');
        this.notification.warning(this.paymentMessage()!);
      },
    });
  }

}
