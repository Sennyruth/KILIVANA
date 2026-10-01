import { Component, OnInit, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TrackingStepper } from '../../../shared/tracking-stepper/tracking-stepper';
import { Tracking } from '../../../core/services/tracking';

@Component({
  selector: 'app-order-tracker',
  imports: [RouterLink, MatIconModule, MatButtonModule, TrackingStepper],
  styleUrl: './order-tracker.scss',
  templateUrl: './order-tracker.html',
})
export class OrderTracker implements OnInit {
  protected readonly route = inject(ActivatedRoute);
  protected readonly tracking = inject(Tracking);
  protected readonly orderId = this.route.snapshot.paramMap.get('orderId') ?? 'last';

  protected readonly history = this.tracking.history;
  protected readonly loading = this.tracking.loading;

  protected readonly orderInfo = computed(() => {
    const h = this.history();
    if (!h) return null;
    return {
      orderId: h.orderId,
      currentStage: h.currentStage,
      eventCount: h.events.length,
    };
  });

  ngOnInit(): void {
    if (this.orderId !== 'last') {
      this.tracking.load(this.orderId).subscribe();
    }
  }
}
