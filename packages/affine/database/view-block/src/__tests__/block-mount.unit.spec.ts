/**
 * GUARD — the `affine:data-view` block element can be constructed at all.
 *
 * The editor host renders a block by writing its tag (`BlockViewExtension`,
 * `affine-data-view`), so the element is constructed BEFORE it is connected
 * and before the `std` context reaches it. The component built its
 * `DataViewRootUILogic` in a class field, and that literal reads
 * `this.dataSource` (hence `this.host`, i.e. `this.std.host`) and
 * `this.std.clipboard`: the constructor threw "Cannot read properties of
 * undefined (reading 'host')" and the element never upgraded. The database
 * block already builds the same logic lazily, on first render
 * (`database-block.ts`, `dataViewRootLogic` getter); the data-view block now
 * does too.
 *
 * What it would have caught: the constructor reading anything that only
 * exists once the block is connected (the std, the host, the model).
 *
 * What it does NOT hold: the block's first render. `BlockQueryDataSource` was
 * never ported to the signal-based engine (the `ponytail:` line on it), so
 * the render still throws; a spec mounting the block in an editor waits on
 * that decision.
 */
import { describe, expect, test } from 'vitest';

import { DataViewRenderViewExtension } from '../view.js';

describe('the data-view block element', () => {
  test('is constructed before it has a std, as the host renders it', () => {
    // The always-on provider, the one every editor mounts (ADR 0009, ADR 0035
    // amendment of 2026-10-14): its `effect()` defines the element.
    new DataViewRenderViewExtension().effect();
    expect(customElements.get('affine-data-view')).toBeDefined();

    expect(() => document.createElement('affine-data-view')).not.toThrow();
  });
});
