import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, throwError } from 'rxjs';
import { ApiEndpoints } from '../../shared/api.config';
import { ApiResponse } from '../../shared/api-response';
import { HttpService } from './http';

export interface WalletSummary {
  pendingBalance: number;
  availableBalance: number;
  processingBalance: number;
  totalBalance: number;
  totalPaid: number;
  totalEarned: number;
  status: string;
  transactionCount: number;
}

export interface WalletTransaction {
  id: number;
  orderId: number | null;
  transactionType: string;
  amount: number;
  status: string;
  reference: string | null;
  description: string | null;
  balanceAfter: number;
  pendingBalanceAfter: number;
  availableBalanceAfter: number;
  processingBalanceAfter: number;
  createdAt: string;
}

export interface PayoutAccount {
  id: number;
  payoutMethod: string;
  accountName: string;
  mpesaPhone: string | null;
  maskedMpesaPhone: string | null;
  isDefault: boolean;
  verificationStatus: string;
  verifiedAt: string | null;
}

export interface WithdrawalRecord {
  id: number;
  amount: number;
  payoutAccountId: number | null;
  payoutMethod: string;
  destinationSnapshot: string | null;
  status: string;
  reference: string | null;
  mpesaReceiptNumber: string | null;
  rejectionReason: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface WithdrawalEligibility {
  available_balance: number;
  min_withdrawal: number;
  max_withdrawal: number;
  has_verified_account: boolean;
  can_withdraw: boolean;
}

export interface WalletDashboard {
  summary: WalletSummary;
  transactions: WalletTransaction[];
  payoutAccounts: PayoutAccount[];
  withdrawals: WithdrawalRecord[];
  eligibility: WithdrawalEligibility;
}

export interface PayoutAccountRequest {
  payoutMethod: 'MPESA';
  accountName: string;
  mpesaPhone: string;
  isDefault: boolean;
}

@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly http = inject(HttpService);

  loadDashboard(): Observable<WalletDashboard> {
    return forkJoin({
      summary: this.getOrDefault<WalletSummary>(ApiEndpoints.WALLET.SUMMARY, emptySummary()),
      transactions: this.getOrDefault<WalletTransaction[]>(ApiEndpoints.WALLET.TRANSACTIONS, []),
      payoutAccounts: this.http.get<PayoutAccount[]>(ApiEndpoints.WALLET.PAYOUT_ACCOUNTS),
      withdrawals: this.http.get<WithdrawalRecord[]>(ApiEndpoints.WALLET.WITHDRAWALS),
      eligibility: this.getOrDefault<WithdrawalEligibility>(ApiEndpoints.WALLET.WITHDRAWAL_ELIGIBILITY, emptyEligibility()),
    }).pipe(
      map(({ summary, transactions, payoutAccounts, withdrawals, eligibility }) => ({
        summary: normalizeSummary(summary.data),
        transactions: normalizeList(transactions.data, normalizeTransaction),
        payoutAccounts: normalizeList(payoutAccounts.data, normalizePayoutAccount),
        withdrawals: normalizeList(withdrawals.data, normalizeWithdrawal),
        eligibility: normalizeEligibility(eligibility.data),
      })),
    );
  }

  addPayoutAccount(request: PayoutAccountRequest): Observable<PayoutAccount> {
    return this.http.post<unknown>(ApiEndpoints.WALLET.CREATE_PAYOUT_ACCOUNT, request).pipe(
      map((response) => {
        if (!response.success || !response.data) throw new Error(response.message || 'Could not add the payout account.');
        const account = normalizePayoutAccount(response.data);
        if (!account) throw new Error('The backend returned an invalid payout account.');
        return account;
      }),
    );
  }

  requestWithdrawal(amount: number, payoutAccountId: number): Observable<WithdrawalRecord> {
    return this.http.post<unknown>(ApiEndpoints.WALLET.CREATE_WITHDRAWAL, { amount, payoutAccountId }).pipe(
      map((response) => {
        if (!response.success || !response.data) throw new Error(response.message || 'Could not submit the withdrawal request.');
        const payout = normalizeWithdrawal(response.data);
        if (!payout) throw new Error('The backend returned an invalid withdrawal request.');
        return payout;
      }),
    );
  }

