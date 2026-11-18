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
import { RouterLink } from '@angular/router';
import { Cart } from '../../../core/services/cart';
import { Auth } from '../../../core/services/auth';
import { HttpService } from '../../../core/services/http';
import { Order } from '../../../core/services/order';
import { Payment } from '../../../core/services/payment';
import { Product } from '../../../core/services/product';
import { ApiEndpoints } from '../../../shared/api.config';
import { NotificationService } from '../../../shared/notification/notification.service';
import type { PaymentStatus } from '../../../shared/payment.model';
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
  private readonly http = inject(HttpService);
  private readonly orderService = inject(Order);
  private readonly payment = inject(Payment);
  private readonly productService = inject(Product);
  private readonly notification = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  private paymentPolling?: Subscription;
  protected readonly paymentStatus = signal<PaymentStatus['paymentStatus'] | null>(null);
  protected readonly orderPayable = signal(true);
  protected readonly paymentRetryBlocked = signal(false);
  protected readonly submitting = signal(false);
  protected readonly paymentMessage = signal<string | null>(null);
  protected readonly paymentState = signal<'idle' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'unknown'>('idle');
  protected readonly paymentDetails = signal<PaymentStatus | null>(null);
  protected readonly checkingPaymentStatus = signal(false);
  protected readonly pendingOrderId = signal<number | null>(null);
  protected readonly canRetryPayment = computed(() =>
    !!this.pendingOrderId()
      && this.orderPayable()
      && !this.paymentRetryBlocked()
      && (this.paymentStatus() === 'CANCELLED' || this.paymentStatus() === 'FAILED'),
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
    phone: [this.savedPhoneNumber(), [Validators.required, Validators.pattern(/^\+254[17]\d{8}$/)]],
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

    const buyerId = Number(this.auth.user()?.id);
    if (!Number.isSafeInteger(buyerId) || buyerId <= 0) {
      this.notification.error('Please sign in again before placing your order.');
      return;
    }

    this.submitting.set(true);
    this.paymentMessage.set(null);
    const existingOrderId = this.pendingOrderId();
    if (existingOrderId) {
      this.startBuyerPayment(existingOrderId);
      return;
    }
    if (!pickupSelected) {
      this.placeDoorDeliveryOrder(buyerId);
      return;
    }
    const orderedItems = this.cart.items().map((item) => ({ productId: item.productId, quantity: item.quantity }));
    this.cart.syncMockCartForCheckout().subscribe({
      next: () => this.http.post<void>(ApiEndpoints.CHECKOUT.START, {}).subscribe({
        next: (startResponse) => {
          if (!startResponse.success) {
            this.failCheckout(startResponse.message || 'We could not start checkout.');
            return;
          }
          const pickupDetails = this.pickupChoice() === 'typed'
            ? { pickupLocation: String(this.form.get('pickupLocation')?.value ?? '').trim() }
            : { pickupStationId: this.selectedPickupStationId() };
          this.http.post<DeliveryQuote>(ApiEndpoints.CHECKOUT.DELIVERY_QUOTE, {
            deliveryMethod: 'PICKUP_STATION',
            ...pickupDetails,
          }).subscribe({
            next: (quoteResponse) => {
              if (!quoteResponse.success || !quoteResponse.data?.quoteId) {
                this.failCheckout(quoteResponse.message || 'We could not calculate the delivery fee.');
                return;
              }
              this.quotedSubtotal.set(Number(quoteResponse.data.subtotal));
              this.quotedDelivery.set(Number(quoteResponse.data.deliveryFee));
              this.http.post<number>(ApiEndpoints.CHECKOUT.CREATE_ORDER, {
                quoteId: quoteResponse.data.quoteId,
              }).subscribe({
                next: (orderResponse) => {
                  if (!orderResponse.success || !orderResponse.data) {
                    this.failCheckout(orderResponse.message || 'We could not place your order.');
                    return;
                  }
                  const orderId = Number(orderResponse.data);
                  this.pendingOrderId.set(orderId);
                  this.productService.applyStockReservation(orderedItems);
                  this.cart.clear().subscribe();
                  this.startBuyerPayment(orderId);
                },
                error: (error) => this.failCheckout(error?.error?.message || 'We could not place your order.'),
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

  private placeDoorDeliveryOrder(buyerId: number): void {
    const value = this.form.getRawValue();
    this.http.post<{ id: number }>(ApiEndpoints.USERS.CREATE_OWN_ADDRESS, {
      label: `${value.firstName} ${value.lastName}`.trim(),
      addressText: `${value.address}, ${value.county}`,
    }).subscribe({
      next: (addressResponse) => {
        if (!addressResponse.success || !addressResponse.data?.id) {
          this.failCheckout(addressResponse.message || 'We could not save your delivery address.');
          return;
        }
        const orderedItems = this.cart.items().map((item) => ({ productId: item.productId, quantity: item.quantity }));
        this.orderService.create({
          buyerId,
          addressId: addressResponse.data.id,
          items: this.cart.items().map((item) => ({ productId: Number(item.productId), quantity: item.quantity, unitPrice: item.price })),
          deliveryFee: this.cart.totalPrice() > 0 ? 1 : 0,
          subtotal: this.cart.totalPrice(),
          total: this.cart.totalPrice() + (this.cart.totalPrice() > 0 ? 1 : 0),
        }).subscribe({
          next: (response) => {
            if (!response.success || !response.data) {
              this.failCheckout(response.message || 'We could not place your order.');
              return;
            }
            this.quotedSubtotal.set(this.cart.totalPrice());
            this.quotedDelivery.set(this.cart.totalPrice() > 0 ? 1 : 0);
            this.pendingOrderId.set(response.data.id);
            this.productService.applyStockReservation(orderedItems);
            this.cart.clear().subscribe();
            this.startBuyerPayment(response.data.id);
          },
          error: (error) => this.failCheckout(error?.error?.message || 'We could not place your order.'),
        });
      },
      error: (error) => this.failCheckout(error?.error?.message || 'We could not save your delivery address.'),
    });
  }

  private failCheckout(message: string): void {
    this.submitting.set(false);
    this.notification.error(formatCheckoutError(message));
  }

  protected retryPayment(): void {
    const orderId = this.pendingOrderId();
    if (!orderId || !this.orderPayable() || this.paymentRetryBlocked() || this.submitting()) return;
    this.paymentState.set('idle');
    this.paymentRetryBlocked.set(false);
    this.submitting.set(true);
    this.startBuyerPayment(orderId);
  }

  protected checkPaymentStatus(): void {
    const orderId = this.pendingOrderId();
    if (!orderId || this.checkingPaymentStatus()) return;
    this.checkingPaymentStatus.set(true);
    const currentPaymentId = this.paymentDetails()?.paymentId;
    const statusRequest = currentPaymentId
      ? this.payment.getStatus(currentPaymentId)
      : this.payment.getLatestPaymentByOrder(orderId);
    statusRequest.subscribe({
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
    if (status.paymentStatus === 'PAID') {
      this.paymentPolling?.unsubscribe();
      this.paymentState.set('paid');
      this.paymentMessage.set('Payment received. Your order is confirmed.');
      this.notification.success('M-Pesa payment received.');
    } else if (status.paymentStatus === 'CANCELLED') {
      this.paymentPolling?.unsubscribe();
      this.paymentState.set('cancelled');
      this.paymentMessage.set('You cancelled the M-Pesa payment. Your order has not been paid. You can try again when you are ready.');
      this.notification.warning(this.paymentMessage()!);
    } else if (status.paymentStatus === 'FAILED') {
      this.paymentPolling?.unsubscribe();
      this.paymentState.set('failed');
      this.paymentMessage.set('Payment was unsuccessful. You can try again.');
      this.notification.error(this.paymentMessage()!);
    } else if (status.paymentStatus === 'PENDING') {
      this.paymentState.set('pending');
      this.paymentMessage.set('M-Pesa request sent. Please enter your PIN on your phone and wait while we confirm your payment.');
    } else if (status.paymentStatus === 'HELD') {
      this.paymentState.set('paid');
      this.paymentMessage.set('Payment is held securely until your order is completed.');
      this.notification.info(this.paymentMessage()!);
    } else if (status.paymentStatus === 'SETTLED') {
      this.paymentState.set('paid');
      this.paymentMessage.set('Payment has been settled to the seller.');
      this.notification.success(this.paymentMessage()!);
    } else if (status.paymentStatus === 'REFUNDED') {
      this.paymentState.set('failed');
      this.paymentMessage.set('This payment has been refunded.');
      this.notification.info(this.paymentMessage()!);
    } else if (status.paymentStatus === 'UNKNOWN') {
      this.paymentPolling?.unsubscribe();
      this.paymentState.set('unknown');
      this.paymentMessage.set('We could not recognize the payment status. Check your orders or contact support.');
      this.notification.warning(this.paymentMessage()!);
    }
    if (status.paymentStatus !== 'PENDING') this.refreshOrderAfterPayment();
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
    const orderId = this.pendingOrderId();
    if (!orderId) return;
    this.payment.getLatestPaymentByOrder(orderId).subscribe({
      next: (response) => {
        if (response.success && response.data) this.paymentDetails.set(response.data);
      },
    });
    this.orderService.getById(String(orderId)).subscribe({
      next: (response) => {
        const order = response.success ? response.data?.order : null;
        if (order) this.orderPayable.set(!['COMPLETED', 'CANCELLED'].includes(order.status));
        const buyerId = this.auth.user()?.id;
        if (buyerId) this.orderService.loadMine(buyerId).subscribe();
      },
    });
  }

  private startBuyerPayment(orderId: number): void {
    const phoneNumber = String(this.form.get('phone')?.value ?? '').replace(/^\+/, '');
    // Checkout is the customer paying for an order they placed. Farmers buying inputs
    // use the buyer payment endpoint; the farmer endpoint is for seller-side payments.
    this.payment.initiateMpesa('buyer', { orderId, phoneNumber }).subscribe({
      next: (response) => {
        this.submitting.set(false);
        if (!response.success || !response.data) {
          this.paymentState.set('failed');
          this.paymentStatus.set('FAILED');
          this.paymentMessage.set(response.message || 'Your order was placed, but the M-Pesa prompt could not be sent.');
          this.notification.error(this.paymentMessage()!);
          return;
        }

        const darajaResponse = response.data.darajaResponse;
        if (String(darajaResponse?.responseCode) !== '0') {
          this.paymentState.set('failed');
          this.paymentStatus.set('FAILED');
          const message = darajaResponse?.customerMessage
            || darajaResponse?.responseDescription
            || 'Daraja did not confirm the M-Pesa prompt. Check the phone number and try again.';
          this.paymentMessage.set(message);
          this.notification.error(message);
          return;
        }

        this.paymentState.set('pending');
        this.paymentStatus.set('PENDING');
        this.paymentDetails.set({
          orderId: String(orderId),
          paymentStatus: 'PENDING',
          paymentId: response.data.paymentId,
          amount: response.data.amount,
          merchantRequestId: darajaResponse?.merchantRequestID,
          checkoutRequestId: darajaResponse?.checkoutRequestID,
          phoneNumber,
        });
        this.paymentMessage.set('M-Pesa request sent. Please enter your PIN on your phone and wait while we confirm your payment.');
        this.watchPaymentStatus(orderId, response.data.paymentId);
      },
      error: (error) => {
        this.submitting.set(false);
        const message = error?.error?.message || 'Your order was placed, but the M-Pesa prompt could not be sent. Try again.';
        if (error?.status === 403 || /not authorized to request payment for this order/i.test(message)) {
          this.paymentState.set('unknown');
          this.paymentStatus.set('UNKNOWN');
          this.paymentRetryBlocked.set(true);
          this.paymentMessage.set('Your order was created, but the payment service denied the request. No payment was taken. Checking the order account…');
          this.orderService.getById(String(orderId)).subscribe({
            next: (response) => {
              const order = response.success ? response.data?.order : null;
              const signedInUserId = this.auth.user()?.id;
              this.paymentMessage.set(order && signedInUserId && order.buyerId !== signedInUserId
                ? 'This order belongs to a different account. Sign in with the account that placed the order, or contact support. No payment was taken.'
                : 'The order belongs to this account, but the payment service rejected the farmer request. No payment was taken. The backend must authorize farmer payments for this order.');
              this.notification.error(this.paymentMessage()!);
            },
            error: () => this.notification.error(this.paymentMessage()!),
          });
          return;
        }
        if (/already being processed/i.test(message)) {
          this.paymentState.set('pending');
          this.paymentStatus.set('PENDING');
          this.paymentMessage.set('A payment request is already being processed. Enter your PIN if prompted while we check its status.');
          this.watchPaymentStatus(orderId);
          return;
        }
        this.paymentState.set('failed');
        this.paymentStatus.set('FAILED');
        this.paymentMessage.set(message);
        this.notification.error(message);
      },
    });
  }

  private savedPhoneNumber(): string {
    const phone = this.auth.user()?.phone?.replace(/\s+/g, '') ?? '';
    if (/^\+254[17]\d{8}$/.test(phone)) return phone;
    if (/^254[17]\d{8}$/.test(phone)) return `+${phone}`;
    if (/^0[17]\d{8}$/.test(phone)) return `+254${phone.slice(1)}`;
    return '';
  }

  private watchPaymentStatus(orderId: number, paymentId?: number): void {
    this.paymentPolling?.unsubscribe();
    const polling = paymentId
      ? this.payment.pollPaymentStatus(paymentId)
      : this.payment.pollOrderStatus(orderId);
    this.paymentPolling = polling.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (status) => {
        this.paymentDetails.set(status);
        this.applyPaymentStatus(status);
      },
      error: () => {
        this.paymentMessage.set('Payment confirmation timed out. Please check your M-Pesa messages or try again.');
        this.notification.warning(this.paymentMessage()!);
      },
    });
  }

}
