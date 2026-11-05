import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { InputsList } from './inputs-list';

describe('InputsList', () => {
  it('should create the component', async () => {
    const { container } = await render(InputsList);
    expect(container).toBeTruthy();
  });

  it('should display the inputs title', async () => {
    await render(InputsList);
    expect(screen.getByText('Agricultural Inputs')).toBeTruthy();
  });

  it('should display the inputs dashboard banner', async () => {
    await render(InputsList);

    const banner = screen.getByRole('img', { name: 'Farmer applying crop treatment in a field' });
    expect(banner.getAttribute('ngsrc')).toBe('/inputs banner.jpg');
  });
});
