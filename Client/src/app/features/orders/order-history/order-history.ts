import { Component, computed, DestroyRef, HostListener, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { interval } from 'rxjs';
import { Auth } from '../../../core/services/auth';
import { Order as OrderService } from '../../../core/services/order';
import { Product as ProductService } from '../../../core/services/product';
import { Payment } from '../../../core/services/payment';
import { NotificationService } from '../../../shared/notification/notification.service';
import { deliveryStatusLabel, Order, OrderStatus } from '../../../shared/order.model';
import type { PaymentStatus } from '../../../shared/payment.model';
import { OrderProgress } from './order-progress/order-progress';

type OrderFilter = 'ALL' | 'IN_PROGRESS' | 'DELIVERED' | 'CANCELLED';

@Component({
  selector: 'app-order-history',
  imports: [RouterLink, MatIconModule, MatButtonModule, OrderProgress],
  styleUrl: './order-history.scss',
  templateUrl: './order-history.html',
})
export class OrderHistory implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(Auth);
  private readonly orderService = inject(OrderService);
  private readonly productService = inject(ProductService);
  private readonly payment = inject(Payment);
  private readonly notification = inject(NotificationService);

  protected readonly isFarmer = this.auth.isFarmer;
  protected readonly orders = this.orderService.orders;
  protected readonly loading = this.orderService.loading;
  protected readonly error = this.orderService.error;
  protected readonly loadError = signal<string | null>(null);
  protected readonly filter = signal<OrderFilter>('ALL');
  protected readonly productImages = signal<Record<string, string>>({});
  protected readonly paymentStatuses = signal<Record<string, PaymentStatus>>({});
  protected readonly retryingOrderId = signal<string | null>(null);

  protected readonly visibleOrders = computed(() => {
    const orders = this.orders();
    switch (this.filter()) {
      case 'IN_PROGRESS':
        return orders.filter(
          (order) => !['DELIVERED', 'COMPLETED', 'CANCELLED', 'FAILED'].includes(order.status),
        );
      case 'DELIVERED':
        return orders.filter((order) => ['DELIVERED', 'COMPLETED'].includes(order.status));
      case 'CANCELLED':
        return orders.filter((order) => order.status === 'CANCELLED');
      default:
        return orders;
    }
  });

  protected readonly activeCount = computed(
    () =>
      this.orders().filter(
        (order) => !['DELIVERED', 'COMPLETED', 'CANCELLED', 'FAILED'].includes(order.status),
      ).length,
  );
  protected readonly deliveredCount = computed(
    () => this.orders().filter((order) => ['DELIVERED', 'COMPLETED'].includes(order.status)).length,
  );

  ngOnInit(): void {
    this.loadOrders();
    interval(10 * 60 * 1_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.loading()) this.loadOrders();
      });
  }

  @HostListener('window:focus')
  protected refreshOrdersOnFocus(): void {
    if (!this.loading()) this.loadOrders();
  }

  protected loadOrders(): void {
    this.loadError.set(null);
    if (!this.auth.isBuyer() && !this.auth.isFarmer()) {
      this.loadError.set('Order history is only available to buyer and farmer accounts.');
      return;
    }
    const buyerId = this.auth.user()?.id;
    if (!buyerId || !/^\d+$/.test(buyerId)) {
      this.loadError.set('Could not identify your buyer account. Please sign in again.');
      return;
    }

    this.orderService.loadMine(buyerId).subscribe({
      next: (response) => {
        this.productImages.set({});
        if (!response.success || !response.data) return;
        const productIds = response.data.orders.flatMap((order) =>
          order.items.map((item) => item.productId),
        );
        this.productService.loadPrimaryImagesFor(productIds).subscribe((images) => {
          this.productImages.set(images);
        });
      },
      error: () => {
        // Error is handled by the error signal
      }
    });
  }

  protected setFilter(filter: OrderFilter): void {
    this.filter.set(filter);
  }

  protected orderNumber(id: string): string {
    return `KV-${id.slice(-8).toUpperCase()}`;
  }

  protected statusLabel(status: OrderStatus, deliveryStatus?: string | null): string {
    const dispatchLabel = deliveryStatusLabel(deliveryStatus);
    if (dispatchLabel) return dispatchLabel;
    const labels: Record<OrderStatus, string> = {
      PENDING: 'Awaiting confirmation',
      CONFIRMED: 'Confirmed',
      PACKED: 'Packed',
      SHIPPED: 'On the way',
      OUT_FOR_DELIVERY: 'Out for delivery',
      DELIVERED: 'Delivered',
      CANCELLED: 'Cancelled',
      PREPARING: 'Preparing',
      READY_FOR_PICKUP: 'Ready for pickup',
      PICKED_UP: 'Picked up',
      IN_TRANSIT: 'In transit',
      COMPLETED: 'Completed',
      FAILED: 'Failed',
    };
    return labels[status];
  }

  protected paymentStatusLabel(status: Order['paymentStatus']): string {
    return status === 'PAID' ? 'Paid' : status === 'CANCELLED' ? 'Cancelled'
      : status === 'FAILED' ? 'Failed' : status === 'PENDING' ? 'Pending'
      : status.charAt(0) + status.slice(1).toLowerCase();
  }

  protected paymentStatusFor(order: Order): PaymentStatus['paymentStatus'] {
    return this.paymentStatuses()[order.id]?.paymentStatus ?? order.paymentStatus;
  }

  protected canRetryPayment(order: Order): boolean {
    return ['FAILED', 'CANCELLED'].includes(this.paymentStatusFor(order))
      && !['COMPLETED', 'CANCELLED'].includes(order.status);
  }

  protected retryPayment(order: Order): void {
    if (!this.canRetryPayment(order) || this.retryingOrderId()) return;
    const orderId = Number(order.id);
    if (!Number.isSafeInteger(orderId) || orderId <= 0 || !order.phone) {
      this.notification.error('This order is missing its payment phone number. Please contact support.');
      return;
    }
    this.retryingOrderId.set(order.id);
    // This is a customer retrying payment for their own order, including a farmer's input order.
    this.payment.initiateMpesa('buyer', {
      orderId,
      phoneNumber: order.phone.replace(/^\+/, ''),
    }).subscribe({
      next: (response) => {
        const darajaResponse = response.data?.darajaResponse;
        if (!response.success || !response.data || String(darajaResponse?.responseCode) !== '0') {
          this.retryingOrderId.set(null);
          this.notification.error(darajaResponse?.customerMessage || response.message || 'Could not send a new M-Pesa prompt.');
          return;
        }
        this.paymentStatuses.update((statuses) => ({
          ...statuses,
          [order.id]: {
            orderId: String(order.id),
            paymentId: response.data!.paymentId,
            amount: response.data!.amount,
            paymentStatus: 'PENDING',
            phoneNumber: order.phone.replace(/^\+/, ''),
            checkoutRequestId: darajaResponse.checkoutRequestID,
            merchantRequestId: darajaResponse.merchantRequestID,
          },
        }));
        this.notification.info('M-Pesa request sent. Enter your PIN on your phone while we confirm payment.');
        this.watchOrderPayment(order, orderId);
      },
      error: (error) => {
        const message = error?.error?.message || 'Could not send a new M-Pesa prompt.';
        if (error?.status === 403 || /not authorized to request payment for this order/i.test(message)) {
          this.paymentStatuses.update((statuses) => ({
            ...statuses,
            [order.id]: { orderId: order.id, paymentStatus: 'UNKNOWN', phoneNumber: order.phone },
          }));
          this.retryingOrderId.set(null);
          this.notification.error('The payment service did not authorize this farmer account for the order. No payment was taken. Please contact support.');
          return;
        }
        if (/already being processed/i.test(message)) {
          this.paymentStatuses.update((statuses) => ({
            ...statuses,
            [order.id]: { orderId: order.id, paymentStatus: 'PENDING', phoneNumber: order.phone },
          }));
          this.notification.info('A payment request is already processing. Checking its status now.');
          this.watchOrderPayment(order, orderId);
          return;
        }
        this.retryingOrderId.set(null);
        this.notification.error(message);
      },
    });
  }

  protected checkPaymentStatus(order: Order): void {
    if (this.retryingOrderId()) return;
    const orderId = Number(order.id);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) return;
    this.retryingOrderId.set(order.id);
    this.watchOrderPayment(order, orderId);
  }

  private watchOrderPayment(order: Order, orderId: number): void {
    this.payment.pollOrderStatus(orderId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (status) => {
        this.paymentStatuses.update((statuses) => ({ ...statuses, [order.id]: status }));
        if (status.paymentStatus === 'PENDING') return;
        this.retryingOrderId.set(null);
        if (status.paymentStatus === 'PAID') this.notification.success('M-Pesa payment received.');
        else if (status.paymentStatus === 'CANCELLED') this.notification.warning('You cancelled the M-Pesa payment.');
        else if (status.paymentStatus === 'FAILED') this.notification.error('Payment was unsuccessful. You can retry from this order.');
        else this.notification.info(`Payment status: ${status.paymentStatus}.`);
        this.loadOrders();
      },
      error: () => {
        this.retryingOrderId.set(null);
        this.notification.warning('Payment confirmation timed out. Check your M-Pesa messages or refresh this order.');
        this.loadOrders();
      },
    });
  }

  protected formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';
    return new Intl.DateTimeFormat('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  protected formatTotal(value: number): string {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected imageForProduct(productId: string): string | null {
    return this.productImages()[productId] ?? null;
  }

  protected onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = '/placeholder.svg';
  }
}
