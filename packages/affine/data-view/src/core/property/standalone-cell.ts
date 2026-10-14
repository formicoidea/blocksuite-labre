import type { UniComponent } from '@labre/affine-shared/types';
import {
  createIdentifier,
  type GeneralServiceIdentifier,
} from '@labre/global/di';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { ShadowlessElement } from '@labre/std';
import type { ExtensionType } from '@labre/store';
import { computed, type ReadonlySignal, signal } from '@preact/signals-core';
import { css, html, nothing, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';

import { dataViewCssVariable } from '../common/css-variable.js';
import type { TagOptionEdits } from '../component/tags/multi-tag-select.js';
import type { DatabaseFlags, PropertyDataUpdater } from '../types.js';
import { renderUniLit } from '../utils/uni-component/uni-component.js';
import type { Cell } from '../view-manager/cell.js';
import type { Property } from '../view-manager/property.js';
import type { Row } from '../view-manager/row.js';
import type { SingleView } from '../view-manager/single-view.js';
import type {
  CellRenderProps,
  DataViewCellComponent,
  DataViewCellLifeCycle,
} from './manager.js';
import type { PropertyMetaConfig } from './property-config.js';

/**
 * A cell outside any view: one property's value drawn and edited by the very
 * cell renderer a table cell mounts (checkbox, select, multi-select, date,
 * number, text, a link…), for a host that has a value and no table, such as
 * the title band under a page title (ADR 0035 §11).
 *
 * A cell renderer is written against a `Cell` bound to a `SingleView` and a
 * data source. Outside a view there are neither, and building a data source
 * for one value would be a second store. What the presets actually read is
 * small, and this seam provides exactly that and nothing more:
 * - of the property: `name$`, `data$`, `type$`, `readonly$`, `dataUpdate`,
 *   `renderer$`, `meta$`, `dataCanSet` and `optionEdits`;
 * - of the view: `featureFlags$` (the number format), `serviceGet` (the link
 *   cell's editor host) and `readonly$`;
 * - of the cell: `value$` and `valueSet`, with the JSON value the raw one,
 *   which holds for every preset a standalone cell is drawn for.
 * The rest of `SingleView` and `Row` is absent: a renderer that starts
 * reading it fails `standalone-cell.unit.spec.ts`, which mounts every preset
 * through this seam, rather than a host at run time.
 */
export interface StandaloneCellSource<
  RawValue = unknown,
  Data extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly propertyId: string;
  readonly name$: ReadonlySignal<string>;
  readonly data$: ReadonlySignal<Data>;
  readonly value$: ReadonlySignal<RawValue | undefined>;
  readonly readonly$: ReadonlySignal<boolean>;
  /** A value the cell's editor commits; the host decides when it shows. */
  valueSet(value: RawValue | undefined): void;
  /**
   * Writes the property's config (a select's options). Absent, the config is
   * not the host's to write here: a select offers its options and creates,
   * renames, recolours, reorders or deletes none.
   */
  dataSet?(data: Data): void;
  /**
   * Which option edits `dataSet` stands for; absent, all. `'create-rename'`:
   * a select creates and renames options and deletes, recolours and
   * reorders none (`TagOptionEdits`).
   */
  readonly optionEdits?: TagOptionEdits;
  /** The view's flags (`enable_number_formatting`); absent, all off. */
  readonly featureFlags$?: ReadonlySignal<DatabaseFlags>;
  /** What `view.serviceGet` answers; absent, nothing. */
  serviceGet?<T>(key: GeneralServiceIdentifier<T>): T | null;
}

const NO_FLAGS: ReadonlySignal<DatabaseFlags> = signal({
  enable_number_formatting: false,
  enable_table_virtual_scroll: false,
});

function isEmptyValue(value: unknown) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

