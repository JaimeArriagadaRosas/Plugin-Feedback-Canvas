import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from './Button';

describe('Button', () => {
  it('should render children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDefined();
  });

  it('should call onClick when clicked', () => {
    const spy = vi.fn();
    render(<Button onClick={spy}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(spy).toHaveBeenCalled();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    const btn = screen.getByRole('button', { name: /click me/i });
    expect(btn.hasAttribute('disabled')).toBe(true);
  });
});