  private getOrDefault<T>(url: string, fallback: T): Observable<ApiResponse<T>> {
    return this.http.get<T>(url).pipe(catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        return of({ success: true, data: fallback } as ApiResponse<T>);
      }
      return throwError(() => error);
    }));
  }
}

function emptySummary(): WalletSummary {
  return { pendingBalance: 0, availableBalance: 0, processingBalance: 0, totalBalance: 0, totalPaid: 0, totalEarned: 0, status: 'ACTIVE', transactionCount: 0 };
}

function emptyEligibility(): WithdrawalEligibility {
  return { available_balance: 0, min_withdrawal: 100, max_withdrawal: 70_000, has_verified_account: false, can_withdraw: false };
}

function normalizeSummary(value: unknown): WalletSummary {
  const source = asRecord(value);
  return {
    pendingBalance: numberValue(source['pendingBalance']),
    availableBalance: numberValue(source['availableBalance']),
    processingBalance: numberValue(source['processingBalance']),
    totalBalance: numberValue(source['totalBalance']),
    totalPaid: numberValue(source['totalPaid']),
    totalEarned: numberValue(source['totalEarned']),
    status: stringValue(source['status']) || 'ACTIVE',
    transactionCount: numberValue(source['transactionCount']),
  };
}

function normalizeEligibility(value: unknown): WithdrawalEligibility {
  const source = asRecord(value);
  return {
    available_balance: numberValue(source['available_balance']),
    min_withdrawal: numberValue(source['min_withdrawal'], 100),
    max_withdrawal: numberValue(source['max_withdrawal'], 70_000),
    has_verified_account: source['has_verified_account'] === true,
    can_withdraw: source['can_withdraw'] === true,
  };
}

function normalizeTransaction(value: unknown): WalletTransaction | null {
  const source = asRecord(value);
  const id = numberOrNull(source['id']);
  if (id === null) return null;
  return {
    id,
    orderId: numberOrNull(source['orderId']),
    transactionType: stringValue(source['transactionType']).toUpperCase(),
    amount: numberValue(source['amount']),
    status: stringValue(source['status']).toUpperCase(),
    reference: nullableString(source['reference']),
    description: nullableString(source['description']),
    balanceAfter: numberValue(source['balanceAfter']),
    pendingBalanceAfter: numberValue(source['pendingBalanceAfter']),
    availableBalanceAfter: numberValue(source['availableBalanceAfter']),
    processingBalanceAfter: numberValue(source['processingBalanceAfter']),
    createdAt: stringValue(source['createdAt']),
  };
}

function normalizePayoutAccount(value: unknown): PayoutAccount | null {
  const source = asRecord(value);
  const id = numberOrNull(source['id']);
  if (id === null) return null;
  return {
    id,
    payoutMethod: stringValue(source['payoutMethod']).toUpperCase(),
    accountName: stringValue(source['accountName']),
    mpesaPhone: nullableString(source['mpesaPhone']),
    maskedMpesaPhone: nullableString(source['maskedMpesaPhone']),
    isDefault: source['isDefault'] === true || source['default'] === true,
    verificationStatus: stringValue(source['verificationStatus']).toUpperCase(),
    verifiedAt: nullableString(source['verifiedAt']),
  };
}

function normalizeWithdrawal(value: unknown): WithdrawalRecord | null {
  const source = asRecord(value);
  const id = numberOrNull(source['id']);
  if (id === null) return null;
  return {
    id,
    amount: numberValue(source['amount']),
    payoutAccountId: numberOrNull(source['payoutAccountId']),
    payoutMethod: stringValue(source['payoutMethod']).toUpperCase(),
    destinationSnapshot: nullableString(source['destinationSnapshot']),
    status: stringValue(source['status']).toUpperCase(),
    reference: nullableString(source['reference']),
    mpesaReceiptNumber: nullableString(source['mpesaReceiptNumber']),
    rejectionReason: nullableString(source['rejectionReason']),
    createdAt: stringValue(source['createdAt']),
    paidAt: nullableString(source['paidAt']),
  };
}

function normalizeList<T>(value: unknown, normalize: (item: unknown) => T | null): T[] {
  return Array.isArray(value) ? value.map(normalize).filter((item): item is T => item !== null) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numberOrNull(value: unknown): number | null {
  const parsed = numberValue(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