class StandaloneCell<RawValue, Data extends Record<string, unknown>>
  implements Cell<RawValue, RawValue, Data>
{
  readonly view: SingleView;

  readonly property: Property<RawValue, RawValue, Data>;

  readonly value$: ReadonlySignal<RawValue | undefined>;

  readonly jsonValue$: ReadonlySignal<RawValue | undefined>;

  readonly isEmpty$: ReadonlySignal<boolean>;

  readonly stringValue$: ReadonlySignal<string | undefined>;

  get propertyId() {
    return this._source.propertyId;
  }

  get rowId() {
    return this._source.propertyId;
  }

  get row(): Row {
    throw new Error('A standalone cell has no row.');
  }

  constructor(
    meta: PropertyMetaConfig,
    private readonly _source: StandaloneCellSource<RawValue, Data>
  ) {
    const source = _source;
    const view = {
      readonly$: source.readonly$,
      featureFlags$: source.featureFlags$ ?? NO_FLAGS,
      serviceGet: <T>(key: GeneralServiceIdentifier<T>): T | null =>
        source.serviceGet?.(key) ?? null,
    } satisfies Pick<SingleView, 'readonly$' | 'featureFlags$' | 'serviceGet'>;
    // The whole seam is these three members, held by the spec named above.
    this.view = view as unknown as SingleView;

    const type$ = signal(meta.type);
    const property = {
      id: source.propertyId,
      name$: source.name$,
      data$: source.data$,
      type$,
      readonly$: source.readonly$,
      meta$: signal(meta),
      renderer$: signal(meta.renderer.cellRenderer),
      dataCanSet: !!source.dataSet,
      optionEdits: source.optionEdits,
      dataUpdate: (updater: PropertyDataUpdater<Data>) => {
        if (!source.dataSet) return;
        const data = source.data$.peek();
        source.dataSet({ ...data, ...updater(data) });
      },
    } satisfies Partial<Property<RawValue, RawValue, Data>>;
    this.property = property as unknown as Property<RawValue, RawValue, Data>;

    this.value$ = source.value$;
    this.jsonValue$ = source.value$;
    this.isEmpty$ = computed(() => isEmptyValue(source.value$.value));
    this.stringValue$ = computed(() => {
      const value = source.value$.value;
      if (value === undefined) return undefined;
      const toString = meta.config.rawValue.toString as (config: {
        value: RawValue;
        data: Data;
      }) => string;
      return toString({ value, data: source.data$.value });
    });
  }

  valueSet(value: RawValue | undefined) {
    this._source.valueSet(value);
  }

  jsonValueSet(value: RawValue | undefined) {
    this._source.valueSet(value);
  }
}

/** A `Cell` for one value outside any view, drawn with `meta`'s renderer. */
export function createStandaloneCell<
  RawValue = unknown,
  Data extends Record<string, unknown> = Record<string, unknown>,
>(
  meta: PropertyMetaConfig,
  source: StandaloneCellSource<RawValue, Data>
): Cell<RawValue, RawValue, Data> {
  return new StandaloneCell(meta, source);
}

/**
 * A property type a standalone cell can be drawn with, registered by the
 * package that owns its renderer when that package sits above the host: the
 * database block registers its `link` cell, which the title band (a fragment
 * the database block depends on) cannot import. The presets of this package
 * need no registration; a host imports them.
 */
export const StandaloneCellMetaProvider = createIdentifier<PropertyMetaConfig>(
  'DataViewStandaloneCellMeta'
);

export function StandaloneCellMetaExtension<
  Type extends string,
  Data extends NonNullable<unknown>,
  RawValue,
  JsonValue,
>(meta: PropertyMetaConfig<Type, Data, RawValue, JsonValue>): ExtensionType {
  // Erased the way a data source's property list erases its metas.
  const erased = meta as unknown as PropertyMetaConfig;
  return {
    setup: di => {
      di.override(StandaloneCellMetaProvider(meta.type), () => erased);
    },
  };
}

/**
 * The element that hosts a standalone cell: it mounts the cell renderer the
 * way a table cell container does and owns the same edit lifecycle
 * (`beforeEnterEditMode`, `afterEnterEditingMode`, `beforeExitEditingMode`),
 * so a click, Enter or Space starts the renderer's own editor: the checkbox
 * toggles, a select pops its tag menu, the date its picker, a text its input.
 *
 * Leaving: a popup editor (select, date) closes itself on a click away and
 * calls `selectCurrentCell(false)`, as in the table; an editor drawn in place
 * (an input inside this element) leaves when the focus does, Escape included.
 * Either way the renderer's exit hook commits, exactly once.
 */
