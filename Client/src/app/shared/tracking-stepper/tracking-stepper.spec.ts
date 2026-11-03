import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { TrackingHistory } from '../tracking.model';
import { TrackingStepper } from './tracking-stepper';

describe('TrackingStepper', () => {
  let fixture: ComponentFixture<TrackingStepper>;

  const confirmedHistory: TrackingHistory = {
    orderId: '37',
    currentStage: 'CONFIRMED',
    events: [
      {
        id: '1',
        stage: 'PLACED',
        status: 'COMPLETED',
        timestamp: '2026-11-03T11:55:00Z',
      },
      {
        id: '2',
        stage: 'CONFIRMED',
        status: 'COMPLETED',
        timestamp: '2026-11-03T11:57:00Z',
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrackingStepper],
    }).compileComponents();
    fixture = TestBed.createComponent(TrackingStepper);
  });

  it('uses delivered delivery status when the order timeline is only confirmed', () => {
    fixture.componentRef.setInput('history', confirmedHistory);
    fixture.componentRef.setInput('orderStatus', 'CONFIRMED');
    fixture.componentRef.setInput('deliveryStatus', 'DELIVERED');
    fixture.detectChanges();

    const stages = fixture.nativeElement.querySelectorAll('.tracking-stepper__stage');
    expect(stages[1].classList).toContain('tracking-stepper__stage--completed');
    expect(stages[3].classList).toContain('tracking-stepper__stage--active');
    expect(fixture.nativeElement.textContent).toContain('Delivered');
  });

  it('advances to shipped when the delivery job has been picked up', () => {
    fixture.componentRef.setInput('history', confirmedHistory);
    fixture.componentRef.setInput('orderStatus', 'CONFIRMED');
    fixture.componentRef.setInput('deliveryStatus', 'PICKED_UP');
    fixture.detectChanges();

    const stages = fixture.nativeElement.querySelectorAll('.tracking-stepper__stage');
    expect(stages[1].classList).toContain('tracking-stepper__stage--completed');
    expect(stages[2].classList).toContain('tracking-stepper__stage--active');
  });
});
