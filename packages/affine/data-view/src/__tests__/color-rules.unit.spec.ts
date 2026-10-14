import {
  effects as colorPickerEffects,
  type FrameworkPalette,
} from '@labre/affine-components/color-picker';
import {
  effects as menuEffects,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import type { DatabaseViewColorRule } from '@labre/affine-model';
import { signal } from '@preact/signals-core';
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest';

import { selectOptionColors } from '../core/component/tags/colors.js';
import { softenedChipColor } from '../core/component/tags/softened-colors.js';
import { coreEffects } from '../core/effect.js';
import { evalFilter } from '../core/filter/eval.js';
import type { Filter } from '../core/filter/types.js';
import type { PropertyMetaConfig } from '../core/property/property-config.js';
import {
  colorRuleAdd,
  colorRuleDelete,
  colorRuleMove,
  colorRulesMatch,
  colorRuleUpdate,
  ROW_COLOR_PROPERTY,
  type ViewColorRule,
  viewColorRules,
  viewColorRulesSet,
  viewRowColor,
} from '../core/view/color-rules.js';
import type { DataViewUILogicBase } from '../core/view/data-view-base.js';
import type { ViewManager } from '../core/view-manager/view-manager.js';
import { propertyPresetsEffects } from '../property-presets/effect.js';
import { propertyPresets } from '../property-presets/index.js';
import type { FlatViewDataType } from '../view-presets/flat/flat-view-manager.js';
import type { FlatViewUILogic } from '../view-presets/flat/flat-view-ui.js';
import { galleryEffects } from '../view-presets/gallery/effect.js';
import { GalleryViewUILogic } from '../view-presets/gallery/gallery-view.js';
import { GallerySingleView } from '../view-presets/gallery/index.js';
import { viewPresets } from '../view-presets/index.js';
import { popColorRule } from '../widget-presets/tools/presets/view-options/color-rules-menu.js';
import { listEffects } from '../view-presets/list/effect.js';
import { ListSingleView } from '../view-presets/list/index.js';
import { ListViewUILogic } from '../view-presets/list/list-view.js';

/**
 * Conditional colours of a view (ADR 0036, red zone: the stored
 * `colorRules` of `props.views`). What it would have caught:
 * - a view stored without `colorRules` (every view before 0.50) that reads
 *   as anything but "no rule", or that is written on mount;
 * - a later rule beating an earlier one, a rule with no condition, or a
 *   condition not picked yet (no option chosen), colouring rows;
 * - a stored colour string painted as is: only the options' palette is
 *   ever put into a style, an older `--affine-tag-*` value read as its
 *   palette colour, an unknown one painting nothing and still winning;
 * - an unchanged write (an empty undo step), a write on a read-only or
 *   fallback view, a fallback view painting the rules of a mode it does
 *   not know;
 * - a gallery card or a list row not taking its colour, or keeping it once
 *   the value it matched changed;
 * - the view filter's own reading changed by the colour rules' stricter
 *   one (`evalFilter`'s `undecided`);
 * - a rule's colour picked from the swatch grid written as anything but
 *   the option colour string the menu rows wrote, or written on a
 *   read-only view.
 */

beforeAll(() => {
  if (!customElements.get('uni-lit')) coreEffects();
  if (!customElements.get('affine-database-text-cell')) {
    propertyPresetsEffects();
  }
  if (!customElements.get('dv-gallery-view-ui')) galleryEffects();
  if (!customElements.get('dv-list-view-ui')) listEffects();
  if (!customElements.get('affine-menu')) menuEffects();
  if (!customElements.get('edgeless-color-panel')) colorPickerEffects();
});

afterEach(() => {
  document.body.innerHTML = '';
});

const [red, magenta] = selectOptionColors;

const metas: Record<string, PropertyMetaConfig> = {
  title: propertyPresets.textPropertyConfig as unknown as PropertyMetaConfig,
  select: propertyPresets.selectPropertyConfig as unknown as PropertyMetaConfig,
};

const statusIs = (...ids: string[]): Filter => ({
  type: 'filter',
  left: { type: 'ref', name: 'status' },
  function: 'isOneOf',
  args: [{ type: 'literal', value: ids }],
});

const rule = (id: string, color: string, ...conditions: Filter[]) =>
  ({
    id,
    color,
    filter: { type: 'group', op: 'and', conditions },
  }) satisfies ViewColorRule;

function setup(options: {
  mode?: 'gallery' | 'list';
  colorRules?: unknown;
  readonly?: boolean;
  storedMode?: string;
}) {
  const mode = options.mode ?? 'list';
  const values = new Map<string, unknown>([
    ['r1:title', 'Alpha'],
    ['r1:status', 'todo'],
    ['r2:title', 'Bravo'],
    ['r2:status', 'done'],
    ['r3:title', 'Charlie'],
  ]);
  const types: Record<string, string> = { title: 'title', status: 'select' };
  const viewData = signal<FlatViewDataType & { colorRules?: unknown }>({
    id: 'view-1',
    name: 'View',
    mode: options.storedMode ?? mode,
    columns: [
      { id: 'title', hide: false },
      { id: 'status', hide: false },
    ],
    filter: { type: 'group', op: 'and', conditions: [] },
    ...(options.colorRules === undefined
      ? {}
      : { colorRules: options.colorRules }),
  });
  const viewDataUpdate = vi.fn(
    (_id: string, updater: (data: FlatViewDataType) => object) => {
      viewData.value = { ...viewData.value, ...updater(viewData.value) };
    }
  );
  const cellValueChange = vi.fn(
    (rowId: string, propertyId: string, value: unknown) => {
      values.set(`${rowId}:${propertyId}`, value);
      cells.value = cells.value + 1;
    }
  );
  // Bumped on a cell write, so a cell read re-runs as a real source's does.
  const cells = signal(0);
  const readonly$ = signal(options.readonly ?? false);
  const dataSource = {
    rows$: signal(['r1', 'r2', 'r3']),
    properties$: signal(['title', 'status']),
    readonly$,
    featureFlags$: signal({
      enable_number_formatting: false,
      enable_table_virtual_scroll: false,
    }),
    viewDataGet: () => viewData.value,
    viewDataUpdate,
    cellValueGet: (rowId: string, propertyId: string) => {
      void cells.value;
      return values.get(`${rowId}:${propertyId}`);
    },
    cellValueChange,
    propertyTypeGet: (id: string) => types[id],
    propertyNameGet: (id: string) => id,
    propertyDataGet: (id: string) =>
      id === 'status'
        ? {
            options: [
              { id: 'todo', value: 'Todo', color: red?.color },
              { id: 'done', value: 'Done', color: magenta?.color },
            ],
          }
        : {},
    propertyReadonlyGet: () => false,
    propertyMetaGet: (type: string) => metas[type],
    serviceGet: () => null,
    viewMetaGet: (stored: string) =>
      stored === 'gallery'
        ? viewPresets.galleryViewMeta
        : stored === 'list'
          ? viewPresets.listViewMeta
          : viewPresets.tableViewMeta,
    cellStatus: () => 'ready',
  };
  const manager = { dataSource, readonly$ } as unknown as ViewManager;
  const view =
    mode === 'gallery'
      ? new GallerySingleView(manager, 'view-1')
      : new ListSingleView(manager, 'view-1');
  return { view, viewData, viewDataUpdate, cellValueChange, readonly$ };
}

describe('reading the stored rules', () => {
  it('a view stored without colorRules has no rule, and paints nothing', () => {
    const { view, viewDataUpdate } = setup({});
    expect(
      viewColorRules(view.manager.dataSource.viewDataGet('view-1'))
    ).toEqual([]);
    expect(viewRowColor(view, 'r1')).toBeUndefined();
    expect(viewDataUpdate).not.toHaveBeenCalled();
  });

  it('skips what does not read as a rule, never throws on it', () => {
    const kept = rule('a', red!.color, statusIs('todo'));
    expect(
      viewColorRules({
        colorRules: [
          kept,
          null,
          { id: 'b', color: 3, filter: kept.filter },
          { id: 'c', color: red!.color, filter: { type: 'filter' } },
          { id: 'd', color: red!.color },
        ],
      })
    ).toEqual([kept]);
    expect(viewColorRules({ colorRules: 'red' })).toEqual([]);
  });
});

describe('matching a row', () => {
  const cellOf = (status: unknown) => (id: string) =>
    id === 'status' ? status : undefined;

  it('the first rule that matches wins', () => {
    const rules = [
      rule('a', red!.color, statusIs('todo')),
      rule('b', magenta!.color, statusIs('todo', 'done')),
    ];
    expect(colorRulesMatch(rules, cellOf('todo'))).toBe(red!.color);
    expect(colorRulesMatch(rules, cellOf('done'))).toBe(magenta!.color);
    expect(colorRulesMatch(rules, cellOf(undefined))).toBeUndefined();
    expect(colorRulesMatch([...rules].reverse(), cellOf('todo'))).toBe(
      magenta!.color
    );
  });

  it('a rule with no condition, or one not picked yet, colours nothing', () => {
    const unpicked: Filter = {
      type: 'filter',
      left: { type: 'ref', name: 'status' },
      function: 'isOneOf',
      args: [],
    };
    expect(colorRulesMatch([rule('a', red!.color)], cellOf('todo'))).toBe(
      undefined
    );
    expect(
      colorRulesMatch([rule('a', red!.color, unpicked)], cellOf('todo'))
    ).toBeUndefined();
    // The view filter keeps its own reading: an unfinished condition hides
    // no row.
    expect(evalFilter(rule('a', red!.color, unpicked).filter, {})).toBe(true);
  });

  it('paints a palette colour only; an unknown one wins and paints nothing', () => {
    const old = selectOptionColors.find(c => c.color === magenta!.color)!;
    expect(
      colorRulesMatch(
        [rule('a', old.oldColor, statusIs('todo'))],
        cellOf('todo')
      )
    ).toBe(magenta!.color);
    expect(
      colorRulesMatch(
        [
          rule('a', 'url(https://example.test/x)', statusIs('todo')),
          rule('b', red!.color, statusIs('todo')),
        ],
        cellOf('todo')
      )
    ).toBeUndefined();
  });
});

describe('writing the rules', () => {
  it('adds in a colour no rule uses, edits, moves and deletes by id', () => {
    const { view, viewData } = setup({});
    const first = colorRuleAdd(view, statusIs('todo'))!;
    const second = colorRuleAdd(view, statusIs('done'))!;
    const stored = () => viewData.value.colorRules as ViewColorRule[];
    expect(stored().map(r => r.id)).toEqual([first, second]);
    expect(stored()[0]?.color).toBe(red!.color);
    expect(stored()[1]?.color).toBe(magenta!.color);
    expect(stored()[0]?.filter).toEqual({
      type: 'group',
      op: 'and',
      conditions: [statusIs('todo')],
    });

    expect(viewRowColor(view, 'r1')).toBe(red!.color);
    expect(viewRowColor(view, 'r2')).toBe(magenta!.color);
    expect(viewRowColor(view, 'r3')).toBeUndefined();

    colorRuleUpdate(view, second, { color: red!.color });
    expect(stored()[1]?.color).toBe(red!.color);
    expect(colorRuleMove(view, second, -1)).toBe(true);
    expect(stored().map(r => r.id)).toEqual([second, first]);
    expect(colorRuleMove(view, second, -1)).toBe(false);
    colorRuleDelete(view, second);
    expect(stored().map(r => r.id)).toEqual([first]);
  });

  it('never writes an unchanged list, a read-only view or a fallback view', () => {
    const rules = [rule('a', red!.color, statusIs('todo'))];
    const same = setup({ colorRules: rules });
    expect(viewColorRulesSet(same.view, rules)).toBe(false);
    expect(colorRuleUpdate(same.view, 'a', { color: red!.color })).toBe(false);
    expect(colorRuleUpdate(same.view, 'missing', { color: red!.color })).toBe(
      false
    );
    expect(same.viewDataUpdate).not.toHaveBeenCalled();

    const readonly = setup({ readonly: true });
    expect(colorRuleAdd(readonly.view, statusIs('todo'))).toBeNull();
    expect(readonly.viewDataUpdate).not.toHaveBeenCalled();

    // A `timeline` (a mode with no preset here) is drawn by the table.
    const fallback = setup({ colorRules: rules, storedMode: 'timeline' });
    expect(fallback.view.shownAsFallback$.value).toBe(true);
    expect(viewRowColor(fallback.view, 'r1')).toBeUndefined();
    expect(viewColorRulesSet(fallback.view, [])).toBe(false);
    expect(fallback.viewDataUpdate).not.toHaveBeenCalled();
  });
});

describe("picking a rule's colour", () => {
  type Swatch = HTMLElement & { color: string; active: boolean };
  async function pick(readonly: boolean, index: number) {
    const ctx = setup({
      colorRules: [rule('a', red!.color, statusIs('todo'))],
      readonly,
    });
    const anchor = document.createElement('div');
    document.body.append(anchor);
    const back = vi.fn();
    popColorRule(
      popupTargetFromElement(anchor),
      {
        view: ctx.view,
        root: { dataViewRenderer: undefined },
      } as unknown as DataViewUILogicBase,
      'a',
      back,
      ([, fallback]) => fallback
    );
    await new Promise(resolve => requestAnimationFrame(resolve));
    const panel = document.body.querySelector<
      HTMLElement & { updateComplete: Promise<unknown> }
    >('edgeless-color-panel');
    expect(panel).not.toBeNull();
    await panel!.updateComplete;
    const swatches = [
      ...(panel!.shadowRoot?.querySelectorAll<Swatch>(
        'edgeless-color-button'
      ) ?? []),
    ];
    expect(swatches.map(swatch => swatch.color)).toEqual(
      selectOptionColors.map(item => item.color)
    );
    expect(swatches.findIndex(swatch => swatch.active)).toBe(0);
    swatches[index]!.click();
    return ctx;
  }

  it('writes the option colour string the menu rows wrote', async () => {
    const { viewData } = await pick(false, 4);
    expect((viewData.value.colorRules as ViewColorRule[])[0]?.color).toBe(
      selectOptionColors[4]!.color
    );
  });

  it('writes nothing on a read-only view', async () => {
    const { viewDataUpdate, viewData } = await pick(true, 4);
    expect(viewDataUpdate).not.toHaveBeenCalled();
    expect((viewData.value.colorRules as ViewColorRule[])[0]?.color).toBe(
      red!.color
    );
  });

  it("offers the editor's framework pages and writes the softened colour", async () => {
    const softened = softenedChipColor('#5b9cf6')!;
    const ctx = setup({
      colorRules: [rule('a', softened, statusIs('todo'))],
      readonly: false,
    });
    const anchor = document.createElement('div');
    document.body.append(anchor);
    popColorRule(
      popupTargetFromElement(anchor),
      {
        view: ctx.view,
        root: { dataViewRenderer: { std: fakeStd(WARDLEY_LIKE) } },
      } as unknown as DataViewUILogicBase,
      'a',
      vi.fn(),
      ([, fallback]) => fallback
    );
    await new Promise(resolve => requestAnimationFrame(resolve));
    const carousel = document.body.querySelector<
      HTMLElement & { updateComplete: Promise<unknown> }
    >('dv-color-carousel');
    expect(carousel).not.toBeNull();
    await carousel!.updateComplete;
    const panel = carousel!.shadowRoot!.querySelector<
      HTMLElement & { updateComplete: Promise<unknown> }
    >('edgeless-color-panel')!;
    await panel.updateComplete;
    const swatches = [
      ...panel.shadowRoot!.querySelectorAll<Swatch>('edgeless-color-button'),
    ];
    // The stored softened colour opens its own page, ringed.
    expect(swatches.map(swatch => swatch.color)).toEqual([
      softenedChipColor('#3ec9f2'),
      softened,
    ]);
    expect(swatches.findIndex(swatch => swatch.active)).toBe(1);
    swatches[0]!.click();
    expect((ctx.viewData.value.colorRules as ViewColorRule[])[0]?.color).toBe(
      softenedChipColor('#3ec9f2')
    );
  });
});

const WARDLEY_LIKE: FrameworkPalette = {
  framework: 'wardley',
  labelWording: ['com.labre.framework.wardley', 'Wardley'],
  palettes: [
    { key: 'Wonder', value: '#3ec9f2' },
    { key: 'Peace', value: '#5b9cf6' },
    { key: 'Transparent', value: 'transparent' },
  ],
};

/** The two things the grid reads off an editor: its palettes, its words. */
function fakeStd(...palettes: FrameworkPalette[]) {
  return {
    provider: {
      getAll: () => new Map(palettes.map(p => [p.framework, p])),
    },
    getOptional: () => null,
  };
}

async function settle(root: Element) {
  for (let pass = 0; pass < 4; pass++) {
    await Promise.all(
      [root, ...root.querySelectorAll('*')]
        .map(
          el =>
            (el as Partial<{ updateComplete: Promise<boolean> }>).updateComplete
        )
        .filter(Boolean)
    );
  }
}

describe.each(['gallery', 'list'] as const)('a %s', mode => {
  const selector = {
    gallery: '[data-testid="dv-gallery-card"]',
    list: '[data-testid="dv-list-row"]',
  }[mode];

  it('paints the colour of the first rule a row matches, and follows it', async () => {
    const context = setup({
      mode,
      colorRules: [rule('a', red!.color, statusIs('todo'))],
    });
    const root = {
      config: { headerWidget: undefined },
      openDetailPanel: vi.fn(),
    };
    const logic: FlatViewUILogic =
      mode === 'gallery'
        ? new GalleryViewUILogic(
            root as never,
            context.view as GallerySingleView
          )
        : new ListViewUILogic(root as never, context.view as ListSingleView);
    const ui = document.createElement(
      mode === 'gallery' ? 'dv-gallery-view-ui' : 'dv-list-view-ui'
    ) as HTMLElement & { logic: FlatViewUILogic };
    ui.logic = logic;
    document.body.append(ui);
    await settle(ui);

    const paint = () =>
      [...ui.querySelectorAll<HTMLElement>(selector)].map(item =>
        item.style.getPropertyValue(ROW_COLOR_PROPERTY)
      );
    expect(paint()).toEqual([red!.color, '', '']);
    expect(context.viewDataUpdate).not.toHaveBeenCalled();

    context.view.cellGetOrCreate('r1', 'status').valueSet('done');
    await settle(ui);
    expect(paint()).toEqual(['', '', '']);
  });
});

describe('the stored shape', () => {
  it('what data-view writes is the model rule of ADR 0036', () => {
    expectTypeOf<ViewColorRule>().toMatchTypeOf<DatabaseViewColorRule>();
  });
});
