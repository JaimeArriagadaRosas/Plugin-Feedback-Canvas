import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';

describe('Modal', () => {
  it('should render children when open', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test Modal">
        <div>Modal content</div>
      </Modal>
    );
    expect(screen.getByText('Modal content')).toBeDefined();
  });

  it('should not render when closed', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Test Modal">
        <div>Modal content</div>
      </Modal>
    );
    expect(screen.queryByText('Modal content')).toBeNull();
  });

  it('should call onClose when close button clicked', () => {
    const spy = vi.fn();
    render(
      <Modal isOpen={true} onClose={spy} title="Test Modal">
        <div>Modal content</div>
      </Modal>
    );
    fireEvent.click(screen.getByLabelText(/cerrar/i));
    expect(spy).toHaveBeenCalled();
  });
});
