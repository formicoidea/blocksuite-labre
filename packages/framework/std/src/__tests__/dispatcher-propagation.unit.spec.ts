import { describe, expect, test, vi } from 'vitest';

import { UIEventState, UIEventStateContext } from '../event/base.js';
import { type EventName, UIEventDispatcher } from '../event/dispatcher.js';
import {
  EventScopeSourceType,
  EventSourceState,
} from '../event/state/source.js';
import type { BlockStdScope } from '../scope/index.js';

/**
 * `run()` only needs a std when it has to resolve the event scope itself; the
 * tests below hand it an explicit runner list, so a bare object is enough.
 */
function createDispatcher() {
  const dispatcher = new UIEventDispatcher({} as unknown as BlockStdScope);
  dispatcher.active = true;
  return dispatcher;
}

function contextFor(event: Event) {
  return UIEventStateContext.from(
    new UIEventState(event),
    new EventSourceState({
      event,
      sourceType: EventScopeSourceType.Selection,
    })
  );
}

/** Run a handler that consumes the event, and report whether propagation stopped. */
function runConsumed(dispatcher: UIEventDispatcher, name: EventName) {
  // `click`/`doubleClick`/`tripleClick` are all synthesized from one native
  // `pointerup`, so stopping propagation there kills unrelated pointer logic.
  const event = new PointerEvent('pointerup');
  const stopPropagation = vi.spyOn(event, 'stopPropagation');
  dispatcher.run(name, contextFor(event), [{ fn: () => true }]);
  return stopPropagation.mock.calls.length > 0;
}

describe('UIEventDispatcher.run propagation', () => {
  test.each(['click', 'doubleClick', 'tripleClick'] as const)(
    'a consumed %s does not stop propagation of the underlying native event',
    name => {
      const dispatcher = createDispatcher();
      expect(runConsumed(dispatcher, name)).toBe(false);
      dispatcher.active = false;
    }
  );

  test.each(['pointerDown', 'pointerUp', 'keyDown', 'dragStart'] as const)(
    'a consumed %s still stops propagation',
    name => {
      const dispatcher = createDispatcher();
      expect(runConsumed(dispatcher, name)).toBe(true);
      dispatcher.active = false;
    }
  );

  test('a handler that does not consume the event never stops propagation', () => {
    const dispatcher = createDispatcher();
    const event = new PointerEvent('pointerup');
    const stopPropagation = vi.spyOn(event, 'stopPropagation');
    dispatcher.run('pointerUp', contextFor(event), [{ fn: () => false }]);
    expect(stopPropagation).not.toHaveBeenCalled();
    dispatcher.active = false;
  });

  test('a consumed synthetic click still stops the runner chain', () => {
    const dispatcher = createDispatcher();
    const later = vi.fn(() => true);
    dispatcher.run('click', contextFor(new PointerEvent('pointerup')), [
      { fn: () => true },
      { fn: later },
    ]);
    expect(later).not.toHaveBeenCalled();
    dispatcher.active = false;
  });
});
