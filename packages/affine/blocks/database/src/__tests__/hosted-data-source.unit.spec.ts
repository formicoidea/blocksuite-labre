import type { DatabaseBlockModel } from '@labre/affine-model';
import type { InsertToPosition } from '@labre/affine-shared/utils';
import type { PropertyMetaConfig, TypeInstance } from '@labre/data-view';
import { propertyPresets } from '@labre/data-view/property-presets';
import { computed, signal } from '@preact/signals-core';
import { describe, expect, it, vi } from 'vitest';

import {
  ExternalDataSourceBase,
  HostedDataSourceBase,
  type HostedSource,
  type ResolveHostedSource,
} from '../external-data-source.js';
import { hostedTitleColumnConfig } from '../properties/index.js';

/**
 * `HostedDataSourceBase(hostModel, resolveSource)` (ADR 0035 §7, §9e, §9f;
 * issues B1, B2, B15): the views of a block, each reading the source its
 * stored `sourceId` names.
 *
 * What it would have caught:
 * - a 0.48 host source (`extends ExternalDataSourceBase`, `super(model)`)
 *   no longer compiling or no longer reading its own rows;
 * - a view's `sourceId` being ignored by a source that resolves sources, or
 *   honoured by one that does not (the 0.48 behaviour is one implicit
 *   source, whatever a view says);
 * - an unknown source throwing instead of reading as `sourceMissing$`;
 * - anything written to the host block's views while resolving (nothing is
 *   written on load);
 * - a hosted source drawing a skeleton without saying so (`ready` default);
 * - the title of a document row read through `getCellValue` (hence through
 *   the row's document) when the source answers it from its own store.
 */

type ViewData = { id: string; name: string; mode: string; sourceId?: string };

function hostModel(views: ViewData[]) {
  const views$ = signal(views);
  const write = vi.fn();
  const model = {
    props: {
      views$,
      get views() {
        return views$.value;
      },
      set views(value: ViewData[]) {
        write(value);
      },
    },
  };
  return { model: model as unknown as DatabaseBlockModel, views$, write };
}

function schema(id: string): DatabaseBlockModel {
  return { id } as unknown as DatabaseBlockModel;
}

class FakeHostedSource extends HostedDataSourceBase {
  implicitRows = ['implicit-row'];
  documents = false;
  titles: Record<string, string> = {};
  readonly getCellValueSpy = vi.fn(
    (_rowId: string, _propertyId: string): unknown => 'cell'
  );

  override get rowsAreDocuments(): boolean {
    return this.documents;
  }

  protected override titleOf(rowId: string): string | undefined {
    return this.titles[rowId];
  }

