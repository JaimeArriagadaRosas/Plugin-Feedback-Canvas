import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StarRating from './StarRating';

describe('StarRating', () => {
  it('should render 5 stars', () => {
    render(<StarRating value={0} onChange={() => {}} />);
    const stars = screen.getAllByRole('button');
    expect(stars.length).toBe(5);
  });

  it('should set aria-checked for selected stars', () => {
    render(<StarRating value={3} onChange={() => {}} />);
    const stars = screen.getAllByRole('button');
    expect(stars[2].getAttribute('aria-checked')).toBe('true');
    expect(stars[0].getAttribute('aria-checked')).toBe('false');
  });

  it('should call onChange when star clicked', () => {
    const spy = vi.fn();
    render(<StarRating value={0} onChange={spy} />);
    const stars = screen.getAllByRole('button');
    fireEvent.click(stars[2]);
    expect(spy).toHaveBeenCalledWith(3);
  });
});
