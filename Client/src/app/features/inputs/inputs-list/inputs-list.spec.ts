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
});
