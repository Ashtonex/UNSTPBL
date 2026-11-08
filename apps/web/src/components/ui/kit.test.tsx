// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Button from './Button';
import { PendingState } from './EmptyState';
import Notice from './Notice';
import PageHeader from './PageHeader';

afterEach(cleanup);

describe('Button', () => {
  it('is a plain button by default, so it never submits a form by accident', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('button');
  });

  it('can be a submit button when asked', () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole('button', { name: 'Send' }).getAttribute('type')).toBe('submit');
  });

  it('while loading is disabled, announces that it is busy and ignores clicks', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole('button', { name: /Saving/ });
    expect(button).toHaveProperty('disabled', true);
    expect(button.getAttribute('aria-busy')).toBe('true');

    await userEvent.setup().click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('calls onClick when enabled', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Notice', () => {
  it('announces errors immediately and other tones politely', () => {
    render(
      <>
        <Notice tone="error">Broke</Notice>
        <Notice tone="success">Saved</Notice>
        <Notice>Heads up</Notice>
      </>,
    );
    expect(screen.getByText('Broke').closest('[role]')?.getAttribute('role')).toBe('alert');
    expect(screen.getByText('Saved').closest('[role]')?.getAttribute('role')).toBe('status');
    expect(screen.getByText('Heads up').closest('[role]')?.getAttribute('role')).toBe('status');
  });
});

describe('PageHeader', () => {
  it('shows the title, subtitle and action', () => {
    render(<PageHeader title="Prayers" subtitle="Pray together" action={<button>Add</button>} />);
    expect(screen.getByRole('heading', { name: 'Prayers' })).toBeTruthy();
    expect(screen.getByText('Pray together')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
  });
});

describe('PendingState', () => {
  const setOnline = (value: boolean) =>
    Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });

  afterEach(() => setOnline(true));

  it('shows loading placeholders while online', () => {
    setOnline(true);
    render(<PendingState label="Loading prayers" />);
    expect(screen.getByRole('status', { name: 'Loading prayers' })).toBeTruthy();
    expect(screen.queryByText("You're offline")).toBeNull();
  });

  it('says so, instead of loading for ever, when offline, and recovers when back online', () => {
    setOnline(false);
    render(<PendingState />);
    expect(screen.getByText("You're offline")).toBeTruthy();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText("You're offline")).toBeNull();
  });
});
