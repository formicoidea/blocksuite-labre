import {
  EdgelessCRUDIdentifier,
  SurfaceBlockSchemaExtension,
} from '@labre/affine-block-surface';
import { effects as contextMenuEffects } from '@labre/affine-components/context-menu';
import { effects as datePickerEffects } from '@labre/affine-components/date-picker';
import { effects as portalEffects } from '@labre/affine-components/portal';
import { RefNodeSlotsProvider } from '@labre/affine-inline-reference';
import {
  EmbedLinkedDocBlockSchemaExtension,
  NoteBlockSchemaExtension,
  NoteDisplayMode,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import {
  PropertiesPanelProvider,
  type PropertiesPanelService,
  TelemetryProvider,
  type TitleBandProperty,
  TitleBandProvider,
  type TitleBandService,
  type TitleBandSheetState,
} from '@labre/affine-shared/services';
import {
  BaseCellRenderer,
  createFromBaseCellRenderer,
  type MultiTagSelect,
  type PropertyMetaConfig,
  type StandaloneCellHost,
} from '@labre/data-view';
import { effects as dataViewEffects } from '@labre/data-view/effects';
import { propertyPresets } from '@labre/data-view/property-presets';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { html } from 'lit';
import { Subject } from 'rxjs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { showPageHere } from '../title-band/show-here';
import { LABRE_TITLE_BAND, TitleBand } from '../title-band/title-band';

/**
 * The title band under the page title and in the note header (ADR 0035 §9d,
 * §11; REQ-PR-1, PR-4, PR-7).
 *
 * What it pins, each a promise of the seams table:
 * - **no provider, nothing**: no band, no "+", no panel button, no row, in
 *   both views, which is the whole degraded story of `TitleBandExtension`;
 * - the chips follow the host's visible list, an empty one included and
 *   still clickable (REQ-PR-1);
 * - each value is drawn AND edited by the cell the inline table mounts for
 *   its type (ADR 0035 §11 amended 2026-10-13: the checkbox, the tag menu of
 *   a select, the date picker, the number and text inputs), a link by the
 *   cell a package above registers, a type with no cell by its text;
 * - the tag menu offers the host's options and creates none, unless the host
 *   takes a definition write (`setData`) for that property (`dataWritable`):
 *   then it creates and renames options through `setData`, never deletes,
 *   recolours or reorders one (product owner, 2026-10-14);
 * - a write goes to `set` and the chip shows pending until it settles; the
 *   band never applies the value itself, the host's `sheetimport {
  EdgelessCRUDIdentifier,
  SurfaceBlockSchemaExtension,
} from '@labre/affine-block-surface';
import { effects as datePickerEffects } from '@labre/affine-components/date-picker';
import { effects as portalEffects } from '@labre/affine-components/portal';
import { RefNodeSlotsProvider } from '@labre/affine-inline-reference';
import {
  EmbedLinkedDocBlockSchemaExtension,
  NoteBlockSchemaExtension,
  NoteDisplayMode,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import {
  PropertiesPanelProvider,
  type PropertiesPanelService,
  TelemetryProvider,
  type TitleBandProperty,
  TitleBandProvider,
  type TitleBandService,
  type TitleBandSheetState,
} from '@labre/affine-shared/services';
import {
  BaseCellRenderer,
  createFromBaseCellRenderer,
  type MultiTagSelect,
  type PropertyMetaConfig,
  type StandaloneCellHost,
} from '@labre/data-view';
import { effects as dataViewEffects } from '@labre/data-view/effects';
import { propertyPresets } from '@labre/data-view/property-presets';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { html } from 'lit';
import { Subject } from 'rxjs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { showPageHere } from '../title-band/show-here';
import { LABRE_TITLE_BAND, TitleBand } from '../title-band/title-band';

/**
 * The title band under the page title and in the note header (ADR 0035 §9d,
 * §11; REQ-PR-1, PR-4, PR-7).
 *
 * What it pins, each a promise of the seams table:
 * - **no provider, nothing**: no band, no "+", no panel button, no row, in
 *   both views, which is the whole degraded story of `TitleBandExtension`;
 does, and a
 *   value left as it was is never written;
 * - the "+" exists only with `add`, the panel button only with a
 *   `PropertiesPanelProvider`, and the panel opens with a page request;
 * - the "Not shown on this page" row is drawn in both views (ADR 0035
 *   §9d, amended 2026-10-13: the page view's row was the host's until then),
 *   only with a linked-document path to open its links through;
 * - its "Show here" writes one `affine:embed-linked-doc` card of the page,
 *   at the end of the last note in the page view and at the centre of the
 *   visible canvas through the layer-stamping CRUD path on the canvas, as one
 *   undo step, and nothing at all on a read-only document (labre ADR-0045 §7).
 */

/** Stands for the database block's link cell, which this package cannot import. */
class FakeLinkCell extends BaseCellRenderer<string> {
  override render() {
    return html`<a data-testid="fake-link">${this.value ?? ''}</a>`;
  }
}

const FAKE_LINK_META = {
  ...propertyPresets.textPropertyConfig,
  type: 'link',
  renderer: {
    type: 'link',
    cellRenderer: { view: createFromBaseCellRenderer(FakeLinkCell) },
  },
} as unknown as PropertyMetaConfig;

beforeAll(() => {
  if (!customElements.get(LABRE_TITLE_BAND)) {
    customElements.define(LABRE_TITLE_BAND, TitleBand);
  }
  if (!customElements.get('uni-lit')) dataViewEffects();
  if (!customElements.get('affine-menu')) contextMenuEffects();
  if (!customElements.get('date-picker')) datePickerEffects();
  if (!customElements.get('blocksuite-portal')) portalEffects();
  if (!customElements.get('test-fake-link-cell')) {
    customElements.define('test-fake-link-cell', FakeLinkCell);
  }
});

afterEach(() => {
  document.body.innerHTML = '';
});

const DOC = 'doc-1';

function prop(over: Partial<TitleBandProperty>): TitleBandProperty {
  return {
    id: 'p',
    namespace: 'workspace',
    name: 'Prop',
    type: 'text',
    data: {},
    value: null,
    readonly: false,
    ...over,
  };
}

const STATUS = prop({
  id: 'status',
  name: 'Status',
  type: 'select',
  data: {
    options: [
      { id: 'a', value: 'Doing', color: 'var(--affine-tag-blue)' },
      { id: 'b', value: 'Done', color: 'var(--affine-tag-green)' },
    ],
  },
  value: 'a',
});
const OWNER = prop({ id: 'owner', name: 'Owner', type: 'text', value: null });
const DONE = prop({ id: 'done', name: 'Done', type: 'checkbox', value: false });
const CHECKED = prop({
  id: 'checked',
  name: 'Reviewed',
  type: 'checkbox',
  value: true,
});
const TAGS = prop({
  id: 'tags',
  name: 'Tags',
  type: 'multi-select',
  data: {
    options: [
      { id: 'x', value: 'Strategy', color: 'var(--affine-tag-purple)' },
      { id: 'y', value: 'Q4' },
    ],
  },
  value: ['x', 'y'],
});
const DUE = prop({
  id: 'due',
  name: 'Due',
  type: 'date',
  value: new Date(2026, 9, 13).getTime(),
});
const BUDGET = prop({
  id: 'budget',
  name: 'Budget',
  type: 'number',
  data: { format: 'currencyEUR', decimal: 2 },
  value: 1234.5,
});
const PROGRESS = prop({
  id: 'progress',
  name: 'Progress',
  type: 'progress',
  value: 40,
});
const SITE = prop({
  id: 'site',
  name: 'Site',
  type: 'url',
  value: 'https://labre.app',
});
const LINKS = prop({
  id: 'links',
  name: 'Links',
  type: 'relation',
  value: ['Child A', 'Child B'],
});

/** A scope whose `getOptional` answers from `providers`, read live. */
function fakeStd(
  providers: Map<unknown, unknown>,
  readonly = false
): { std: BlockStdScope } {
  const readonly$ = signal(readonly);
  const std = {
    host: {},
    store: {
      id: DOC,
      readonly$,
      get readonly() {
        return readonly$.value;
      },
    },
    // A keyed identifier is a new object per call: read it by name.
    getOptional: (id: unknown) => {
      const { identifierName, variant } = (id ?? {}) as {
        identifierName?: string;
        variant?: string;
      };
      return (
        providers.get(id) ??
        providers.get(`${identifierName}:${variant}`) ??
        null
      );
    },
  } as unknown as BlockStdScope;
  return { std };
}

function bandService(
  sheet: TitleBandSheetState,
  extra: Partial<TitleBandService> = {}
) {
  const sheet$ = signal<TitleBandSheetState>(sheet);
  const service: TitleBandService = {
    sheet$: vi.fn(() => sheet$),
    set: vi.fn(async () => {}),
    ...extra,
  };
  return { service, sheet$ };
}

async function mount(
  std: BlockStdScope,
  surface: 'page' | 'canvas' = 'page'
): Promise<TitleBand> {
  const band = document.createElement(LABRE_TITLE_BAND);
  band.std = std;
  band.docId = DOC;
  band.surface = surface;
  document.body.append(band);
  await band.updateComplete;
  return band;
}

const q = (band: Element, testId: string) =>
  band.querySelector(`[data-testid="${testId}"]`);
const frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

const chipOf = (band: Element, id: string) =>
  band.querySelector<HTMLElement>(
    `[data-testid="title-band-chip"][data-property-id="${id}"]`
  )!;

const cellOf = (chip: Element) =>
  chip.querySelector<StandaloneCellHost>('dv-standalone-cell')!;

/** The cells render after the band, each in its own update. */
async function settleCells(band: Element) {
  await (band as TitleBand).updateComplete;
  for (const host of band.querySelectorAll<StandaloneCellHost>(
    'dv-standalone-cell'
  )) {
    await host.updateComplete;
  }
  await frame();
}

/** An option row of the tag menu, by its label. */
const optionNamed = (menu: MultiTagSelect, name: string) =>
  [
    ...menu.querySelectorAll<HTMLElement>(
      '[data-testid="tag-option-list"] > div'
    ),
  ].find(row => row.textContent?.includes(name))!;

/** Opens the cell's input, types `text`, presses Enter, lets it commit. */
async function typeInto(host: StandaloneCellHost, text: string) {
  host.click();
  await host.updateComplete;
  await frame();
  const input = host.querySelector('input')!;
  input.value = text;
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
  );
  await new Promise(resolve => setTimeout(resolve, 0));
  await frame();
  await frame();
}

