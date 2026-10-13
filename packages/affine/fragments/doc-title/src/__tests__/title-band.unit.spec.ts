import {
  EdgelessCRUDIdentifier,
  SurfaceBlockSchemaExtension,
} from '@labre/affine-block-surface';
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
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { signal } from '@preact/signals-core';
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
 * - a write goes to `set` and the chip shows pending until it settles; the
 *   band never applies the value itself, the host's `sheet$` does;
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

beforeAll(() => {
  if (!customElements.get(LABRE_TITLE_BAND)) {
    customElements.define(LABRE_TITLE_BAND, TitleBand);
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
    getOptional: (id: unknown) => providers.get(id) ?? null,
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

    const chips = all(band, 'title-band-chip') as HTMLButtonElement[];
    expect(chips.map(chip => chip.dataset.propertyId)).toEqual([
      'status',
      'owner',
      'done',
    ]);
    expect(chips[0].textContent).toContain('Doing');
    expect(chips[1].dataset.empty).toBe('true');
    expect(chips[1].textContent).toContain('Not set');
    // Empty, and still a live button (REQ-PR-1).
    expect(chips[1].disabled).toBe(false);
    // Asked once, however often the band renders.
    band.requestUpdate();
    await band.updateComplete;
    expect(service.sheet$).toHaveBeenCalledTimes(1);
  });

  it('hands a write to the host, shows it pending, and never applies it', async () => {
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

    const chip = () => q(band, 'title-band-chip') as HTMLButtonElement;
    chip().click();
    await band.updateComplete;

    expect(service.set).toHaveBeenCalledWith(DOC, 'done', true);
    expect(chip().getAttribute('aria-busy')).toBe('true');
    expect(chip().disabled).toBe(true);
    // Still unchecked: the value is the host's to apply.
    expect(chip().querySelector('svg')).not.toBeNull();
    expect(sheet$.value).toEqual({ status: 'ready', properties: [DONE] });

    settle();
    await Promise.resolve();
    await Promise.resolve();
    await band.updateComplete;
    expect(chip().getAttribute('aria-busy')).toBe('false');
    expect(chip().disabled).toBe(false);
  });

  it('clears the pending state when the host refuses a write', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { service } = bandService(
      { status: 'ready', properties: [DONE] },
      { set: vi.fn(() => Promise.reject(new Error('refused'))) }
    );
    const { std } = fakeStd(new Map([[TitleBandProvider, service]]));
    const band = await mount(std);

    (q(band, 'title-band-chip') as HTMLButtonElement).click();
    await new Promise(resolve => setTimeout(resolve, 0));
    await band.updateComplete;
    expect(q(band, 'title-band-chip')?.getAttribute('aria-busy')).toBe('false');
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('writes nothing and offers no "+" on a read-only document', async () => {
    const add = vi.fn();
    const { service } = bandService(
      { status: 'ready', properties: [DONE] },
      { add }
    );
    const { std } = fakeStd(new Map([[TitleBandProvider, service]]), true);
    const band = await mount(std);

    const chip = q(band, 'title-band-chip') as HTMLButtonElement;
    expect(chip.disabled).toBe(true);
    chip.click();
    expect(service.set).not.toHaveBeenCalled();
    expect(q(band, 'title-band-add')).toBeNull();
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
