import { Component, inject, OnInit } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationData {
  message: string;
  type: NotificationType;
  duration?: number;
}

@Component({
  selector: 'app-notification',
  imports: [MatIconModule],
  styleUrl: './notification.component.scss',
  templateUrl: './notification.component.html',
})
export class NotificationComponent implements OnInit {
  readonly snackBarRef = inject(MatSnackBarRef<NotificationComponent>);
  readonly data: NotificationData = inject(MAT_SNACK_BAR_DATA, { optional: true }) ?? {
    message: '',
    type: 'info',
  };

  ngOnInit(): void {
    if (this.data.duration && this.data.duration > 0) {
      setTimeout(() => {
        this.snackBarRef.dismiss();
      }, this.data.duration);
    }
  }

  get icon(): string {
    switch (this.data.type) {
      case 'success':
        return 'check_circle';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'info';
    }
  }

  get iconClass(): string {
    return `notification__icon--${this.data.type}`;
  }

  dismiss(): void {
    this.snackBarRef.dismiss();
  }
}
