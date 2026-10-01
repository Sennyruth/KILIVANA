import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { InputsDetail } from './inputs-detail';

describe('InputsDetail', () => {
  it('should create the component', async () => {
    const { container } = await render(InputsDetail);
    expect(container).toBeTruthy();
  });
});
