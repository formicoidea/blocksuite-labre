import type { BlockStdScope } from '@labre/std';
import { beforeEach, describe, expect, test } from 'vitest';

import { EditPropsStore } from '../../services/edit-props-store.js';

const DOC_ID = 'doc-under-test';
const VIEWPORT_KEY = `blocksuite:${DOC_ID}:edgelessViewport`;

/**
 * The store only touches `std.store` (id + readonly) and, lazily, the optional
 * editor setting provider — enough for a storage-level test without a host.
 */
function createStore(readonly = false) {
  const store = { id: DOC_ID, readonly };
  const std = {
    store,
    get: () => undefined,
    getOptional: () => undefined,
  } as unknown as BlockStdScope;
  return { props: new EditPropsStore(std), store };
}

const viewportOf = (zoom: number) => ({ centerX: 10, centerY: 20, zoom });

describe('EditPropsStore.saveViewport', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('an editable mount remembers its viewport', () => {
    const updates: unknown[] = [];
    const { props } = createStore();
    props.slots.storageUpdated.subscribe(update => updates.push(update));

    props.saveViewport(viewportOf(1.5));

    expect(JSON.parse(localStorage.getItem(VIEWPORT_KEY) ?? 'null')).toEqual(
      viewportOf(1.5)
    );
    expect(props.getStorage('viewport')).toEqual(viewportOf(1.5));
    expect(updates).toEqual([{ key: 'viewport', value: viewportOf(1.5) }]);
  });

  test('a read-only mount writes nothing at all', () => {
    const updates: unknown[] = [];
    const { props } = createStore(true);
    props.slots.storageUpdated.subscribe(update => updates.push(update));

    props.saveViewport(viewportOf(0.25));

    expect(localStorage.getItem(VIEWPORT_KEY)).toBeNull();
    expect(updates).toEqual([]);
  });

  test('a read-only preview leaves the full editor viewport intact', () => {
    // The storage key is shared by every mount of the same doc.
    const editor = createStore();
    editor.props.saveViewport(viewportOf(2));

    const preview = createStore(true);
    preview.props.saveViewport(viewportOf(0.1));

    expect(editor.props.getStorage('viewport')).toEqual(viewportOf(2));
  });

  test('readonly is read at save time, not at mount time', () => {
    // Mounted editable, turned read-only before unmounting: nothing is saved.
    const { props, store } = createStore();
    store.readonly = true;
    props.saveViewport(viewportOf(3));
    expect(localStorage.getItem(VIEWPORT_KEY)).toBeNull();

    // And the other way around: a mount that becomes editable does save.
    store.readonly = false;
    props.saveViewport(viewportOf(3));
    expect(props.getStorage('viewport')).toEqual(viewportOf(3));
  });

  test('setStorage stays unguarded for deliberate navigation writes', () => {
    // Surface-ref / frame-panel hand the viewport over before switching mode;
    // only the unmount save is a session artefact.
    const { props } = createStore(true);
    props.setStorage('viewport', viewportOf(4));
    expect(props.getStorage('viewport')).toEqual(viewportOf(4));
  });
});
