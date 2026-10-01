import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { EditProduct } from './edit-product';

describe('EditProduct', () => {
  it('should create the component', async () => {
    const { container } = await render(EditProduct);
    expect(container).toBeTruthy();
  });

  it('should display the edit product title', async () => {
    await render(EditProduct);
    expect(screen.getByText('Edit Product')).toBeTruthy();
  });
});
