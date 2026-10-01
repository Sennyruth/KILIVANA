import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { EditSupply } from './edit-supply';

describe('EditSupply', () => {
  it('should create the component', async () => {
    const { container } = await render(EditSupply);
    expect(container).toBeTruthy();
  });

  it('should display the edit supply title', async () => {
    await render(EditSupply);
    expect(screen.getByText('Edit Supply')).toBeTruthy();
  });
});
