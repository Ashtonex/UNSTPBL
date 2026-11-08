// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Sheet from './Sheet';

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open sheet</button>
      <Sheet
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
        label="Share a prayer"
      >
        <button>First</button>
        <input aria-label="Middle" />
        <button>Last</button>
      </Sheet>
    </>
  );
}

describe('Sheet', () => {
  it('renders nothing while closed', () => {
    render(
      <Sheet open={false} onClose={() => {}} label="Hidden">
        <p>content</p>
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is announced as a modal dialog with a name', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('Open sheet'));

    const dialog = screen.getByRole('dialog', { name: 'Share a prayer' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('moves focus into the dialog and returns it to the opener on close', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByText('Open sheet');
    await user.click(opener);

    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(dialog);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('closes on Escape and when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);

    await user.click(screen.getByText('Open sheet'));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Open sheet'));
    await user.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('Open sheet'));

    const first = screen.getByText('First');
    const middle = screen.getByLabelText('Middle');
    const last = screen.getByText('Last');

    last.focus();
    await user.tab(); // from the last control wraps to the first
    expect(document.activeElement).toBe(first);

    await user.tab({ shift: true }); // from the first control wraps to the last
    expect(document.activeElement).toBe(last);

    middle.focus();
    await user.tab();
    expect(document.activeElement).toBe(last); // ordinary movement is untouched
  });

  it('stops the page behind from scrolling, and restores it afterwards', async () => {
    const user = userEvent.setup();
    document.body.style.overflow = 'auto';
    render(<Harness />);

    await user.click(screen.getByText('Open sheet'));
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('auto');
  });
});
