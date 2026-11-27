import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Auth } from '../../core/services/auth';
import { WalletService, WalletSellerOrder } from '../../core/services/wallet';

type WalletEntry = {
  order: WalletSellerOrder;
  gross: number;
  fee: number;
  net: number;
};

@Component({
  selector: 'app-wallet-page',
  imports: [CurrencyPipe, DatePipe, MatIconModule],
  templateUrl: './wallet-page.html',
  styleUrl: './wallet-page.scss',
})
export class WalletPage implements OnInit {
  private readonly auth = inject(Auth);
  private readonly walletService = inject(WalletService);
  protected readonly isSupplier = this.auth.isSupplier;
  protected readonly accountType = computed(() => this.isSupplier() ? 'Supplier' : 'Farmer');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly entries = signal<WalletEntry[]>([]);
  protected readonly selectedEntry = signal<WalletEntry | null>(null);

  protected readonly payableEntries = computed(() => this.entries().filter(({ order }) =>
    ['PAID', 'HELD', 'SETTLED'].includes(order.paymentStatus) && order.status !== 'CANCELLED',
  ));
  protected readonly releasedAmount = computed(() => this.sum(this.payableEntries().filter(({ order }) => order.paymentStatus === 'SETTLED')));
  protected readonly heldAmount = computed(() => this.sum(this.payableEntries().filter(({ order }) => ['PAID', 'HELD'].includes(order.paymentStatus))));
  protected readonly lifetimeAmount = computed(() => this.releasedAmount() + this.heldAmount());
  protected readonly eligibleOrderCount = computed(() => this.payableEntries().length);

  ngOnInit(): void {
    this.loadOrders();
  }

  protected loadOrders(): void {
    this.loading.set(true);
    this.error.set(null);
    this.walletService.loadSellerOrders().subscribe({
      next: (orders) => {
        this.entries.set(orders.map((order) => {
          const gross = order.items.reduce((sum, item) => sum + item.subtotal, 0);
          const fee = roundMoney(gross * 0.03);
          return { order, gross, fee, net: roundMoney(gross - fee) };
        }));
        this.loading.set(false);
      },
      error: (cause: unknown) => {
        const message = cause instanceof Error ? cause.message : 'Could not load your wallet activity.';
        this.error.set(message);
        this.loading.set(false);
      },
    });
  }

  protected openDetails(entry: WalletEntry): void {
    this.selectedEntry.set(entry);
  }

  protected closeDetails(): void {
    this.selectedEntry.set(null);
  }

  protected orderNumber(order: WalletSellerOrder): string {
    return order.code || `ORD-${order.id}`;
  }

  protected itemLabel(entry: WalletEntry): string {
    return entry.order.items.map((item) => item.productName).filter(Boolean).join(', ') || 'Seller order';
  }

  protected itemCountLabel(entry: WalletEntry): string {
    const count = entry.order.items.reduce((total, item) => total + item.quantity, 0);
    return `${count} ${count === 1 ? 'item' : 'items'}`;
  }

  protected paymentStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'Payment pending', PAID: 'Paid', HELD: 'Held in escrow', SETTLED: 'Settled',
      FAILED: 'Payment failed', CANCELLED: 'Payment cancelled', REFUNDED: 'Refunded',
    };
    return labels[status] ?? status;
  }

  protected releaseLabel(entry: WalletEntry): string {
    switch (entry.order.paymentStatus) {
      case 'SETTLED': return 'Released to seller';
      case 'HELD': return 'Awaiting order completion';
      case 'PAID': return 'Awaiting escrow settlement';
      case 'REFUNDED': return 'Refunded';
      case 'FAILED': return 'Payment failed';
      case 'CANCELLED': return 'Payment cancelled';
      default: return 'Awaiting buyer payment';
    }
  }

  protected statusClass(status: string): string {
    const normalized = status.toLowerCase();
    if (normalized === 'settled') return 'wallet-status wallet-status--green';
    if (normalized === 'held' || normalized === 'paid') return 'wallet-status';
    if (normalized === 'pending') return 'wallet-status wallet-status--blue';
    return 'wallet-status wallet-status--gray';
  }

  private sum(entries: WalletEntry[]): number {
    return roundMoney(entries.reduce((total, entry) => total + entry.net, 0));
  }
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
