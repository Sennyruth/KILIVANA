import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { AddSupply } from './add-supply';

describe('AddSupply', () => {
  it('should create the component', async () => {
    const { container } = await render(AddSupply);
    expect(container).toBeTruthy();
  });

  it('should display the add supply title', async () => {
    await render(AddSupply);
    expect(screen.getByText('Add New Supply')).toBeTruthy();
  });
});
