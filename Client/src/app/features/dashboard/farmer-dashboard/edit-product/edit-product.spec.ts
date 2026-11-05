import { signal } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { Product } from '../../../../core/services/product';
import type { Product as ProductModel } from '../../../../shared/product.model';
import { NotificationService } from '../../../../shared/notification/notification.service';
import { EditProduct } from './edit-product';

describe('EditProduct', () => {
  const product: ProductModel = {
    id: '39',
    name: 'Tomatoes',
    description: 'Fresh tomatoes from the farm',
    price: 120,
    quantity: 10,
    unit: 'kg',
    category: 'Vegetables',
    type: 'PRODUCE',
    images: [],
    farmerId: '8',
    farmerName: 'Farmer',
    farmerVerified: true,
    location: 'Nairobi',
    rating: 0,
    reviewCount: 0,
    available: true,
    createdAt: '2026-10-07T10:00:00',
    categoryId: 3,
    minimumOrderQty: 1,
  };

  function renderEditProduct() {
    return render(EditProduct, {
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '39' } } },
        },
        {
          provide: Product,
          useValue: {
            categories: signal([{ id: 3, name: 'Vegetables', type: 'FARMER' }]),
            getById: vi.fn(() => of({ success: true, message: 'Success', data: product })),
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
    const { container } = await renderEditProduct();
    expect(container).toBeTruthy();
  });

  it('should display the edit product title', async () => {
    await renderEditProduct();
    expect(screen.getByText('Edit Product')).toBeTruthy();
  });

  it('enables save when a non-price field changes', async () => {
    const { fixture } = await renderEditProduct();
    const saveButton = screen.getByRole('button', { name: 'Save Changes' }) as HTMLButtonElement;

    expect(saveButton.disabled).toBe(true);
    fireEvent.input(screen.getByLabelText(/Product Name/), {
      target: { value: 'Organic Tomatoes' },
    });
    fixture.detectChanges();

    expect(saveButton.disabled).toBe(false);
  });
});