const all = (band: Element, testId: string) => [
  ...band.querySelectorAll(`[data-testid="${testId}"]`),
];

describe('the title band', () => {
  it('draws nothing at all without a provider, in both views', async () => {
    const panel: PropertiesPanelService = { open: vi.fn(), close: vi.fn() };
    const { std } = fakeStd(new Map([[PropertiesPanelProvider, panel]]));
    for (const surface of ['page', 'canvas'] as const) {
      const band = await mount(std, surface);
      expect(q(band, 'title-band'), surface).toBeNull();
      expect(band.querySelector('button'), surface).toBeNull();
    }
  });

  it('draws nothing for a missing or failed sheet', async () => {
    for (const sheet of [
      { status: 'missing' },
      { status: 'error', reason: 'x' },
    ] satisfies TitleBandSheetState[]) {
      const { service } = bandService(sheet, { add: vi.fn() });
      const { std } = fakeStd(new Map([[TitleBandProvider, service]]));
      const band = await mount(std);
      expect(q(band, 'title-band'), sheet.status).toBeNull();
    }
  });

  it('shows a skeleton while the sheet loads', async () => {
    const { service } = bandService({ status: 'loading' });
    const { std } = fakeStd(new Map([[TitleBandProvider, service]]));
    const band = await mount(std);
    expect(q(band, 'title-band-loading')?.getAttribute('aria-busy')).toBe(
      'true'
    );
  });

  it('draws one chip per visible property, in order, an empty one included', async () => {
    const { service } = bandService({
      status: 'ready',
      properties: [STATUS, OWNER, DONE],
    });
    const { std } = fakeStd(new Map([[TitleBandProvider, service]]));
    const band = await mount(std);
    await settleCells(band);

    const chips = all(band, 'title-band-chip') as HTMLElement[];
    expect(chips.map(chip => chip.dataset.propertyId)).toEqual([
      'status',
      'owner',
      'done',
    ]);
    expect(chips[0].textContent).toContain('Doing');
    expect(chips[1].dataset.empty).toBe('true');
    expect(chips[1].textContent).toContain('Not set');
    // Empty, and still a live editor (REQ-PR-1).
    expect(cellOf(chips[1]).readonly).toBe(false);
    expect(cellOf(chips[1]).getAttribute('tabindex')).toBe('0');
    // Asked once, however often the band renders.
    band.requestUpdate();
    await band.updateComplete;
    expect(service.sheet$).toHaveBeenCalledTimes(1);
  });

  it('draws each value with the cell the inline table mounts for its type', async () => {
    const { service } = bandService({
      status: 'ready',
      properties: [
        STATUS,
        TAGS,
        CHECKED,
        DUE,
        BUDGET,
        PROGRESS,
        OWNER,
        SITE,
        LINKS,
      ],
    });
    const { std } = fakeStd(new Map([[TitleBandProvider, service]]));
    const band = await mount(std);
    await settleCells(band);

    const cellTag = (id: string) =>
      chipOf(band, id).querySelector('dv-standalone-cell uni-lit > *')
        ?.localName;
    expect(cellTag('status')).toBe('affine-database-select-cell');
    expect(cellTag('tags')).toBe('affine-database-multi-select-cell');
    expect(cellTag('checked')).toBe('affine-database-checkbox-cell');
    expect(cellTag('due')).toBe('affine-database-date-cell');
    expect(cellTag('budget')).toBe('affine-database-number-cell');
    expect(cellTag('progress')).toBe('affine-database-progress-cell');
    expect(cellTag('owner')).toBe('affine-database-text-cell');
    // No link cell registered: the URL is the text cell's.
    expect(cellTag('site')).toBe('affine-database-text-cell');

    expect(chipOf(band, 'status').textContent).toContain('Doing');
    expect(chipOf(band, 'tags').textContent).toContain('Strategy');
    expect(chipOf(band, 'tags').textContent).toContain('Q4');
    expect(
      chipOf(band, 'checked').querySelector('.affine-database-checkbox.checked')
    ).not.toBeNull();
    expect(chipOf(band, 'due').textContent).toContain('2026/10/13');
    // The table's own reading: unformatted while its flag is off.
    expect(chipOf(band, 'budget').textContent).toContain('1234.5');
    expect(chipOf(band, 'site').textContent).toContain('https://labre.app');
    // A type no cell draws keeps its text and has no cell.
    expect(
      chipOf(band, 'links').querySelector('dv-standalone-cell')
    ).toBeNull();
    expect(chipOf(band, 'links').textContent).toContain('Child A, Child B');
  });

  it('draws a type a package above registers with its cell (the link)', async () => {
    const { service } = bandService({ status: 'ready', properties: [SITE] });
    const providers = new Map<unknown, unknown>([
      [TitleBandProvider, service],
      ['DataViewStandaloneCellMeta:link', FAKE_LINK_META],
    ]);
    const band = await mount(fakeStd(providers).std);
    await settleCells(band);
    const link = chipOf(band, 'site').querySelector(
      '[data-testid="fake-link"]'
    );
    expect(link?.textContent).toBe('https://labre.app');
  });

  it('toggles a checkbox through its cell, pending until the host settles', async () => {
    let settle = () => {};
    const { service, sheet$ } = bandService(
      { status: 'ready', properties: [DONE] },
      {
        set: vi.fn(
          () =>
            new Promise<void>(resolve => {
              settle = resolve;
            })
        ),
      }
    );
    const { std } = fakeStd(new Map([[TitleBandProvider, service]]));
    const band = await mount(std);
    const chip = () => chipOf(band, 'done');
    await settleCells(band);

    cellOf(chip()).click();
    await band.updateComplete;

    expect(service.set).toHaveBeenCalledWith(DOC, 'done', true);
    expect(chip().getAttribute('aria-busy')).toBe('true');
    // Still unchecked: the value is the host's to apply.
    expect(
      chip().querySelector('.affine-database-checkbox.checked')
    ).toBeNull();
    expect(sheet$.value).toEqual({ status: 'ready', properties: [DONE] });

    settle();
    await Promise.resolve();
    await Promise.resolve();
    await band.updateComplete;
    expect(chip().getAttribute('aria-busy')).toBe('false');

    // The host applies it: the same cell now draws it checked.
    sheet$.value = { status: 'ready', properties: [{ ...DONE, value: true }] };
    await settleCells(band);
    expect(
      chip().querySelector('.affine-database-checkbox.checked')
    ).not.toBeNull();
  });

  it('clears the pending state when the host refuses a write', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { service } = bandService(
      { status: 'ready', properties: [DONE] },
      { set: vi.fn(() => Promise.reject(new Error('refused'))) }
    );
    const { std } = fakeStd(new Map([[TitleBandProvider, service]]));
    const band = await mount(std);
    await settleCells(band);

    cellOf(chipOf(band, 'done')).click();
    await new Promise(resolve => setTimeout(resolve, 0));
    await band.updateComplete;
    expect(chipOf(band, 'done').getAttribute('aria-busy')).toBe('false');
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("picks a select option in the table's tag menu, its options fixed", async () => {
    const { service } = bandService({ status: 'ready', properties: [STATUS] });
    const band = await mount(
      fakeStd(new Map([[TitleBandProvider, service]])).std
    );
    // A click anywhere on the chip, its name included, opens the cell.
    chipOf(band, 'status')
      .querySelector<HTMLElement>('.labre-title-band-chip-name')!
      .click();
    await frame();
    const menu = document.querySelector('affine-multi-tag-select');
    expect(menu).not.toBeNull();
    // The band cannot write the property's options: no create, no edit.
    expect(menu!.onOptionsChange).toBeUndefined();
    expect(menu!.querySelector('[data-testid="option-more"]')).toBeNull();
    optionNamed(menu!, 'Done').click();
    expect(service.set).toHaveBeenCalledWith(DOC, 'status', 'b');
  });

  it('creates an option through setData, then selects it through set', async () => {
    const setData = vi.fn(async () => {});
    const { service } = bandService(
      { status: 'ready', properties: [{ ...STATUS, dataWritable: true }] },
      { setData }
    );
    const band = await mount(
      fakeStd(new Map([[TitleBandProvider, service]])).std
    );
    cellOf(chipOf(band, 'status')).click();
    await frame();
    const menu = document.querySelector('affine-multi-tag-select')!;
    expect(menu.onOptionsChange).toBeDefined();
    expect(menu.optionEdits).toBe('create-rename');
    const input = menu.querySelector('input')!;
    input.value = 'Blocked';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await menu.updateComplete;
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );

    expect(setData).toHaveBeenCalledTimes(1);
    const [docId, propertyId, data] = setData.mock.calls[0] as unknown as [
      string,
      string,
      { options: { id: string; value: string }[] },
    ];
    expect([docId, propertyId]).toEqual([DOC, 'status']);
    const created = data.options[0]!;
    expect(created.value).toBe('Blocked');
    expect(data.options.slice(1).map(o => o.id)).toEqual(['a', 'b']);
    // The definition write comes first, then the value write that selects it.
    expect(service.set).toHaveBeenCalledWith(DOC, 'status', created.id);
  });

  it('renames an option, and offers no delete, colour or reordering', async () => {
    const setData = vi.fn(async () => {});
    const { service } = bandService(
      { status: 'ready', properties: [{ ...STATUS, dataWritable: true }] },
      { setData }
    );
    const band = await mount(
      fakeStd(new Map([[TitleBandProvider, service]])).std
    );
    cellOf(chipOf(band, 'status')).click();
    await frame();
    const menu = document.querySelector('affine-multi-tag-select')!;
    optionNamed(menu, 'Doing')
      .querySelector<HTMLElement>('[data-testid="option-more"]')!
      .click();
    await frame();
    const optionMenu = [...document.querySelectorAll('affine-menu')].at(-1)!;
    const field = optionMenu.querySelector('affine-menu-input')!;
    await (field as unknown as { updateComplete: Promise<unknown> })
      .updateComplete;
    expect(optionMenu.textContent).not.toContain('Delete');
    expect(optionMenu.querySelectorAll('affine-menu-button')).toHaveLength(0);
    const rename = (field.shadowRoot ?? field).querySelector('input')!;
    rename.value = 'In progress';
    rename.dispatchEvent(new InputEvent('input', { bubbles: true }));

    expect(setData).toHaveBeenLastCalledWith(DOC, 'status', {
      options: [
        { id: 'a', value: 'In progress', color: 'var(--affine-tag-blue)' },
        { id: 'b', value: 'Done', color: 'var(--affine-tag-green)' },
      ],
    });
    expect(service.set).not.toHaveBeenCalled();
  });

  it('keeps the options fixed without setData, dataWritable or a writable chip', async () => {
    const setData = vi.fn(async () => {});
    const cases: [Partial<TitleBandService>, TitleBandProperty, boolean][] = [
      [{}, { ...STATUS, dataWritable: true }, false],
      [{ setData }, STATUS, false],
      [{ setData }, { ...STATUS, dataWritable: true, readonly: true }, false],
      [{ setData }, { ...STATUS, dataWritable: true }, true],
    ];
    for (const [extra, property, writable] of cases) {
      const { service } = bandService(
        { status: 'ready', properties: [property] },
        extra
      );
      const band = await mount(
        fakeStd(new Map([[TitleBandProvider, service]])).std
      );
      expect(cellOf(chipOf(band, 'status')).cell.property.dataCanSet).toBe(
        writable
      );
      document.body.innerHTML = '';
    }
  });

  it("adds a tag through the table's multi-select menu", async () => {
    const { service } = bandService({
      status: 'ready',
      properties: [{ ...TAGS, value: ['x'] }],
    });
    const band = await mount(
      fakeStd(new Map([[TitleBandProvider, service]])).std
    );
    cellOf(chipOf(band, 'tags')).click();
    await frame();
    const menu = document.querySelector('affine-multi-tag-select');
    optionNamed(menu!, 'Q4').click();
    expect(service.set).toHaveBeenCalledWith(DOC, 'tags', ['x', 'y']);
  });

  it("sets a date through the table's date picker", async () => {
    const { service } = bandService({
      status: 'ready',
      properties: [{ ...DUE, value: null }],
    });
    const band = await mount(
      fakeStd(new Map([[TitleBandProvider, service]])).std
    );
    const host = cellOf(chipOf(band, 'due'));
    host.click();
    await frame();
    const cell = host.querySelector('affine-database-date-cell') as unknown as {
      tempValue$: { value: Date | undefined };
    };
    const picked = new Date(Date.UTC(2026, 11, 24));
    cell.tempValue$.value = picked;
    // What a click away does: the picker closes and the cell commits.
    host.exit();
    await frame();
    await frame();
    expect(service.set).toHaveBeenCalledTimes(1);
    expect(service.set).toHaveBeenCalledWith(DOC, 'due', picked.getTime());
  });

  it("types a number and a text in the table's inputs", async () => {
    const { service } = bandService({
      status: 'ready',
      properties: [BUDGET, OWNER],
    });
    const band = await mount(
      fakeStd(new Map([[TitleBandProvider, service]])).std
    );

    await typeInto(cellOf(chipOf(band, 'budget')), '42');
    expect(service.set).toHaveBeenCalledWith(DOC, 'budget', 42);

    await typeInto(cellOf(chipOf(band, 'owner')), 'Ada');
    expect(service.set).toHaveBeenCalledWith(DOC, 'owner', 'Ada');
    expect(service.set).toHaveBeenCalledTimes(2);
  });

  it('writes nothing for a value left as it was', async () => {
    const { service } = bandService({ status: 'ready', properties: [OWNER] });
    const band = await mount(
      fakeStd(new Map([[TitleBandProvider, service]])).std
    );
    await typeInto(cellOf(chipOf(band, 'owner')), '   ');
    expect(service.set).not.toHaveBeenCalled();
  });

  it('draws every cell and opens none on a read-only document', async () => {
    const add = vi.fn();
    const { service } = bandService(
      { status: 'ready', properties: [DONE, OWNER] },
      { add }
    );
    const { std } = fakeStd(new Map([[TitleBandProvider, service]]), true);
    const band = await mount(std);

    const host = cellOf(chipOf(band, 'done'));
    expect(host.readonly).toBe(true);
    expect(host.hasAttribute('tabindex')).toBe(false);
    expect(host.querySelector('affine-database-checkbox-cell')).not.toBeNull();
    host.click();
    chipOf(band, 'done').click();
    expect(service.set).not.toHaveBeenCalled();
    expect(q(band, 'title-band-add')).toBeNull();
  });

  it('opens the panel from a read-only property or a type with no cell', async () => {
    const panel: PropertiesPanelService = { open: vi.fn(), close: vi.fn() };
    const { service } = bandService({
      status: 'ready',
      properties: [{ ...OWNER, value: 'Ada', readonly: true }, LINKS],
    });
    const band = await mount(
      fakeStd(
        new Map<unknown, unknown>([
          [TitleBandProvider, service],
          [PropertiesPanelProvider, panel],
        ])
      ).std
    );
    cellOf(chipOf(band, 'owner')).click();
    expect(panel.open).toHaveBeenCalledWith({ scope: 'page', docId: DOC });
    const links = chipOf(band, 'links');
    expect(links.getAttribute('tabindex')).toBe('0');
    links.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(panel.open).toHaveBeenCalledTimes(2);
    expect(service.set).not.toHaveBeenCalled();
  });

  it('draws the "+" only with add, the panel button only with a panel', async () => {
    const { service: bare } = bandService({
      status: 'ready',
      properties: [OWNER],
    });
    const plain = await mount(
      fakeStd(new Map([[TitleBandProvider, bare]])).std
    );
    expect(q(plain, 'title-band-add')).toBeNull();
    expect(q(plain, 'title-band-open-panel')).toBeNull();

    const add = vi.fn();
    const panel: PropertiesPanelService = { open: vi.fn(), close: vi.fn() };
    const { service } = bandService(
      { status: 'ready', properties: [OWNER] },
      { add }
    );
    const band = await mount(
      fakeStd(
        new Map<unknown, unknown>([
          [TitleBandProvider, service],
          [PropertiesPanelProvider, panel],
        ])
      ).std
    );
    (q(band, 'title-band-add') as HTMLButtonElement).click();
    expect(add).toHaveBeenCalledWith(DOC);
    (q(band, 'title-band-open-panel') as HTMLButtonElement).click();
    expect(panel.open).toHaveBeenCalledWith({ scope: 'page', docId: DOC });
  });

  it('collapses, remembered by the host when it can, locally otherwise', async () => {
    const { service } = bandService({
      status: 'ready',
      properties: [STATUS, OWNER],
    });
    const local = await mount(
      fakeStd(new Map([[TitleBandProvider, service]])).std
    );
    (q(local, 'title-band-collapse') as HTMLButtonElement).click();
    await local.updateComplete;
    expect(all(local, 'title-band-chip')).toHaveLength(0);
    expect(q(local, 'title-band-expand')?.textContent).toContain(
      'Properties (2)'
    );

    const collapsed$ = signal(true);
    const setCollapsed = vi.fn((_: string, v: boolean) => {
      collapsed$.value = v;
    });
    const { service: remembered } = bandService(
      { status: 'ready', properties: [STATUS] },
      { collapsed$: () => collapsed$, setCollapsed }
    );
    const band = await mount(
      fakeStd(new Map([[TitleBandProvider, remembered]])).std
    );
    expect(all(band, 'title-band-chip')).toHaveLength(0);
    (q(band, 'title-band-expand') as HTMLButtonElement).click();
    await band.updateComplete;
    expect(setCollapsed).toHaveBeenCalledWith(DOC, false);
    expect(all(band, 'title-band-chip')).toHaveLength(1);
  });

  it('draws "Not shown on this page" in both views', async () => {
    const notShown$ = signal([
      { docId: 'child-1', title: 'Child' },
      { docId: 'child-2', title: '' },
    ]);
    const { service } = bandService(
      { status: 'ready', properties: [] },
      { notShown$: () => notShown$ }
    );
    const slots = { docLinkClicked: new Subject<unknown>() };
    const providers = new Map<unknown, unknown>([
      [TitleBandProvider, service],
      [RefNodeSlotsProvider, slots],
    ]);
    const { std } = fakeStd(providers);
    const clicked = vi.fn();
    slots.docLinkClicked.subscribe(clicked);

    for (const surface of ['page', 'canvas'] as const) {
      const band = await mount(std, surface);
      const row = q(band, 'title-band-not-shown');
      expect(row?.getAttribute('role'), surface).toBe('group');
      expect(row?.getAttribute('aria-label'), surface).toBe(
        'Not shown on this page'
      );
      const links = all(band, 'title-band-not-shown-page');
      expect(links.map(link => link.textContent?.trim())).toEqual([
        'Child',
        'Untitled',
      ]);
      const showHere = all(band, 'title-band-show-here');
      expect(showHere.map(button => button.textContent?.trim())).toEqual([
        'Show here',
        'Show here',
      ]);
      // Each "Show here" sits in a group named after its page.
      expect(
        showHere[1].closest('[role="group"]')?.getAttribute('aria-label')
      ).toBe('Untitled');
      (links[0] as HTMLButtonElement).click();
    }
    expect(clicked).toHaveBeenCalledTimes(2);
    expect(clicked).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: 'child-1' })
    );

    // The list is the host's: a page it drops leaves the row.
    notShown$.value = [];
    const empty = await mount(std, 'page');
    expect(q(empty, 'title-band-not-shown')).toBeNull();

    // No linked-document path: a link that opens nothing is not drawn.
    notShown$.value = [{ docId: 'child-1', title: 'Child' }];
    providers.delete(RefNodeSlotsProvider);
    const orphan = await mount(std, 'canvas');
    expect(q(orphan, 'title-band-not-shown')).toBeNull();
  });
});

