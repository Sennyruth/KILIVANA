import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { finalize, forkJoin, interval } from 'rxjs';
import { Order as OrderService } from '../../../core/services/order';
import { Auth } from '../../../core/services/auth';
import type { Order as OrderModel, OrderStatus, SellerOrderSummary } from '../../../shared/order.model';
import { deliveryStatusLabel } from '../../../shared/order.model';
import type {
  DeliverySummary,
  DeliverySummaryItem,
  TrackingEvent,
  TrackingStage,
} from '../../../shared/tracking.model';
import { TrackingStepper } from '../../../shared/tracking-stepper/tracking-stepper';
import { Tracking } from '../../../core/services/tracking';

@Component({
  selector: 'app-order-tracker',
  imports: [RouterLink, MatIconModule, MatButtonModule, TrackingStepper, CurrencyPipe, DatePipe],
  styleUrl: './order-tracker.scss',
  templateUrl: './order-tracker.html',
})
export class OrderTracker implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly route = inject(ActivatedRoute);
  protected readonly tracking = inject(Tracking);
  private readonly orderService = inject(OrderService);
  private readonly auth = inject(Auth);
  protected readonly orderId = signal(this.route.snapshot.paramMap.get('orderId') ?? 'last');
  protected readonly sellerPerspective = this.route.snapshot.queryParamMap.get('perspective') === 'seller';
  protected readonly sellerBackLink = computed(() =>
    this.auth.user()?.role === 'SUPPLIER' ? ['/dashboard/supplier/orders'] : ['/dashboard/farmer'],
  );
  protected readonly sellerBackFragment = computed(() =>
    this.auth.user()?.role === 'SUPPLIER' ? undefined : 'farmer-orders',
  );
  protected readonly history = this.tracking.history;
  protected readonly loading = this.tracking.loading;
  protected readonly error = signal<string | null>(null);
  protected readonly detailError = signal<string | null>(null);
  protected readonly deliveryEventsError = signal<string | null>(null);
  protected readonly deliveryEvents = signal<TrackingEvent[]>([]);
  protected readonly deliverySummary = signal<DeliverySummary | null>(null);
  private readonly deliverySummaryLoading = signal(false);
  private readonly deliveryEventsLoading = signal(false);
  private readonly orderDetailsLoading = signal(false);
  private readonly latestOrderLoading = signal(false);
  protected readonly order = signal<OrderModel | null>(null);
  protected readonly sellerOrder = signal<SellerOrderSummary | null>(null);
  protected readonly sellerOrderLoading = signal(false);
  protected readonly terminalStatus = computed(() => {
    const status = this.sellerPerspective ? this.sellerOrder()?.status : this.order()?.status;
    return status === 'CANCELLED' || status === 'FAILED' ? status as OrderStatus : null;
  });
  protected readonly timelineEvents = computed(() => {
    const deliveryEvents = this.deliveryEvents();
    const orderEvents = this.history()?.events ?? [];
    return [...orderEvents, ...deliveryEvents].sort(
      (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    );
  });
  protected readonly currentStatus = computed(
    () => (this.sellerPerspective ? this.sellerOrder()?.status as OrderStatus | undefined : this.order()?.status)
      ?? this.history()?.currentStage ?? null,
  );
  protected readonly terminalMessage = computed(() => {
    const status = this.terminalStatus();
    if (!status) return '';

    const terminalEvent = this.timelineEvents().find(
      (event) => event.label === (status === 'CANCELLED' ? 'Cancelled' : 'Delivery issue'),
    );
    return (
      this.order()?.cancelReason ||
      terminalEvent?.note ||
      (status === 'CANCELLED'
        ? 'This order will not continue to delivery.'
        : 'Please contact support for help with this delivery.')
    );
  });

  ngOnInit(): void {
    this.tracking.clear();
    this.loadCurrentStatus();
    interval(10 * 60 * 1_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (
          this.loading() ||
          this.sellerOrderLoading() ||
          this.deliverySummaryLoading() ||
          this.deliveryEventsLoading() ||
          this.orderDetailsLoading() ||
          this.latestOrderLoading()
        ) return;
        this.error.set(null);
        this.detailError.set(null);
        this.deliveryEventsError.set(null);
        this.loadCurrentStatus();
      });
  }

  protected retry(): void {
    this.error.set(null);
    this.detailError.set(null);
    this.deliveryEventsError.set(null);
    this.deliveryEvents.set([]);
    this.deliverySummary.set(null);
    this.tracking.clear();
    this.sellerOrder.set(null);
    this.order.set(null);
    this.sellerOrderLoading.set(false);
    this.loadCurrentStatus();
  }

  private loadCurrentStatus(): void {
    if (this.sellerPerspective && this.orderId() !== 'last') this.loadSellerTracking(this.orderId());
    else if (this.orderId() === 'last') this.loadLatestOrder();
    else this.loadTracking(this.orderId());
  }

  protected stageLabel(stage: TrackingStage): string {
    const labels: Record<TrackingStage, string> = {
      PLACED: 'Order placed',
      CONFIRMED: 'Order confirmed',
      IN_TRANSIT: 'In transit',
      DELIVERED: 'Delivered',
      COMPLETED: 'Completed',
    };
    return labels[stage];
  }

  protected statusLabel(status: OrderStatus | TrackingStage, deliveryStatus?: string | null): string {
    const dispatchLabel = deliveryStatusLabel(deliveryStatus);
    if (dispatchLabel) return dispatchLabel;
    const labels: Record<string, string> = {
      PENDING: 'Order received',
      CONFIRMED: 'Confirmed',
      PACKED: 'Being prepared',
      PREPARING: 'Being prepared',
      SHIPPED: 'Shipped',
      IN_TRANSIT: 'In transit',
      OUT_FOR_DELIVERY: 'Out for delivery',
      DELIVERED: 'Delivered',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
      FAILED: 'Delivery issue',
    };
    return labels[status] ?? status;
  }

  protected eventStatusLabel(event: TrackingEvent): string {
    if (event.status === 'COMPLETED') return 'Completed';
    if (event.status === 'IN_PROGRESS') return 'In progress';
    return 'Upcoming';
  }

  private loadLatestOrder(): void {
    this.latestOrderLoading.set(true);
    this.orderService.loadMine().pipe(finalize(() => this.latestOrderLoading.set(false))).subscribe({
      next: (response) => {
        const orders = response.success ? response.data?.orders ?? [] : [];
        const latest = [...orders].sort(
          (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
        )[0];
        if (!latest) {
          this.error.set(response.message || 'No recent order was found to track.');
          return;
        }
        this.order.set(latest);
        this.orderId.set(latest.id);
        this.loadTracking(latest.id);
      },
      error: () => this.error.set('Your latest order could not be loaded. Please try again.'),
    });
  }

  private loadTracking(id: string): void {
    this.orderDetailsLoading.set(true);
    this.orderService.getById(id)
      .pipe(finalize(() => this.orderDetailsLoading.set(false)))
      .subscribe({
        next: (response) => {
          if (!response.success || !response.data) {
            this.detailError.set(response.message || 'Order details are unavailable.');
            return;
          }
          this.order.set(response.data.order);
          this.loadDeliverySummary(id, 'buyer');
        },
        error: () => this.detailError.set('Order details are temporarily unavailable.'),
      });

    this.tracking.load(id).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.error.set(response.message || 'Shipment tracking is not available yet.');
        }
      },
      error: () => this.error.set('Shipment tracking could not be loaded. Please try again.'),
    });
  }

  private loadSellerTracking(id: string): void {
    this.sellerOrderLoading.set(true);
    this.orderService.loadSellerOrders().subscribe({
      next: (response) => {
        this.sellerOrderLoading.set(false);
        const summary = response.success
          ? response.data?.find((candidate) => String(candidate.id) === id)
          : undefined;
        if (!summary) {
          this.error.set(response.message || 'This order is not in your farmer sales.');
          return;
        }
        this.sellerOrder.set({
          ...summary,
          status: summary.status.toUpperCase() === 'PLACED' ? 'PENDING' : summary.status.toUpperCase(),
        });
        // Seller order lists often omit buyer delivery fields. The order detail
        // endpoint applies its own access checks and supplies the saved details
        // when the signed-in seller is allowed to view them.
        this.orderService.getById(id).subscribe({
          next: (details) => {
            if (!details.success || !details.data) return;
            const order = details.data.order;
            this.sellerOrder.update((current) => current ? {
              ...current,
              buyerName: order.buyerName || current.buyerName,
              buyerPhone: order.phone || current.buyerPhone,
              deliveryAddress: order.deliveryAddress || current.deliveryAddress,
              pickupLocation: order.pickupLocation || current.pickupLocation,
            } : current);
          },
          // Seller order summary remains usable if detail access is unavailable.
          error: () => undefined,
        });
        this.loadDeliverySummary(id, 'seller');
        this.tracking.load(id).subscribe({
          next: (timeline) => {
            if (!timeline.success || !timeline.data) {
              this.error.set(timeline.message || 'Shipment tracking is not available yet.');
            }
          },
          error: () => this.error.set('Shipment tracking could not be loaded. Please try again.'),
        });
      },
      error: () => {
        this.sellerOrderLoading.set(false);
        this.error.set('Your seller order details could not be loaded. Please try again.');
      },
    });
  }

  private loadDeliverySummary(orderId: string, perspective: 'buyer' | 'seller'): void {
    this.deliveryEventsError.set(null);
    this.deliverySummary.set(null);
    this.deliveryEvents.set([]);
    this.deliverySummaryLoading.set(true);
    const request = perspective === 'seller'
      ? this.tracking.loadSellerDeliverySummary(orderId)
      : this.tracking.loadBuyerDeliverySummary(orderId);
    request.pipe(finalize(() => this.deliverySummaryLoading.set(false))).subscribe({
      next: (response) => {
        if (!response.success || !response.data) {
          this.deliveryEventsError.set(response.message || 'Delivery details are unavailable.');
          return;
        }
        if (!Array.isArray(response.data.deliveries)) {
          this.deliveryEventsError.set('The server returned invalid delivery details.');
          return;
        }
        this.deliverySummary.set(response.data);
        this.loadDeliveryTrackingEvents(response.data.deliveries);
      },
      error: () => this.deliveryEventsError.set('Delivery details could not be loaded. Please try again.'),
    });
  }

  private loadDeliveryTrackingEvents(deliveries: DeliverySummaryItem[]): void {
    const validDeliveries = deliveries.filter((delivery) =>
      Number.isSafeInteger(delivery.deliveryJobId) && delivery.deliveryJobId > 0,
    );
    if (validDeliveries.length !== deliveries.length) {
      this.deliveryEventsError.set('The server returned an invalid delivery reference.');
      this.deliveryEvents.set([]);
      return;
    }
    if (!validDeliveries.length) {
      this.deliveryEvents.set([]);
      this.deliveryEventsLoading.set(false);
      return;
    }

    this.deliveryEvents.set([]);
    this.deliveryEventsLoading.set(true);
    forkJoin(validDeliveries.map((delivery) =>
      this.tracking.loadDeliveryEvents(delivery.deliveryJobId),
    ))
      .pipe(finalize(() => this.deliveryEventsLoading.set(false)))
      .subscribe({
        next: (response) => {
          const failedResponse = response.find((result) => !result.success);
          if (failedResponse) {
            this.deliveryEventsError.set(failedResponse.message || 'Driver updates are temporarily unavailable.');
            return;
          }
          this.deliveryEvents.set(response.flatMap((result, index) =>
            (result.data ?? []).map((event) => ({
              ...event,
              deliveryJobId: validDeliveries[index].deliveryJobId,
            })),
          ));
        },
        error: () => this.deliveryEventsError.set('Driver updates could not be loaded. Please try again.'),
      });
  }

  protected deliveryStatusText(status: string): string {
    return deliveryStatusLabel(status) ?? status.replace(/_/g, ' ').toLowerCase();
  }

  protected destinationTypeText(destinationType: string): string {
    return destinationType.replace(/_/g, ' ').toLowerCase();
  }

  protected eventMapUrl(event: TrackingEvent): string | null {
    if (
      event.latitude == null ||
      event.longitude == null ||
      !Number.isFinite(event.latitude) ||
      !Number.isFinite(event.longitude) ||
      Math.abs(event.latitude) > 90 ||
      Math.abs(event.longitude) > 180
    ) return null;

    return `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`;
  }
}
