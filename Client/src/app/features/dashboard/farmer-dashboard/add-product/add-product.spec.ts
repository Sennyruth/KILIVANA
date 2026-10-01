import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { AddProduct } from './add-product';

describe('AddProduct', () => {
  it('should create the component', async () => {
    const { container } = await render(AddProduct);
    expect(container).toBeTruthy();
  });

  it('should display the add product title', async () => {
    await render(AddProduct);
    expect(screen.getByText('Add New Product')).toBeTruthy();
  });
});