let seq = 0;

/** A real store: a page, its surface, an edgeless-only note, then a note. */
function pageStore(): { store: Store; note: string } {
  const workspace = new TestWorkspace({ id: `title-band-show-here-${seq++}` });
  workspace.storeExtensions = [
    RootBlockSchemaExtension,
    SurfaceBlockSchemaExtension,
    NoteBlockSchemaExtension,
    ParagraphBlockSchemaExtension,
    EmbedLinkedDocBlockSchemaExtension,
  ];
  workspace.meta.initialize();
  const store = workspace.createDoc(DOC).getStore();
  let note = '';
  store.load(() => {
    const root = store.addBlock('affine:page', { title: new Text('') });
    store.addBlock('affine:surface', {}, root);
    note = store.addBlock('affine:note', {}, root);
    store.addBlock('affine:paragraph', { text: new Text('a') }, note);
    // Shown on the canvas only: the page view never puts a card here.
    store.addBlock(
      'affine:note',
      { displayMode: NoteDisplayMode.EdgelessOnly },
      root
    );
  });
  return { store, note };
}

function showHereStd(store: unknown, extra: [unknown, unknown][] = []) {
  const { service } = bandService(
    { status: 'ready', properties: [] },
    { notShown$: () => signal([{ docId: 'child-1', title: 'Child' }]) }
  );
  const providers = new Map<unknown, unknown>([
    [TitleBandProvider, service],
    [RefNodeSlotsProvider, { docLinkClicked: new Subject<unknown>() }],
    ...extra,
  ]);
  return {
    host: {},
    store,
    getOptional: (id: unknown) => providers.get(id) ?? null,
    get: (id: unknown) => {
      const found = providers.get(id);
      if (!found) throw new Error('not registered');
      return found;
    },
  } as unknown as BlockStdScope;
}

