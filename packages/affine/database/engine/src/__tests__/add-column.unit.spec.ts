import { signal } from '@preact/signals-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { popMenu } = vi.hoisted(() => ({ popMenu: vi.fn() }));

vi.mock('@labre/affine-components/context-menu', async importOriginal => ({
  ...(await importOriginal<
    typeof import('@labre/affine-components/context-menu')
  >()),
  popMenu,
  popupTargetFromElement: () => ({}),
  // Configs, not render functions, so the test can call an entry's select.
  menu: { group: (c: unknown) => c, action: (c: unknown) => c },
}));

import {
  popNewPropertyMenu,
  whenPropertyShown,
} from '../core/common/property-menu.js';
import type { SingleView } from '../core/view-manager/single-view.js';
import { DatabaseColumnHeader } from '../view-presets/table/pc/header/column-header.js';

/**
 * The table's "+" column and the gestures that add a property then open its
 * title editor (the PO's recette of 2026-11-22, Labre V2).
 *
 * What it would have caught:
 * - the editor opened on "the last column next frame": with a host that
 *   applies the add asynchronously (a data source that first reads its
 *   server), the PREVIOUS column's editor opened;
 * - an editor opened for a property that never arrives;
 * - the classic table's "+" creating a column on click, before any type is
 *   picked, so Escape or a click outside left a stray column written.
 */

const GIVE_UP_MS = 100;

let frames: FrameRequestCallback[] = [];
const flushFrames = () => {
  vi.advanceTimersByTime(0);
  const pending = frames;
  frames = [];
  pending.forEach(cb => cb(0));
};

beforeEach(() => {
  frames = [];
  popMenu.mockReset();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const fakeView = (ids: string[] = ['a']) => {
  const properties$ = signal(ids.map(id => ({ id })));
  return {
    properties$,
    show: (id: string) => {
      properties$.value = [...properties$.value, { id }];
    },
  };
};

describe('whenPropertyShown', () => {
  it('waits for the added property, not for the next frame', () => {
    const view = fakeView();
    const then = vi.fn();
    whenPropertyShown(view as never, 'b', then);
    flushFrames();
    expect(then).not.toHaveBeenCalled();

    view.show('b');
    expect(then).not.toHaveBeenCalled();
    flushFrames();
    expect(then).toHaveBeenCalledOnce();

    view.show('c');
    flushFrames();
    expect(then).toHaveBeenCalledOnce();
  });

  it('runs on the next frame when the property is already displayed', () => {
    const then = vi.fn();
    whenPropertyShown(fakeView(['a', 'b']) as never, 'b', then);
    flushFrames();
    expect(then).toHaveBeenCalledOnce();
  });

  it('gives up when the property never arrives, or when cancelled', () => {
    const view = fakeView();
    const late = vi.fn();
    whenPropertyShown(view as never, 'b', late, GIVE_UP_MS);
    vi.advanceTimersByTime(GIVE_UP_MS);
    view.show('b');
    flushFrames();
    expect(late).not.toHaveBeenCalled();

    const cancelled = vi.fn();
    const cancel = whenPropertyShown(view as never, 'c', cancelled);
    cancel();
    view.show('c');
    flushFrames();
    expect(cancelled).not.toHaveBeenCalled();
  });
});

type PickerEntry = { name: string; select: () => void };
const entriesOf = (call: unknown[] | undefined) =>
  (call?.[1] as { options: { items: Array<{ items: PickerEntry[] }> } }).options
    .items[0]!.items;

describe('the new property type picker', () => {
  it('writes nothing until a type is picked, then adds that type', () => {
    const propertyAdd = vi.fn(() => 'new');
    const view = {
      propertyMetas$: signal([
        { type: 'text', config: { name: 'Text' }, renderer: {} },
        { type: 'number', config: { name: 'Number' }, renderer: {} },
      ]),
      propertyAdd,
    } as unknown as SingleView;
    const onAdd = vi.fn();
    popNewPropertyMenu({} as never, view, { title: 'Type', onAdd });

    expect(popMenu).toHaveBeenCalledOnce();
    // Closing the menu (Escape, click outside) calls no select: nothing
    // was written when it opened.
    expect(propertyAdd).not.toHaveBeenCalled();

    const entries = entriesOf(popMenu.mock.calls[0]);
    expect(entries.map(e => e.name)).toEqual(['Text', 'Number']);
    entries[1]!.select();
    expect(propertyAdd).toHaveBeenCalledWith('end', {
      type: 'number',
      name: 'Number',
    });
    expect(onAdd).toHaveBeenCalledWith('new');
  });
});

describe('the classic table header "+"', () => {
  it('opens the type picker instead of adding a column', () => {
    if (!customElements.get('test-database-column-header')) {
      customElements.define(
        'test-database-column-header',
        DatabaseColumnHeader
      );
    }
    const header = document.createElement(
      'test-database-column-header'
    ) as DatabaseColumnHeader;
    const propertyAdd = vi.fn();
    header.tableViewLogic = {
      view: {
        readonly$: signal(false),
        propertiesLocked$: signal(false),
        propertyMetas$: signal([]),
        properties$: signal([]),
        propertyAdd,
      },
    } as never;

    (
      header as unknown as {
        _onAddColumn: (e: { currentTarget: unknown }) => void;
      }
    )._onAddColumn({ currentTarget: document.createElement('div') });

    expect(popMenu).toHaveBeenCalledOnce();
    expect(propertyAdd).not.toHaveBeenCalled();
  });
});
