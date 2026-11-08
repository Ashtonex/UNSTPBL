import {
  createContext,
  useContext,
  useId,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface TabsContextValue {
  value: string;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

const TAB_BASE =
  'shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-lg border text-sm font-semibold ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60';
const TAB_ACTIVE = 'bg-brand-500/10 text-brand-400 border-brand-500/20';
const TAB_IDLE = 'text-fg-muted border-transparent hover:text-fg-soft';

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Names the group of tabs for screen readers, e.g. "Dashboard sections". */
  label: string;
  /** The TabPanel elements. Only the one matching `value` is shown. */
  children: ReactNode;
  className?: string;
}

/**
 * A row of tabs with their panels, following the standard accessible pattern:
 *  - the tabs are announced as a tab list; the selected one as selected;
 *  - Left and Right arrows (and Home and End) move between tabs, as on a phone's own tab bars;
 *  - only the selected tab is reachable with Tab, the rest are one arrow key away;
 *  - each tab points at its panel and each panel is named by its tab.
 * On a narrow screen the row scrolls sideways instead of wrapping or overflowing the page.
 */
export function Tabs({ tabs, value, onChange, label, children, className = '' }: TabsProps) {
  const baseId = useId();
  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;

  const select = (id: string) => {
    onChange(id);
    // Move keyboard focus with the selection; the browser scrolls the tab into view.
    requestAnimationFrame(() => document.getElementById(tabId(id))?.focus());
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === value);
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    event.preventDefault();
    select(tabs[next]!.id);
  };

  const onClick = (event: MouseEvent<HTMLButtonElement>, id: string) => {
    onChange(id);
    // Keep the chosen tab visible when the row is wider than the screen.
    event.currentTarget.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1.5 overflow-x-auto hide-scrollbar border-b border-white/5 pb-1"
      >
        {tabs.map((tab) => {
          const selected = tab.id === value;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              aria-selected={selected}
              aria-controls={panelId(tab.id)}
              tabIndex={selected ? 0 : -1}
              onClick={(event) => onClick(event, tab.id)}
              className={`${TAB_BASE} ${selected ? TAB_ACTIVE : TAB_IDLE}`}
            >
              {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
              {tab.label}
            </button>
          );
        })}
      </div>
      <TabsContext.Provider value={{ value, baseId }}>{children}</TabsContext.Provider>
    </div>
  );
}

/** The content of one tab. It renders nothing unless its tab is the selected one. */
export function TabPanel({ id, children, className = '' }: { id: string; children: ReactNode; className?: string }) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabPanel must be used inside <Tabs>');
  if (context.value !== id) return null;

  return (
    <div
      role="tabpanel"
      id={`${context.baseId}-panel-${id}`}
      aria-labelledby={`${context.baseId}-tab-${id}`}
      tabIndex={0}
      className={`pt-5 focus-visible:outline-none animate-fade-in ${className}`}
    >
      {children}
    </div>
  );
}
