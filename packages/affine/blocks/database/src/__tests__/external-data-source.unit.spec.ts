import type {
  PropertyMetaConfig,
  TypeInstance,
} from '@labre/data-view';
import type { InsertToPosition } from '@labre/affine-shared/utils';
import { describe, expect, it, vi } from 'vitest';

import { ExternalDataSourceBase } from '../external-data-source.js';

/**
 * Minimal host-style source over an in-memory object. It reads raw data (no
 * blocksuite signals), so its data-layer computeds only refresh when it calls
 * {@link invalidate} — exactly the contract a real host observer drives.
 */
class FakeExternalSource extends ExternalDataSourceBase {
  data = {
    rows: ['r1'],
    props: ['c1'],
    cells: { r1: { c1: 'a' as unknown } } as Record<
      string,
      Record<string, unknown>
    >,
  };

  constructor() {
    // The view surface (which would read the model) is never touched by these
    // tests, so a stub model is enough — ViewManagerBase's computeds are lazy.
    super({} as never);
  }

  bump() {
    this.invalidate();
  }

  registerDisposable(fn: () => void) {
    this.disposables.add(fn);
  }

  protected getRows(): string[] {
    return this.data.rows;
  }
  protected getProperties(): string[] {
    return this.data.props;
  }
  protected getCellValue(rowId: string, propertyId: string): unknown {
    return this.data.cells[rowId]?.[propertyId];
  }
  protected getPropertyType(): string | undefined {
    return 'rich-text';
  }
  protected getPropertyName(): string {
    return 'name';
  }
  protected getPropertyData(): Record<string, unknown> {
    return {};
  }
  protected getPropertyDataType(): TypeInstance | undefined {
    return undefined;
  }
  protected getPropertyMetas(): PropertyMetaConfig[] {
    return [];
  }

  // unused mutations / lookups for these tests
  cellValueChange(): void {}
  rowAdd(_pos: InsertToPosition | number): string {
    return '';
  }
  rowDelete(): void {}
  rowMove(): void {}
  propertyAdd(): string | undefined {
    return undefined;
  }
  propertyDelete(): void {}
  propertyDuplicate(): string | undefined {
    return undefined;
  }
  propertyDataSet(): void {}
  propertyMetaGet(): PropertyMetaConfig | undefined {
    return undefined;
  }
  propertyNameSet(): void {}
  propertyTypeSet(): void {}
  protected getNormalPropertyAndIndex() {
    return undefined;
  }
}

describe('ExternalDataSourceBase reactive bridge', () => {
  it('data-layer computeds refresh only after invalidate()', () => {
    const src = new FakeExternalSource();
    const cell$ = src.cellValueGet$('r1', 'c1'); // base wrapper, revision-tracked

    expect(src.rows$.value).toEqual(['r1']);
    expect(cell$.value).toBe('a');

    // mutate the underlying data WITHOUT notifying → reads stay cached
    src.data.rows = ['r1', 'r2'];
    src.data.cells.r1.c1 = 'b';
    expect(src.rows$.value).toEqual(['r1']);
    expect(cell$.value).toBe('a');

    // notify → computeds re-run
    src.bump();
    expect(src.rows$.value).toEqual(['r1', 'r2']);
    expect(cell$.value).toBe('b');
  });

  it('dispose() runs the disposable group', () => {
    const src = new FakeExternalSource();
    const teardown = vi.fn();
    src.registerDisposable(teardown);

    src.dispose();
    expect(teardown).toHaveBeenCalledTimes(1);
  });
});
