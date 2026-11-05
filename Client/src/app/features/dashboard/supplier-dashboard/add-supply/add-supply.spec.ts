import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/angular';
import { of } from 'rxjs';
import { Product } from '../../../../core/services/product';
import { SellerLocationService } from '../../../../core/services/seller-location';
import type { SellerLocation } from '../../../../shared/seller-location.model';
import { NotificationService } from '../../../../shared/notification/notification.service';
import { AddSupply } from './add-supply';

describe('AddSupply', () => {
  const activeWarehouse: SellerLocation = {
    id: 12,
    name: 'Main store',
    address: 'Market Road',
    county: 'Nairobi',
    latitude: -1.2921,
    longitude: 36.8219,
    active: true,
    defaultLocation: true,
  };

  function renderAddSupply(locations: SellerLocation[] = [activeWarehouse]) {
    const setDefaultLocation = vi.fn((id: number | string) =>
      of({
        success: true,
        message: 'Default updated',
        data: { ...activeWarehouse, id, defaultLocation: true },
      }),
    );

    return render(AddSupply, {
      providers: [
        provideRouter([]),
        {
          provide: Product,
          useValue: {
            categories: signal([{ id: 3, name: 'Fertilizer', type: 'SUPPLIER' }]),
            categoriesLoading: signal(false),
            categoriesError: signal(null),
            reloadCategories: vi.fn(),
          },
        },
        {
          provide: SellerLocationService,
          useValue: {
            getMyLocations: vi.fn(() =>
              of({ success: true, message: 'Success', data: locations }),
            ),
            setDefaultLocation,
          },
        },
        {
          provide: NotificationService,
          useValue: {
            error: vi.fn(),
            warning: vi.fn(),
            success: vi.fn(),
          },
        },
      ],
    }).then((result) => ({ ...result, setDefaultLocation }));
  }

  it('should create the component', async () => {
    const { container } = await renderAddSupply();
    expect(container).toBeTruthy();
  });

  it('should display the add supply title', async () => {
    await renderAddSupply();
    expect(screen.getByText('Add New Supply')).toBeTruthy();
  });

  it('uses the active default warehouse as the dispatch location', async () => {
    const { setDefaultLocation } = await renderAddSupply();

    expect(await screen.findByText('Dispatch warehouse:')).toBeTruthy();
    expect(screen.getByText('Main store')).toBeTruthy();
    expect(setDefaultLocation).not.toHaveBeenCalled();
  });

  it('sets the only active warehouse as the default dispatch location', async () => {
    const { setDefaultLocation } = await renderAddSupply([
      { ...activeWarehouse, defaultLocation: false },
    ]);

    expect(setDefaultLocation).toHaveBeenCalledWith(activeWarehouse.id);
    await waitFor(() => expect(screen.getByText('Dispatch warehouse:')).toBeTruthy());
  });

  it('directs suppliers with no active warehouse to warehouse management', async () => {
    await renderAddSupply([{ ...activeWarehouse, active: false }]);

    expect(
      screen.getByText('Add an active warehouse before creating a supply listing.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Manage warehouses' })).toBeTruthy();
  });

  it('requires a default choice when multiple active warehouses exist', async () => {
    await renderAddSupply([
      { ...activeWarehouse, defaultLocation: false },
      { ...activeWarehouse, id: 13, name: 'Second store', defaultLocation: false },
    ]);

    expect(
      screen.getByText('Choose a default dispatch warehouse before creating a supply listing.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Manage warehouses' })).toBeTruthy();
  });
});
