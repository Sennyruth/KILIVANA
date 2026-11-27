import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Auth } from '../../core/services/auth';
import {
  PayoutAccount,
  WalletDashboard,
  WalletService,
  WalletTransaction,
  WithdrawalRecord,
} from '../../core/services/wallet';

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
  protected readonly actionMessage = signal<string | null>(null);
  protected readonly dashboard = signal<WalletDashboard | null>(null);
  protected readonly selectedTransaction = signal<WalletTransaction | null>(null);
  protected readonly payoutAccountDialog = signal(false);
  protected readonly withdrawalDialog = signal(false);
  protected readonly withdrawalStage = signal<'form' | 'review' | 'submitted'>('form');
  protected readonly accountName = signal('');
  protected readonly mpesaPhone = signal('');
  protected readonly withdrawalAmount = signal('');
  protected readonly submittingAccount = signal(false);
  protected readonly submittingWithdrawal = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly summary = computed(() => this.dashboard()?.summary ?? null);
  protected readonly transactions = computed(() => [...(this.dashboard()?.transactions ?? [])]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
  protected readonly payoutAccounts = computed(() => this.dashboard()?.payoutAccounts ?? []);
  protected readonly withdrawals = computed(() => [...(this.dashboard()?.withdrawals ?? [])]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)));
  protected readonly eligibility = computed(() => this.dashboard()?.eligibility ?? null);
  protected readonly defaultPayoutAccount = computed(() => this.payoutAccounts().find((account) => account.isDefault) ?? null);
  protected readonly pendingWithdrawal = computed(() => this.withdrawals().some((payout) =>
    ['PENDING', 'APPROVED', 'PROCESSING'].includes(payout.status),
  ));
  protected readonly canWithdraw = computed(() => {
    const summary = this.summary();
    const eligibility = this.eligibility();
    const account = this.defaultPayoutAccount();
    return !!summary && !!eligibility && !!account
      && eligibility.can_withdraw
      && account.verificationStatus === 'VERIFIED'
      && !this.pendingWithdrawal()
      && summary.availableBalance >= eligibility.min_withdrawal;
  });
  protected readonly validWithdrawalAmount = computed(() => {
    const amount = Number(this.withdrawalAmount());
    const summary = this.summary();
    const eligibility = this.eligibility();
    return Number.isFinite(amount) && !!summary && !!eligibility
      && amount >= eligibility.min_withdrawal
      && amount <= eligibility.max_withdrawal
      && amount <= summary.availableBalance;
  });

  ngOnInit(): void {
    this.loadWallet();
  }

  protected loadWallet(): void {
    this.loading.set(true);
    this.error.set(null);
    this.walletService.loadDashboard().subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
        this.loading.set(false);
      },
      error: (cause: unknown) => {
        this.error.set(cause instanceof Error ? cause.message : 'Could not load wallet data. Please try again.');
        this.loading.set(false);
      },
    });
  }

  protected openPayoutAccountDialog(): void {
    this.accountName.set(this.auth.user()?.name ?? '');
    this.mpesaPhone.set('');
    this.actionError.set(null);
    this.payoutAccountDialog.set(true);
  }

  protected savePayoutAccount(): void {
    const name = this.accountName().trim();
    const phone = normalizeMpesaPhone(this.mpesaPhone());
    if (!name) {
      this.actionError.set('Enter the name registered to the M-Pesa account.');
      return;
    }
    if (!/^254(?:7\d{8}|1\d{8}|11\d{7})$/.test(phone)) {
      this.actionError.set('Enter a valid Safaricom number, such as 254712345678.');
      return;
    }

    this.submittingAccount.set(true);
    this.actionError.set(null);
    this.walletService.addPayoutAccount({ payoutMethod: 'MPESA', accountName: name, mpesaPhone: phone, isDefault: true }).subscribe({
      next: () => {
        this.submittingAccount.set(false);
        this.payoutAccountDialog.set(false);
        this.actionMessage.set('Payout account added. It must be verified before it can be used for withdrawals.');
        this.loadWallet();
      },
      error: (cause: unknown) => {
        this.submittingAccount.set(false);
        this.actionError.set(errorMessage(cause, 'Could not add the payout account.'));
      },
    });
  }

  protected openWithdrawalDialog(): void {
    if (!this.canWithdraw()) return;
    this.withdrawalStage.set('form');
    this.withdrawalAmount.set('');
    this.actionError.set(null);
    this.withdrawalDialog.set(true);
  }

  protected reviewWithdrawal(): void {
    if (this.validWithdrawalAmount()) this.withdrawalStage.set('review');
  }

  protected submitWithdrawal(): void {
    const account = this.defaultPayoutAccount();
    if (!account || !this.canWithdraw() || !this.validWithdrawalAmount()) return;
    this.submittingWithdrawal.set(true);
    this.actionError.set(null);
    this.walletService.requestWithdrawal(Number(this.withdrawalAmount()), account.id).subscribe({
      next: (payout) => {
        this.submittingWithdrawal.set(false);
        this.withdrawalStage.set('submitted');
        this.actionMessage.set(`Withdrawal request ${payout.reference || `#${payout.id}`} submitted for approval.`);
        this.loadWallet();
      },
      error: (cause: unknown) => {
        this.submittingWithdrawal.set(false);
        this.actionError.set(errorMessage(cause, 'Could not submit the withdrawal request.'));
      },
    });
  }

  protected closeDialogs(): void {
    this.payoutAccountDialog.set(false);
    this.withdrawalDialog.set(false);
    this.actionError.set(null);
  }

  protected setAccountName(event: Event): void {
    this.accountName.set((event.target as HTMLInputElement).value);
  }

  protected setMpesaPhone(event: Event): void {
    this.mpesaPhone.set((event.target as HTMLInputElement).value);
  }

  protected setWithdrawalAmount(event: Event): void {
    this.withdrawalAmount.set((event.target as HTMLInputElement).value);
  }

  protected transactionLabel(transaction: WalletTransaction): string {
    const labels: Record<string, string> = {
      SALE_CREDIT: 'Sale credit',
      COMMISSION_DEDUCTION: 'Platform commission',
      PENDING_TO_AVAILABLE: 'Funds released',
      WITHDRAWAL_REQUEST: 'Withdrawal requested',
      WITHDRAWAL_SUCCESS: 'Withdrawal paid',
      WITHDRAWAL_REVERSAL: 'Withdrawal reversed',
      REFUND: 'Refund',
      ADJUSTMENT: 'Balance adjustment',
    };
    return labels[transaction.transactionType] ?? transaction.transactionType.replaceAll('_', ' ');
  }

  protected transactionIsDebit(transaction: WalletTransaction): boolean {
    return ['COMMISSION_DEDUCTION', 'WITHDRAWAL_REQUEST', 'WITHDRAWAL_SUCCESS', 'REFUND'].includes(transaction.transactionType);
  }

  protected withdrawalStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'Pending approval', APPROVED: 'Approved', PROCESSING: 'Processing', PAID: 'Paid',
      FAILED: 'Failed', REJECTED: 'Rejected', ON_HOLD: 'On hold', REVERSED: 'Reversed',
    };
    return labels[status] ?? status;
  }

  protected statusClass(status: string): string {
    const normalized = status.toUpperCase();
    if (['PAID', 'COMPLETED', 'VERIFIED'].includes(normalized)) return 'wallet-status wallet-status--green';
    if (['PENDING', 'APPROVED', 'PROCESSING', 'ON_HOLD', 'UNVERIFIED'].includes(normalized)) return 'wallet-status';
    if (['FAILED', 'REJECTED', 'REVERSED'].includes(normalized)) return 'wallet-status wallet-status--gray';
    return 'wallet-status wallet-status--blue';
  }

  protected accountLabel(account: PayoutAccount): string {
    return account.maskedMpesaPhone || account.mpesaPhone || account.accountName;
  }

  protected showTransaction(transaction: WalletTransaction): void {
    this.selectedTransaction.set(transaction);
  }

  protected closeTransaction(): void {
    this.selectedTransaction.set(null);
  }
}

function normalizeMpesaPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0')) return `254${digits.slice(1)}`;
  return `254${digits}`;
}

function errorMessage(cause: unknown, fallback: string): string {
  if (cause && typeof cause === 'object' && 'error' in cause) {
    const response = (cause as { error?: { message?: string } }).error;
    if (response?.message) return response.message;
  }
  if (cause instanceof Error) return cause.message;
  return fallback;
}
