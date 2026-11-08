import { describe, expect, it, vi } from 'vitest';
import { clickableProps } from './clickable';

function keyEvent(key: string, sameTarget = true) {
  const target = {};
  return {
    key,
    target,
    currentTarget: sameTarget ? target : {},
    preventDefault: vi.fn(),
  } as never;
}

describe('clickableProps', () => {
  it('makes a card reachable and announced as a button', () => {
    const props = clickableProps(() => {});
    expect(props.role).toBe('button');
    expect(props.tabIndex).toBe(0);
  });

  it('activates on a click, Enter and Space', () => {
    const onActivate = vi.fn();
    const props = clickableProps(onActivate);

    props.onClick();
    props.onKeyDown(keyEvent('Enter'));
    props.onKeyDown(keyEvent(' '));
    expect(onActivate).toHaveBeenCalledTimes(3);
  });

  it('stops the page from scrolling when Space activates it', () => {
    const event = keyEvent(' ');
    clickableProps(() => {}).onKeyDown(event);
    expect((event as unknown as { preventDefault: () => void }).preventDefault).toHaveBeenCalled();
  });

  it('ignores other keys, and keys pressed inside a nested control', () => {
    const onActivate = vi.fn();
    const props = clickableProps(onActivate);

    props.onKeyDown(keyEvent('a'));
    props.onKeyDown(keyEvent('Tab'));
    props.onKeyDown(keyEvent('Enter', false)); // came from a button inside the card
    expect(onActivate).not.toHaveBeenCalled();
  });
});