export class StandaloneCellHost extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    dv-standalone-cell {
      ${unsafeCSS(dataViewCssVariable())}
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-width: 0;
      max-width: 100%;
      outline: none;
    }

    dv-standalone-cell[data-editable='true'] {
      cursor: pointer;
    }

    /* The record detail's editing ring (detail/field.ts). */
    dv-standalone-cell[data-editing='true'] {
      border-radius: 4px;
      box-shadow: 0px 0px 0px 2px
        color-mix(in srgb, var(--affine-primary-color) 30%, transparent);
    }

    .dv-standalone-cell-placeholder {
      color: var(--affine-placeholder-color);
      white-space: nowrap;
    }
  `;

  private readonly _cell$ = signal<DataViewCellLifeCycle>();

  private _exiting = false;

  readonly isEditing$ = signal(false);

  /** Opens the renderer's editor; a checkbox toggles instead. */
  edit() {
    if (this.readonly || this.isEditing$.peek()) return;
    const cell = this._cell$.peek();
    if (!cell?.beforeEnterEditMode()) return;
    this.isEditing$.value = true;
    requestAnimationFrame(() => {
      if (this.isEditing$.peek()) cell.afterEnterEditingMode();
    });
  }

  /** Closes the editor; the renderer's exit hook commits its value. */
  exit() {
    // An exit hook may close a popup whose own close asks to exit again.
    if (!this.isEditing$.peek() || this._exiting) return;
    this._exiting = true;
    try {
      this._cell$.peek()?.beforeExitEditingMode();
    } finally {
      this._exiting = false;
    }
    this.isEditing$.value = false;
  }

  private readonly _selectCurrentCell = (editing: boolean) => {
    if (editing) this.edit();
    else this.exit();
  };

  override connectedCallback() {
    super.connectedCallback();
    this._disposables.addFromEvent(this, 'click', event => {
      if (this.readonly) return;
      event.stopPropagation();
      this.edit();
    });
    this._disposables.addFromEvent(this, 'keydown', event => {
      if (this.isEditing$.peek()) {
        if (event.key === 'Escape') this.exit();
        return;
      }
      if (event.target !== this) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.edit();
      }
    });
    this._disposables.addFromEvent(this, 'focusout', event => {
      if (!this.isEditing$.peek()) return;
      const { target, relatedTarget } = event;
      if (
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLTextAreaElement)
      )
        return;
      if (relatedTarget instanceof Node && this.contains(relatedTarget)) return;
      this.exit();
    });
    this._disposables.add(() => this.exit());
  }

  override render() {
    const view = this.cell.property.renderer$.value?.view as
      | DataViewCellComponent
      | undefined;
    if (!view) return nothing;
    this.dataset.editable = this.readonly ? 'false' : 'true';
    this.dataset.editing = this.isEditing$.value ? 'true' : 'false';
    if (this.readonly) this.removeAttribute('tabindex');
    else this.tabIndex = 0;
    const props: CellRenderProps = {
      cell: this.cell,
      isEditing$: this.isEditing$,
      selectCurrentCell: this._selectCurrentCell,
    };
    const placeholder =
      this.placeholder && !this.isEditing$.value && this.cell.isEmpty$.value
        ? html`<span class="dv-standalone-cell-placeholder"
            >${this.placeholder}</span
          >`
        : nothing;
    return html`${renderUniLit(
      view as UniComponent<CellRenderProps, DataViewCellLifeCycle>,
      props,
      { ref: this._cell$, style: { display: 'contents' } }
    )}${placeholder}`;
  }

  @property({ attribute: false })
  accessor cell!: Cell;

  /** Drawn while the value is empty and no editor is open. */
  @property({ attribute: false })
  accessor placeholder = '';

  /** Draws the value and opens no editor. */
  @property({ attribute: false })
  accessor readonly = false;
}

declare global {
  interface HTMLElementTagNameMap {
    'dv-standalone-cell': StandaloneCellHost;
  }
}
