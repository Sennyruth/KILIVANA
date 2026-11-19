import { TestBed } from '@angular/core/testing';
import { normalizePaymentStatus } from '../../shared/payment.model';
import { Payment } from './payment';

describe('Payment', () => {
  let service: Payment;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Payment);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('treats a timed-out payment as failed', () => {
    expect(normalizePaymentStatus('TIMED_OUT')).toBe('FAILED');
    expect(normalizePaymentStatus('TIMEOUT')).toBe('FAILED');
  });
});
