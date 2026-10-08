import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-logout',
  imports: [MatIconModule, MatProgressSpinnerModule],
  styleUrl: './logout.scss',
  templateUrl: './logout.html',
})
export class Logout implements OnInit {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.auth.logout();
    setTimeout(() => {
      this.router.navigate(['/login']);
    }, 1200);
  }
}