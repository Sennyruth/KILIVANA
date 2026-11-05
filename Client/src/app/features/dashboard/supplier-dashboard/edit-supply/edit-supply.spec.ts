import { signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { Product } from '../../../../core/services/product';
import type { Product as ProductModel } from '../../../../shared/product.model';
import { NotificationService } from '../../../../shared/notification/notification.service';
import { EditSupply } from './edit-supply';

describe('EditSupply', () => {
  const supply: ProductModel = {
    id: '39',
    name: 'NPK Fertilizer',
    description: 'Balanced fertilizer for healthy crop growth',
    price: 3200,
    quantity: 45,
    unit: 'bag',
    category: 'Fertilizer',
    type: 'INPUT',
    images: [],
    farmerId: '8',
    farmerName: 'Supplier',
    farmerVerified: false,
    location: '',
    rating: 0,
    reviewCount: 0,
    available: true,
    createdAt: '2026-10-07T10:00:00',
    categoryId: 13,
    minimumOrderQty: 1,
  };

  function renderEditSupply() {
    return render(EditSupply, {
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '39' } } },
        },
        {
          provide: Product,
          useValue: {
            categories: signal([{ id: 13, name: 'Fertilizer', type: 'SUPPLIER' }]),
            categoriesLoading: signal(false),
            categoriesError: signal(null),
            reloadCategories: vi.fn(),
            getById: vi.fn(() => of({ success: true, message: 'Success', data: supply })),
            update: vi.fn(() => of({ success: true, message: 'Updated', data: null })),
            uploadImages: vi.fn(() => of({ success: true, message: 'Uploaded', data: [] })),
          },
        },
        {
          provide: NotificationService,
          useValue: { error: vi.fn(), warning: vi.fn(), success: vi.fn() },
        },
      ],
    });
  }

  it('should create the component', async () => {
    const { container } = await renderEditSupply();
    expect(container).toBeTruthy();
  });

  it('should display the edit supply title', async () => {
    await renderEditSupply();
    expect(screen.getByText('Edit Supply')).toBeTruthy();
  });

  it('enables save when a non-price field changes', async () => {
    const { fixture } = await renderEditSupply();
    const saveButton = screen.getByRole('button', { name: 'Save Changes' }) as HTMLButtonElement;

    expect(saveButton.disabled).toBe(true);
    fireEvent.input(screen.getByLabelText(/Supply Name/), {
      target: { value: 'Organic NPK Fertilizer' },
    });
    fixture.detectChanges();

    expect(saveButton.disabled).toBe(false);
  });
});
