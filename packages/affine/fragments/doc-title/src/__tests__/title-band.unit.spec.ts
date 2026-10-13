import { RefNodeSlotsProvider } from '@labre/affine-inline-reference';
import {
  PropertiesPanelProvider,
  type PropertiesPanelService,
  type TitleBandProperty,
  TitleBandProvider,
  type TitleBandService,
  type TitleBandSheetState,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { signal } from '@preact/signals-core';
import { Subject } from 'rxjs';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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
 * - the "Not shown in this document" row is drawn on the canvas only, and
 *   only with a linked-document path to open its links through.
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

  it('draws "Not shown in this document" on the canvas only', async () => {
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

    const page = await mount(std, 'page');
    expect(q(page, 'title-band-not-shown')).toBeNull();

    const canvas = await mount(std, 'canvas');
    const links = all(canvas, 'title-band-not-shown-page');
    expect(links.map(link => link.textContent?.trim())).toEqual([
      'Child',
      'Untitled',
    ]);
    (links[0] as HTMLButtonElement).click();
    expect(clicked).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: 'child-1' })
    );

    // No linked-document path: a link that opens nothing is not drawn.
    providers.delete(RefNodeSlotsProvider);
    const orphan = await mount(std, 'canvas');
    expect(q(orphan, 'title-band-not-shown')).toBeNull();
  });
});
