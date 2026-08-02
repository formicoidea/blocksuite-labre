import type { RootBlockModel } from '@labre/affine-model';
import {
  buildOccurrencePatch,
  getUniverseRegistry,
  publishOccurrenceMaterialities,
  translateKey,
} from '@labre/affine-shared/services';
import { getRegisteredCommands, runCommand, WidgetComponent, WidgetViewExtension } from '@labre/std';
import { GfxControllerIdentifier, isPivotBound } from '@labre/std/gfx';
import { effect } from '@preact/signals-core';
import { css, html, nothing, type TemplateResult, unsafeCSS } from 'lit';
import { state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { literal, unsafeStatic } from 'lit/static-html.js';

import {
  type ElementReading,
  PivotRecordPickerProvider,
  ReadingManager,
  type ReadingProfile,
  type ReadingRelation,
  readRecord,
  type RecordReading,
} from './reading.js';

export const READING_PROPOSAL_WIDGET = 'affine-reading-proposal-widget';

/** Screen pixels. The panel is TEXT, so it does not scale with the board. */
const PANEL_WIDTH = 300;
const PANEL_GAP = 12;
const PANEL_MAX_HEIGHT = 420;

/** The two commands the confirmations drive. Spelled once. */
const TAG_SET_ID = 'tag.set';
const PIVOT_BIND_ID = 'pivot.bind';

/**
 * **The proposal panel** — what the tool reads of one component, offered for
 * confirmation (MF3).
 *
 * It opens on a click and on nothing else: `ReadingManager.open$` is written by
 * the `element.read` command, which the element's own toolbar and the palette
 * invoke. Rendering it costs the document nothing — every line is a function of
 * the board, recomputed at render time, and there is no code path from a render
 * to a write. The invariant has a test of its own: opening and closing this
 * panel a hundred times leaves the document byte-identical.
 *
 * ## What a confirmation is
 *
 * The two writes a user can ask for are the two EXISTING promotion commands:
 * `tag.set` for a nature and `pivot.bind` for the link to a record. The panel
 * owns neither — it invokes them through the registry, exactly as
 * `tags-toolbar.ts` does, so one gesture stays one telemetry event, one undo
 * step and one read-only guard, wherever it was triggered from.
 *
 * A confirmation appears only where there is something to confirm: a value the
 * RECORD carries and the element does not. The library never proposes a nature
 * of its own — no derivation, no inference from the name, from the shape or
 * from the position. An unqualified component with no record simply reads as
 * unqualified, and the panel says so.
 *
 * ## Drift
 *
 * A bound element whose drawing has moved away from its record gets one extra
 * line, informative and non-blocking, with the way to bring the record up to
 * date: the existing materiality publisher, fire-and-forget, host-side. Nothing
 * is refused, nothing is blocked and nothing is written to the DOCUMENT — the
 * board is always right about itself.
 *
 * Modelled on `violation-detail-widget.ts` down to the mechanics that are easy
 * to get wrong: a zero-sized host at the viewport origin so the canvas stays
 * clickable, the pointer pair swallowed on the panel itself, Escape listened
 * for on the EDITOR HOST rather than on `document`, and click-away that
 * observes without swallowing.
 */
export class ReadingProposalWidget extends WidgetComponent<RootBlockModel> {
  static override styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 2;
      pointer-events: none;
    }

    .reading-panel {
      position: absolute;
      box-sizing: border-box;
      width: ${unsafeCSS(PANEL_WIDTH)}px;
      max-height: ${unsafeCSS(PANEL_MAX_HEIGHT)}px;
      overflow-y: auto;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid var(--affine-border-color);
      background: var(--affine-background-overlay-panel-color, #fff);
      box-shadow: var(--affine-shadow-2);
      color: var(--affine-text-primary-color);
      font-family: var(--affine-font-family);
      font-size: 14px;
      line-height: 1.4;
      pointer-events: auto;
    }

    .reading-title {
      font-weight: 600;
      margin-bottom: 8px;
    }

    .reading-field + .reading-field {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--affine-border-color);
    }

    .reading-label {
      color: var(--affine-text-secondary-color);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .reading-value {
      overflow-wrap: anywhere;
    }

    .reading-empty {
      color: var(--affine-text-secondary-color);
      font-style: italic;
    }

    .reading-note {
      margin-top: 2px;
      color: var(--affine-text-secondary-color);
      font-size: 13px;
      overflow-wrap: anywhere;
    }

    .reading-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }

    .reading-action {
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid var(--affine-border-color);
      background: transparent;
      color: var(--affine-text-secondary-color);
      font-family: inherit;
      font-size: 12px;
      cursor: pointer;
    }

    .reading-action:hover {
      background: var(--affine-hover-color);
      color: var(--affine-text-primary-color);
    }

    .reading-action:focus-visible {
      outline: 2px solid var(--affine-primary-color);
      outline-offset: 1px;
    }
  `;

  /** Bumped to force a re-render; the reading itself is never stored. */
  @state()
  private accessor _revision = 0;

  private _elementSubscription: { unsubscribe(): void } | null = null;

  get gfx() {
    return this.std.get(GfxControllerIdentifier);
  }

  private get _manager(): ReadingManager | null {
    return this.std.getOptional(ReadingManager) ?? null;
  }

  private readonly _swallow = (event: Event) => {
    event.stopPropagation();
  };

  private readonly _onDocumentPointerDown = (event: PointerEvent) => {
    const manager = this._manager;
    if (!manager?.open$.value) return;
    if (event.composedPath().includes(this)) return;
    manager.close();
  };

  /**
   * Escape on the EDITOR HOST, not on `document`: with a panel open Escape
   * dismisses the panel rather than clearing the canvas selection behind it,
   * and a library has no business making that call for the whole page.
   */
  private readonly _onHostKeydown = (event: KeyboardEvent) => {
    const manager = this._manager;
    if (!manager?.open$.value || event.key !== 'Escape') return;
    event.stopPropagation();
    manager.close();
  };

  private _wire() {
    const { _disposables, gfx } = this;
    const manager = this._manager;

    if (manager) {
      // `effect` runs once on creation, and that first run happens INSIDE the
      // widget's own first update — bumping state there is the "scheduled an
      // update after an update completed" lit warns about, for a render that is
      // already happening. Every later run is a real change and is wanted.
      let primed = false;
      _disposables.add(
        effect(() => {
          // Read both signals so the panel follows an open/close and a drift.
          void manager.open$.value;
          void manager.drift$.value;
          if (!primed) {
            primed = true;
            return;
          }
          this._revision++;
        })
      );
    }

    _disposables.add(
      gfx.viewport.viewportUpdated.subscribe(() => {
        // The panel is anchored to an element that has just moved under it.
        // Closing is the honest simple answer, and it is the precedent the
        // validation bubble already set.
        this._manager?.close();
      })
    );

    // The surface is a signal, not a fact: it can arrive after the widget and
    // be replaced under it. Anything on the board can change what is read — a
    // link redrawn, a supplier moved, the map itself resized — so while a panel
    // is open every update is a reason to read again.
    _disposables.add(
      effect(() => {
        const surface = gfx.surface$.value;
        this._elementSubscription?.unsubscribe();
        this._elementSubscription = surface
          ? surface.elementUpdated.subscribe(() => {
              if (this._manager?.open$.value) this._revision++;
            })
          : null;
      })
    );

    document.addEventListener('pointerdown', this._onDocumentPointerDown, true);
    const host = this.std.host;
    host.addEventListener('keydown', this._onHostKeydown, true);

    _disposables.add(() => {
      document.removeEventListener(
        'pointerdown',
        this._onDocumentPointerDown,
        true
      );
      host.removeEventListener('keydown', this._onHostKeydown, true);
      this._elementSubscription?.unsubscribe();
      this._elementSubscription = null;
    });
  }

  override connectedCallback() {
    super.connectedCallback();
    if (this.hasUpdated) this._wire();
  }

  override firstUpdated() {
    this._wire();
  }

  /** The label a nature value id reads as, or the raw id when no def explains it. */
  private _natureLabel(tagId: string, valueId: string): string {
    const def = getUniverseRegistry(this.std).tag(tagId);
    if (!def || def.values === 'open') return valueId;
    return def.values.find(value => value.id === valueId)?.label || valueId;
  }

  private _field(
    testid: string,
    label: string,
    body: TemplateResult | typeof nothing
  ) {
    return html`<div class="reading-field" data-testid=${testid}>
      <div class="reading-label">${label}</div>
      ${body}
    </div>`;
  }

  private _renderNodeType(reading: ElementReading, profile: ReadingProfile) {
    const { nodeType } = reading;
    const label = translateKey(
      this.std,
      nodeType.labelKey ?? nodeType.roleId,
      nodeType.roleId
    );
    // The hierarchy, resolved through the SAME vocabulary the reading used:
    // `market` reads as "a kind of Component" because the framework said so in
    // its role defs, not because this panel knows what a market is.
    const chain = nodeType.specialises
      .map(roleId =>
        translateKey(this.std, profile.roles[roleId]?.labelKey ?? roleId, roleId)
      )
      .join(' › ');

    return this._field(
      'reading-node-type',
      translateKey(this.std, 'com.labre.reading.field.type', 'Type of node'),
      html`<div class="reading-value">${label}</div>
        ${chain
          ? html`<div class="reading-note" data-testid="reading-specialises">
              ${translateKey(
                this.std,
                'com.labre.reading.field.specialises',
                'A kind of'
              )}
              ${chain}
            </div>`
          : nothing}`
    );
  }

  /**
   * The nature the element CARRIES — and, when it carries none and the record
   * does, the record's, offered for confirmation. Never a derived one.
   */
  private _renderNature(
    reading: ElementReading,
    profile: ReadingProfile,
    record: RecordReading | undefined,
    writable: boolean
  ) {
    const tagId = profile.nature?.tagId;
    if (!tagId) return nothing;

    const carried = reading.nature?.valueIds ?? [];
    const proposed = record?.nature ?? [];
    const differs =
      proposed.length > 0 &&
      (carried.length !== proposed.length ||
        !carried.every(value => proposed.includes(value)));

    const value = carried.length
      ? html`<div class="reading-value">
          ${carried.map(id => this._natureLabel(tagId, id)).join(', ')}
        </div>`
      : html`<div class="reading-empty" data-testid="reading-nature-empty">
          ${translateKey(
            this.std,
            'com.labre.reading.nature.none',
            'Not qualified — the reading proposes nothing of its own.'
          )}
        </div>`;

    return this._field(
      'reading-nature',
      translateKey(this.std, 'com.labre.reading.field.nature', 'Nature'),
      html`${value}
      ${differs && writable
        ? html`<div class="reading-actions">
            <button
              class="reading-action"
              type="button"
              data-testid="reading-confirm-nature"
              @pointerdown=${this._swallow}
              @pointerup=${this._swallow}
              @click=${this._confirmNature(reading.elementId, tagId, proposed)}
            >
              ${translateKey(
                this.std,
                'com.labre.reading.action.confirm-nature',
                'Confirm'
              )}
              ·
              ${proposed.map(id => this._natureLabel(tagId, id)).join(', ')}
            </button>
          </div>`
        : nothing}`
    );
  }

  private _renderRelations(reading: ElementReading) {
    const consumers = reading.relations.filter(r => r.side === 'consumer');
    const suppliers = reading.relations.filter(r => r.side === 'supplier');

    const line = (relations: ReadingRelation[], key: string, fallback: string) =>
      relations.length
        ? html`<div class="reading-value" data-testid=${`reading-${key}`}>
            ${translateKey(
              this.std,
              `com.labre.reading.relations.${key}`,
              fallback
            )}:
            ${relations
              .map(relation => relation.otherName || relation.otherId)
              .join(', ')}
          </div>`
        : nothing;

    const contradictions = reading.relations.filter(r => r.contradictsGeometry);

    return this._field(
      'reading-relations',
      translateKey(
        this.std,
        'com.labre.reading.field.relations',
        'Parent-child relations'
      ),
      html`${reading.relations.length === 0
        ? html`<div class="reading-empty">
            ${translateKey(
              this.std,
              'com.labre.reading.relations.none',
              'No typed link touches this component.'
            )}
          </div>`
        : nothing}
      ${line(consumers, 'consumers', 'Consumers (above)')}
      ${line(suppliers, 'suppliers', 'Suppliers (below)')}
      ${contradictions.length
        ? html`<div class="reading-note" data-testid="reading-contradiction">
            ${translateKey(
              this.std,
              'com.labre.reading.relations.contradiction',
              'A link states the opposite of what the positions show'
            )}:
            ${contradictions
              .map(relation => relation.otherName || relation.otherId)
              .join(', ')}
          </div>`
        : nothing}`
    );
  }

  private _renderPhase(reading: ElementReading) {
    const { phase } = reading;
    return this._field(
      'reading-phase',
      translateKey(
        this.std,
        'com.labre.reading.field.phase',
        'Evolution phase'
      ),
      phase
        ? html`<div class="reading-value" data-zone-id=${phase.zoneId}>
              ${translateKey(
                this.std,
                phase.labelKey ?? phase.zoneId,
                phase.labelFallback ?? phase.zoneId
              )}
            </div>
            ${phase.inTransitionBand
              ? html`<div class="reading-note" data-testid="reading-phase-band">
                  ${translateKey(
                    this.std,
                    'com.labre.reading.phase.band',
                    'In the zone of punctuated equilibrium'
                  )}
                  ${phase.bandId ? html`(${phase.bandId})` : nothing}
                </div>`
              : nothing}`
        : html`<div class="reading-empty" data-testid="reading-phase-none">
            ${translateKey(
              this.std,
              'com.labre.reading.phase.none',
              'Not on a framework background — no phase to read.'
            )}
          </div>`
    );
  }

  private _renderNaming(reading: ElementReading) {
    const { naming } = reading;
    if (!naming) return nothing;

    return this._field(
      'reading-naming',
      translateKey(
        this.std,
        'com.labre.reading.field.naming',
        'Naming convention'
      ),
      html`<div class="reading-value" data-conforms=${String(naming.conforms)}>
        ${naming.conforms
          ? translateKey(
              this.std,
              'com.labre.reading.naming.conforms',
              'The name follows the convention of its nature.'
            )
          : translateKey(this.std, naming.hintKey, naming.hintFallback)}
      </div>`
    );
  }

  /**
   * The link to a pivot record, and the only place this panel can create one.
   *
   * The action exists only when the host registered a picker: the library
   * cannot choose a document, so with no picker there is nothing to offer and
   * the affordance is HIDDEN rather than disabled — the `QuickSearchProvider`
   * precedent, and the same rule `queryPivotProperties` follows.
   */
  private _renderRecord(reading: ElementReading, writable: boolean) {
    const surface = this.gfx.surface;
    const element = surface?.getElementById(reading.elementId);
    if (!element) return nothing;

    const bound = isPivotBound(element);
    const picker = this.std.getOptional(PivotRecordPickerProvider);

    return this._field(
      'reading-record',
      translateKey(this.std, 'com.labre.reading.field.record', 'Record'),
      html`<div class="reading-value">
        ${bound
          ? translateKey(this.std, 'com.labre.reading.record.linked', 'Linked')
          : html`<span class="reading-empty"
              >${translateKey(
                this.std,
                'com.labre.reading.record.none',
                'Not linked to a record.'
              )}</span
            >`}
      </div>
      ${!bound && picker && writable
        ? html`<div class="reading-actions">
            <button
              class="reading-action"
              type="button"
              data-testid="reading-link-record"
              @pointerdown=${this._swallow}
              @pointerup=${this._swallow}
              @click=${this._linkRecord(reading.elementId)}
            >
              ${translateKey(
                this.std,
                'com.labre.reading.action.link',
                'Link to a record'
              )}
            </button>
          </div>`
        : nothing}`
    );
  }

  /** The drift line: informative, never blocking, with one way to settle it. */
  private _renderDrift(reading: ElementReading) {
    const drift = this._manager?.drift$.value;
    if (!drift || drift.elementId !== reading.elementId) return nothing;

    return this._field(
      'reading-drift',
      translateKey(this.std, 'com.labre.reading.field.drift', 'Drift'),
      html`<div class="reading-value">
          ${translateKey(
            this.std,
            'com.labre.reading.drift.message',
            'The board and the record disagree'
          )}:
          ${drift.fields
            .map(field => `${field.field} — ${field.read || '—'} / ${field.record}`)
            .join('; ')}
        </div>
        <div class="reading-actions">
          <button
            class="reading-action"
            type="button"
            data-testid="reading-update-record"
            @pointerdown=${this._swallow}
            @pointerup=${this._swallow}
            @click=${this._updateRecord(drift.elementId, drift.pivotDocId)}
          >
            ${translateKey(
              this.std,
              'com.labre.reading.action.update-record',
              'Update the record'
            )}
          </button>
        </div>`
    );
  }

  /** Invoke a registered command; a build without it simply has no action. */
  private _run(id: string, params: Record<string, unknown>) {
    const command = getRegisteredCommands(this.std).find(c => c.id === id);
    if (!command) return;
    // `'palette'` until the `'contextual-toolbar'` surface joins the union with
    // the typed-edge slice (ADR 0010 M3): the invocation shape is the seam's,
    // not this panel's, and inventing a member here would fork it.
    runCommand(
      this.std,
      command,
      { surface: 'palette', source: 'toolbar:general' },
      params
    );
  }

  private readonly _confirmNature =
    (elementId: string, tag: string, values: string[]) => (event: Event) => {
      event.stopPropagation();
      this._run(TAG_SET_ID, { tag, values, elementIds: [elementId] });
      this._revision++;
    };

  private readonly _linkRecord = (elementId: string) => (event: Event) => {
    event.stopPropagation();
    const picker = this.std.getOptional(PivotRecordPickerProvider);
    if (!picker) return;

    picker
      .pick(this.std, elementId)
      .then(pivotDocId => {
        // A cancelled picker writes nothing — the whole point of the rung.
        if (!pivotDocId) return;
        this._run(PIVOT_BIND_ID, { pivotDocId, elementIds: [elementId] });
        this._revision++;
      })
      .catch(error => {
        console.error('PivotRecordPicker.pick threw', error);
      });
  };

  /**
   * Announce the occurrence's current materialities to the host — the existing
   * fire-and-forget publisher, and no new channel.
   *
   * What crosses is what the seam carries: the occurrence's role and its
   * type-3 tags (`OccurrenceMaterialityPatch`). A PHASE is a reading of the
   * board, and the seam has no field for it: the drift line reports it so the
   * user can settle it on whichever side is wrong, and the library does not
   * invent a transport for a fact the host never agreed to receive.
   */
  private readonly _updateRecord =
    (elementId: string, pivotDocId: string) => (event: Event) => {
      event.stopPropagation();
      const element = this.gfx.surface?.getElementById(elementId);
      if (!element) return;
      publishOccurrenceMaterialities(
        this.std,
        buildOccurrencePatch(element, pivotDocId)
      );
      // The disagreement has been answered; the next local change re-checks it
      // from scratch, so nothing here has to remember it.
      const manager = this._manager;
      if (manager) manager.drift$.value = null;
    };

  /** Panel origin in screen pixels: the element's top-right corner. */
  private _panelAt(elementId: string): [number, number] | null {
    const element = this.gfx.surface?.getElementById(elementId);
    if (!element) return null;
    const bound = element.elementBound;
    const [x, y] = this.gfx.viewport.toViewCoord(bound.maxX, bound.y);
    return [x, y];
  }

  override render() {
    // Read the revision so lit re-renders when a signal moved.
    void this._revision;

    const manager = this._manager;
    const elementId = manager?.open$.value;
    if (!manager || !elementId) return nothing;

    const reading = manager.reading(elementId);
    const profile = manager.profileOf(elementId);
    if (!reading || !profile) return nothing;

    const at = this._panelAt(elementId);
    if (!at) return nothing;
    const [x, y] = at;

    const element = this.gfx.surface?.getElementById(elementId);
    // The record's side of the reading, guarded and synchronous. `undefined`
    // on every degraded path: no binding, no provider, no configured fields.
    const record = element ? readRecord(this.std, element, profile) : undefined;
    // Read-only: the readings are all there, the confirmations are not. A
    // gesture that cannot be carried out must not be offered — the two commands
    // would refuse it anyway, silently, which is worse.
    const writable = !this.std.store.readonly;

    const { viewport } = this.gfx;
    const flipX = x + PANEL_GAP + PANEL_WIDTH > viewport.width;
    const flipY = y + PANEL_GAP + PANEL_MAX_HEIGHT > viewport.height;

    return html`<div
      class="reading-panel"
      role="dialog"
      data-testid="reading-panel"
      data-element-id=${elementId}
      aria-label=${translateKey(
        this.std,
        'com.labre.reading.panel.label',
        'Proposed record'
      )}
      style=${styleMap({
        left: flipX ? `${x - PANEL_GAP - PANEL_WIDTH}px` : `${x + PANEL_GAP}px`,
        top: flipY ? `${y - PANEL_GAP}px` : `${y + PANEL_GAP}px`,
        ...(flipY ? { transform: 'translateY(-100%)' } : {}),
      })}
      @pointerdown=${this._swallow}
      @pointerup=${this._swallow}
      @click=${this._swallow}
    >
      <div class="reading-title">
        ${translateKey(
          this.std,
          'com.labre.reading.panel.title',
          'What this map says about this component'
        )}
      </div>
      ${this._renderNodeType(reading, profile)}
      ${this._renderNature(reading, profile, record, writable)}
      ${this._renderRelations(reading)} ${this._renderPhase(reading)}
      ${this._renderNaming(reading)} ${this._renderRecord(reading, writable)}
      ${writable ? this._renderDrift(reading) : nothing}
    </div>`;
  }
}

export const readingProposalWidget = WidgetViewExtension(
  'affine:page',
  READING_PROPOSAL_WIDGET,
  literal`${unsafeStatic(READING_PROPOSAL_WIDGET)}`
);
