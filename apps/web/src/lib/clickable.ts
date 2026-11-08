import type { KeyboardEvent } from 'react';

/**
 * Props that make a card (a <div> holding other elements) behave as a button: reachable with the
 * keyboard and by screen readers, and activated with Enter or Space as well as a click.
 *
 * Use a real <button> whenever the content allows it; this is for cards that hold headings,
 * paragraphs and the like.
 */
export function clickableProps(onActivate: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      // Keys pressed inside a nested control belong to that control.
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onActivate();
      }
    },
  };
}

/** Focus ring for clickable cards, matching the app's buttons. */
export const CLICKABLE_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60';
