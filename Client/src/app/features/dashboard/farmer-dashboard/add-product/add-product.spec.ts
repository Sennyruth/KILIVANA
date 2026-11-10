import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { Product } from '../../../../core/services/product';
import { Farmer } from '../../../../core/services/farmer';
import { hasFarmDispatchLocation, type FarmerFarm } from '../../../../shared/farm.model';
import { NotificationService } from '../../../../shared/notification/notification.service';
import { AddProduct } from './add-product';

describe('AddProduct', () => {
  const activeFarm: FarmerFarm = {
    id: 17,
    farmerId: 8,
    name: 'Main Farm',
    county: 'Kiambu',
    address: 'Farm road, Kiambu',
    latitude: -1.2864,
    longitude: 36.8172,
    sizeAcres: 5,
    ownershipType: 'OWNED',
    status: 'ACTIVE',
  };

  function renderAddProduct(farms: FarmerFarm[] = [activeFarm]) {
    return render(AddProduct, {
      providers: [
        provideRouter([]),
        {
          provide: Product,
          useValue: {
            categories: signal([{ id: 13, name: 'Vegetables', type: 'FARMER' }]),
            categoriesLoading: signal(false),
            categoriesError: signal(null),
            reloadCategories: vi.fn(),
            createListingWithImages: vi.fn(),
          },
        },
        {
          provide: Farmer,
          useValue: {
            getMyFarms: vi.fn(() =>
              of({ success: true, message: 'Success', data: farms }),
            ),
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
    });
  }

  it('should create the component', async () => {
    const { container } = await renderAddProduct();
    expect(container).toBeTruthy();
  });

  it('should display the add product title', async () => {
    await renderAddProduct();
    expect(screen.getByText('Add New Product')).toBeTruthy();
  });

  it('provides a dispatch farm field for active farms', async () => {
    await renderAddProduct();
    expect(screen.getByText('Dispatch location (Farm) *')).toBeTruthy();
  });

  it('directs farmers without an active farm to farm management', async () => {
    await renderAddProduct([{ ...activeFarm, status: 'INACTIVE' }]);
    expect(screen.getByText('Add or activate a farm before creating a product listing.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Manage farm' })).toBeTruthy();
  });

  it('requires both a dispatch address and valid map coordinates', () => {
    expect(hasFarmDispatchLocation(activeFarm)).toBe(true);
    expect(hasFarmDispatchLocation({ ...activeFarm, address: '  ' })).toBe(false);
    expect(hasFarmDispatchLocation({ ...activeFarm, latitude: null, longitude: null })).toBe(false);
    expect(hasFarmDispatchLocation({ ...activeFarm, latitude: 91 })).toBe(false);
  });

  it('requires farmers to update farms without coordinates before listing products', async () => {
    await renderAddProduct([{ ...activeFarm, latitude: null, longitude: null }]);
    expect(screen.getByText(/valid map coordinates/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Update farm' })).toBeTruthy();
  });
});
