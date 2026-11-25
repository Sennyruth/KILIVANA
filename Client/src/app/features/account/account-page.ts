import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AccountProfile } from '../../shared/account-profile/account-profile';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-account-page',
  imports: [RouterLink, MatIconModule, AccountProfile],
  templateUrl: './account-page.html',
  styleUrl: './account-page.scss',
})
export class AccountPage {
  private readonly auth = inject(Auth);
  protected readonly dashboardHref = computed(() => {
    const role = this.auth.role();
    if (role === 'FARMER') return '/dashboard/farmer';
    if (role === 'SUPPLIER') return '/dashboard/supplier';
    return '/dashboard/buyer';
  });
}
