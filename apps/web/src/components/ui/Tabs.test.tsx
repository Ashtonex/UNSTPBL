// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { useTabParam, resolveTab } from '../../hooks/useTabParam';
import { TabPanel, Tabs } from './Tabs';

afterEach(cleanup);

const TABS = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
  { id: 'three', label: 'Three' },
];

function Demo() {
  const [value, setValue] = useState('one');
  return (
    <Tabs tabs={TABS} value={value} onChange={setValue} label="Sections">
      <TabPanel id="one">First content</TabPanel>
      <TabPanel id="two">Second content</TabPanel>
      <TabPanel id="three">Third content</TabPanel>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('announces a tab list, marks the selected tab, and shows only its panel', () => {
    render(<Demo />);
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeTruthy();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    expect(screen.getByText('First content')).toBeTruthy();
    expect(screen.queryByText('Second content')).toBeNull();
  });

  it('switches panel when a tab is clicked', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByRole('tab', { name: 'Two' }));

    expect(screen.getByRole('tab', { name: 'Two' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Second content')).toBeTruthy();
    expect(screen.queryByText('First content')).toBeNull();
  });

  it('links each tab to its panel, and names the panel by its tab', () => {
    render(<Demo />);
    const tab = screen.getByRole('tab', { name: 'One' });
    const panel = screen.getByRole('tabpanel');

    expect(tab.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
  });

  it('only the selected tab is reachable with Tab (roving tabindex)', () => {
    render(<Demo />);
    expect(screen.getAllByRole('tab').map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  it('moves with the arrow keys, wrapping at the ends, and with Home and End', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    screen.getByRole('tab', { name: 'One' }).focus();

    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Two' })));
    expect(screen.getByText('Second content')).toBeTruthy();

    await user.keyboard('{End}');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Three' })));

    await user.keyboard('{ArrowRight}'); // wraps to the first
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'One' })));

    await user.keyboard('{ArrowLeft}'); // wraps to the last
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Three' })));

    await user.keyboard('{Home}');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'One' })));
  });
});

describe('resolveTab', () => {
  const ids = ['overview', 'schedule', 'community'] as const;

  it('uses a valid tab from the address', () => {
    expect(resolveTab('schedule', ids, 'overview')).toBe('schedule');
  });

  it('falls back for a missing, unknown or tampered value', () => {
    expect(resolveTab(null, ids, 'overview')).toBe('overview');
    expect(resolveTab('', ids, 'overview')).toBe('overview');
    expect(resolveTab('admin', ids, 'overview')).toBe('overview');
    expect(resolveTab('__proto__', ids, 'overview')).toBe('overview');
  });
});

describe('useTabParam', () => {
  const IDS = ['overview', 'schedule', 'community'] as const;

  function Probe() {
    const [tab, setTab] = useTabParam(IDS, 'overview');
    const location = useLocation();
    return (
      <>
        <p data-testid="tab">{tab}</p>
        <p data-testid="search">{location.search}</p>
        <button onClick={() => setTab('schedule')}>go schedule</button>
        <button onClick={() => setTab('overview')}>go overview</button>
      </>
    );
  }

  const renderAt = (url: string) =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <Probe />
      </MemoryRouter>,
    );

  it('reads the tab from the address', () => {
    renderAt('/bishop?tab=community');
    expect(screen.getByTestId('tab').textContent).toBe('community');
  });

  it('ignores an unknown tab in the address', () => {
    renderAt('/bishop?tab=nonsense');
    expect(screen.getByTestId('tab').textContent).toBe('overview');
  });

  it('writes the tab to the address, and keeps the address clean for the default tab', async () => {
    const user = userEvent.setup();
    renderAt('/bishop');

    await user.click(screen.getByText('go schedule'));
    expect(screen.getByTestId('tab').textContent).toBe('schedule');
    expect(screen.getByTestId('search').textContent).toBe('?tab=schedule');

    await user.click(screen.getByText('go overview'));
    expect(screen.getByTestId('search').textContent).toBe('');
  });

  it('keeps other parts of the address when switching tabs', async () => {
    const user = userEvent.setup();
    renderAt('/bishop?foo=bar');
    await user.click(screen.getByText('go schedule'));
    expect(screen.getByTestId('search').textContent).toBe('?foo=bar&tab=schedule');
  });
});