describe('"Show here"', () => {
  it('appends a linked-doc card to the last note of the page view, one undo step', async () => {
    const { store, note } = pageStore();
    const capture = vi.spyOn(store, 'captureSync');
    const track = vi.fn();
    const std = showHereStd(store, [[TelemetryProvider, { track }]]);
    const band = await mount(std, 'page');

    (q(band, 'title-band-show-here') as HTMLButtonElement).click();

    const children = store.getBlock(note)!.model.children;
    expect(children.map(child => child.flavour)).toEqual([
      'affine:paragraph',
      'affine:embed-linked-doc',
    ]);
    const card = children[1] as unknown as { props: { pageId: string } };
    expect(card.props.pageId).toBe('child-1');
    expect(capture).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('BlockCreated', {
      blockType: 'affine:embed-linked-doc',
    });
  });

  it('places the card at the centre of the visible canvas through the CRUD path', async () => {
    const captureSync = vi.fn();
    const store = {
      id: DOC,
      root: { id: 'root' },
      captureSync,
      readonly: false,
      readonly$: signal(false),
    };
    const surface = { id: 'surface' };
    const select = vi.fn();
    const gfx = {
      surface,
      viewport: { centerX: 100, centerY: 50 },
      selection: { set: select },
    };
    const addBlock = vi.fn(() => 'card-1');
    const std = showHereStd(store, [
      [GfxControllerIdentifier, gfx],
      [EdgelessCRUDIdentifier, { addBlock }],
    ]);
    const band = await mount(std, 'canvas');

    (q(band, 'title-band-show-here') as HTMLButtonElement).click();

    expect(captureSync).toHaveBeenCalledTimes(1);
    // A vertical card (the canvas's "Linked doc" style), 364 by 390, centred.
    expect(addBlock).toHaveBeenCalledWith(
      'affine:embed-linked-doc',
      { pageId: 'child-1', xywh: '[-82,-145,364,390]', style: 'vertical' },
      surface
    );
    expect(select).toHaveBeenCalledWith({
      elements: ['card-1'],
      editing: false,
    });
  });

  it('offers nothing and writes nothing on a read-only document', async () => {
    const { store, note } = pageStore();
    store.readonly = true;
    const band = await mount(showHereStd(store), 'page');

    // The page still opens; it just cannot be shown here.
    expect(all(band, 'title-band-not-shown-page')).toHaveLength(1);
    expect(q(band, 'title-band-show-here')).toBeNull();
    expect(showPageHere(showHereStd(store), 'page', 'child-1')).toBeNull();
    expect(store.getBlock(note)!.model.children).toHaveLength(1);
  });
});
