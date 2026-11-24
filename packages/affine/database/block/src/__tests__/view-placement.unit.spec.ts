/**
 * GUARD — the host confirms the placement of a view of one of its existing
 * sources before it is written (`DataSourcePickerService.placeView`, issue
 * #701, ADR 0035 amendment of 2026-11-22).
 *
 * What it would have caught:
 * - a host seam that sees the view only after it landed (the request built
 *   after `placeNow`), so a cancel could not prevent the write;
 * - a request the host never answers still writing the view;
 * - `place()` writing twice, or writing on a page that turned read-only
 *   while the host was asking, or for a block a peer deleted meanwhile;
 * - without the seam (or for a block that is not a host database, `ref`
 *   `null`), the gesture no longer placing the view at once, as in 4.1.
 */
import type { DataSourcePickerService } from '@labre/affine-shared/services';
import type { Store } from '@labre/store';
import { signal } from '@preact/signals-core';
import { describe, expect, test, vi } from 'vitest';

import {
  placeViewThroughHost,
  type ViewPlacementRef,
} from '../view-placement.js';

const REF: ViewPlacementRef = {
  gesture: 'add-view',
  databaseId: 'db-plan',
  sourceId: 's-2',
  docId: 'doc-1',
  blockId: 'block-1',
};

const store = (readonly = false, blocks = ['block-1']) =>
  ({
    readonly,
    getModelById: (id: string) => (blocks.includes(id) ? { id } : null),
  }) as unknown as Store;
const picker = (
  placeView?: DataSourcePickerService['placeView']
): DataSourcePickerService => ({ list: () => signal([]), placeView });

describe('placeViewThroughHost', () => {
  test('without the seam, the view is placed at once', () => {
    const placeNow = vi.fn(() => true);
    placeViewThroughHost({
      picker: picker(),
      store: store(),
      ref: REF,
      placeNow,
    });
    expect(placeNow).toHaveBeenCalledOnce();

    const again = vi.fn(() => true);
    placeViewThroughHost({
      picker: null,
      store: store(),
      ref: REF,
      placeNow: again,
    });
    expect(again).toHaveBeenCalledOnce();
  });

  test('not a host database (ref null): placed at once, the host is not asked', () => {
    const placeView = vi.fn();
    const placeNow = vi.fn(() => true);
    placeViewThroughHost({
      picker: picker(placeView),
      store: store(),
      ref: null,
      placeNow,
    });
    expect(placeView).not.toHaveBeenCalled();
    expect(placeNow).toHaveBeenCalledOnce();
  });

  test('the host is asked first; nothing is written until it places', () => {
    const placeView = vi.fn();
    const placeNow = vi.fn(() => true);
    placeViewThroughHost({
      picker: picker(placeView),
      store: store(),
      ref: REF,
      placeNow,
    });
    expect(placeView).toHaveBeenCalledOnce();
    expect(placeView.mock.calls[0]![0]).toMatchObject(REF);
    expect(placeNow).not.toHaveBeenCalled();

    const { place } = placeView.mock.calls[0]![0];
    expect(place()).toBe(true);
    expect(placeNow).toHaveBeenCalledOnce();
    expect(place()).toBe(false);
    expect(placeNow).toHaveBeenCalledOnce();
  });

  test('place() answers what placeNow wrote', () => {
    const placeView = vi.fn();
    placeViewThroughHost({
      picker: picker(placeView),
      store: store(),
      ref: REF,
      placeNow: () => false,
    });
    expect(placeView.mock.calls[0]![0].place()).toBe(false);
  });

  test('a page turned read-only while the host asked writes nothing', () => {
    const placeView = vi.fn();
    const placeNow = vi.fn(() => true);
    const page = {
      readonly: false,
      getModelById: () => ({}),
    } as { readonly: boolean };
    placeViewThroughHost({
      picker: picker(placeView),
      store: page as Store,
      ref: REF,
      placeNow,
    });
    page.readonly = true;
    expect(placeView.mock.calls[0]![0].place()).toBe(false);
    expect(placeNow).not.toHaveBeenCalled();
  });

  test('a block deleted while the host asked takes no view', () => {
    const placeView = vi.fn();
    const placeNow = vi.fn(() => true);
    placeViewThroughHost({
      picker: picker(placeView),
      store: store(false, []),
      ref: REF,
      placeNow,
    });
    expect(placeView.mock.calls[0]![0].place()).toBe(false);
    expect(placeNow).not.toHaveBeenCalled();
  });
});