  protected getRows(): string[] {
    return this.implicitRows;
  }
  protected getProperties(): string[] {
    return ['title', 'p1'];
  }
  protected getCellValue(rowId: string, propertyId: string): unknown {
    return this.getCellValueSpy(rowId, propertyId);
  }
  protected getPropertyType(propertyId: string): string | undefined {
    return propertyId === 'title' ? 'title' : 'text';
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
  propertyMetaGet(type: string): PropertyMetaConfig | undefined {
    return type === 'title' && this.rowsAreDocuments
      ? hostedTitleColumnConfig
      : undefined;
  }
  propertyNameSet(): void {}
  propertyTypeSet(): void {}
  protected getNormalPropertyAndIndex() {
    return undefined;
  }
}

/** The 0.48 shape, verbatim: one argument, the old name. Compiles or fails the build. */
class Legacy048Source extends ExternalDataSourceBase {
  constructor(model: DatabaseBlockModel) {
    super(model);
  }
  protected getRows(): string[] {
    return ['legacy-row'];
  }
  protected getProperties(): string[] {
    return [];
  }
  protected getCellValue(): unknown {
    return undefined;
  }
  protected getPropertyType(): string | undefined {
    return undefined;
  }
  protected getPropertyName(): string {
    return '';
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
  cellValueChange(): void {}
  rowAdd(): string {
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

describe('HostedDataSourceBase: sources (B1)', () => {
  it('keeps the 0.48 name and constructor', () => {
    expect(ExternalDataSourceBase).toBe(HostedDataSourceBase);
    const { model } = hostModel([]);
    const legacy = new Legacy048Source(model);
    expect(legacy.rows$.value).toEqual(['legacy-row']);
    expect(legacy.sourceMissing$.value).toBe(false);
    expect(legacy.schema$.value).toBe(model);
  });

  it('without resolveSource, every view reads the block itself', () => {
    const { model } = hostModel([
      { id: 'v1', name: 'Table', mode: 'table', sourceId: 'elsewhere' },
    ]);
    const source = new FakeHostedSource(model);
    expect(source.rows$.value).toEqual(['implicit-row']);
    expect(source.schema$.value).toBe(model);
    expect(source.sourceMissing$.value).toBe(false);
  });

  it('with resolveSource, each view reads the source it names', () => {
    const { model, write } = hostModel([
      { id: 'v1', name: 'Table', mode: 'table', sourceId: 's1' },
      { id: 'v2', name: 'Board', mode: 'kanban', sourceId: 's2' },
      { id: 'v3', name: 'Old', mode: 'table' },
    ]);
    const sources: Record<string, HostedSource> = {
      s1: { schema: schema('schema-1'), rows: signal(['a', 'b']) },
      s2: { schema: schema('schema-2'), rows: signal(['c']) },
    };
    const resolve = vi.fn<ResolveHostedSource>(id =>
      id === undefined ? (sources.s1 ?? null) : (sources[id] ?? null)
    );
    const source = new FakeHostedSource(model, resolve);

    expect(source.currentSourceId$.value).toBe('s1');
    expect(source.rows$.value).toEqual(['a', 'b']);
    expect(source.schema$.value).toBe(sources.s1?.schema);

    source.viewManager.setCurrentView('v2');
    expect(source.rows$.value).toEqual(['c']);
    expect(source.schema$.value).toBe(sources.s2?.schema);

    // A view stored before 0.49 has no sourceId: the host picks.
    source.viewManager.setCurrentView('v3');
    expect(source.rows$.value).toEqual(['a', 'b']);
    expect(resolve).toHaveBeenLastCalledWith(undefined);

    expect(write).not.toHaveBeenCalled();
  });

  it('an unknown source reads as missing, never throws, writes nothing', () => {
    const views = [
      { id: 'v1', name: 'Table', mode: 'table', sourceId: 'gone' },
    ];
    const { model, write, views$ } = hostModel(views);
    const source = new FakeHostedSource(model, () => null);
    expect(source.sourceMissing$.value).toBe(true);
    expect(source.rows$.value).toEqual([]);
    expect(source.schema$.value).toBe(null);
    expect(write).not.toHaveBeenCalled();
    expect(views$.value).toBe(views);
  });

  it('sourceOf resolves any source for the "+ view" menu (B11), writing nothing', () => {
    const { model, write } = hostModel([
      { id: 'v1', name: 'Table', mode: 'table', sourceId: 's1' },
    ]);
    const s2: HostedSource = { schema: schema('schema-2'), rows: signal([]) };
    const hosted = new FakeHostedSource(model, id => (id === 's2' ? s2 : null));
    expect(hosted.resolvesSources).toBe(true);
    expect(hosted.sourceOf('s2')).toBe(s2);
    expect(hosted.sourceOf('gone')).toBe(null);

    const inline = new FakeHostedSource(model);
    expect(inline.resolvesSources).toBe(false);
    expect(inline.sourceOf('s2')?.schema).toBe(model);
    expect(write).not.toHaveBeenCalled();
  });

  it('follows a source whose rows change', () => {
    const rows = signal(['a']);
    const { model } = hostModel([
      { id: 'v1', name: 'Table', mode: 'table', sourceId: 's1' },
    ]);
    const source = new FakeHostedSource(model, () => ({
      schema: schema('schema-1'),
      rows: computed(() => rows.value),
    }));
    expect(source.rows$.value).toEqual(['a']);
    rows.value = ['a', 'b'];
    expect(source.rows$.value).toEqual(['a', 'b']);
  });
});

describe('HostedDataSourceBase: hydration default (B2)', () => {
  it('is ready unless the source says otherwise', () => {
    const { model } = hostModel([]);
    const source = new FakeHostedSource(model);
    expect(source.cellStatus('r1', 'p1')).toBe('ready');
    expect(source.valuesState$.value.status).toBe('ready');
    expect('retryValues' in source).toBe(false);
  });
});

describe('HostedDataSourceBase: document rows and their titles (B15)', () => {
  it('answers a title from the source store, never through the row', () => {
    const { model } = hostModel([]);
    const source = new FakeHostedSource(model);
    source.documents = true;
    source.titles = { r1: 'Roadmap' };

    expect(source.cellValueGet('r1', 'title')).toBe('Roadmap');
    expect(source.getCellValueSpy).not.toHaveBeenCalledWith('r1', 'title');
    expect(source.cellValueGet('r1', 'p1')).toBe('cell');
    expect(source.propertyMetaGet('title')).toBe(hostedTitleColumnConfig);
  });

  it('reads titles through getCellValue when rows are not documents', () => {
    const { model } = hostModel([]);
    const source = new FakeHostedSource(model);
    source.titles = { r1: 'ignored' };
    expect(source.rowsAreDocuments).toBe(false);
    expect(source.cellValueGet('r1', 'title')).toBe('cell');
  });

  it('draws the hosted title with the plain-text cell, as a fixed title', () => {
    expect(hostedTitleColumnConfig.type).toBe('title');
    expect(hostedTitleColumnConfig.config.fixed).toBeDefined();
    expect(hostedTitleColumnConfig.renderer.cellRenderer).toBe(
      propertyPresets.textPropertyConfig.renderer.cellRenderer
    );
    const raw = hostedTitleColumnConfig.config.rawValue;
    expect(
      raw.toJson({ value: 'Roadmap', data: {}, dataSource: {} as never })
    ).toBe('Roadmap');
    expect(
      raw.fromString({ value: 'New', data: {}, dataSource: {} as never }).value
    ).toBe('New');
  });
});
