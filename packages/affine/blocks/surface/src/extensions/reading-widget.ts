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
  readValueFlows,
  type RecordReading,
} from './reading.js';

export const READING_PROPOSAL_WIDGET = 'affine-reading-proposal-widget';

/**
 * Screen pixels. The panel is TEXT, so it does not scale with the board.
 *
 * A comfortable measure rather than the 300px of a floating bubble: this is a
 * paragraph of prose about a component, read in one go, and it is anchored to
 * the editor rather than squeezed beside an element.
 */
const PANEL_WIDTH = 480;
/** Never narrower than this, however cramped the editor gets. */
const PANEL_MIN_WIDTH = 240;
/**
 * Clearance kept above the editor's bottom edge, so the panel sits just OVER
 * the bottom toolbar strip instead of burying its buttons.
 *
 * `edgeless-toolbar` is 64px tall over a 16px bottom padding; the remainder is
 * the gap. What opens UPWARDS out of that strip — the senior sub-menu — is what
 * {@link READING_PANEL_Z_INDEX} exists to stay on top of.
 */
const PANEL_BOTTOM_GAP = 96;
/** Breathing room at the sides and at the top of a small editor. */
const PANEL_MARGIN = 16;
const PANEL_MAX_HEIGHT = 420;
const PANEL_MIN_HEIGHT = 160;

/**
 * **Above every toolbar, the contextual one included.**
 *
 * The ceiling inside `.widgets-container` is `--affine-z-index-popover`, which
 * the theme sets to `1000`: `editor-toolbar` — the contextual toolbar the PO
 * found this panel hiding behind — takes it verbatim, and so does the zoom bar.
 * The bottom `edgeless-toolbar` is only `z-index: 1`, and its senior sub-menus
 * are appended INSIDE its own subtree, so they are capped at that 1 with it.
 * Ten above the variable clears the lot with headroom to spare.
 *
 * The fallback matters as much as the value: it is the host's theme stylesheet
 * that defines the variable, never this library.
 *
 * It is set on the HOST rather than on the panel. Every widget host is a
 * sibling in `.widgets-container`, and `affine-toolbar-widget` declares no
 * stacking context of its own, so `editor-toolbar`'s 1000 competes at that
 * level — which makes it the only level where this contest can be won. The
 * previous `z-index: 2` was chosen to sit "well below the toolbars", and this
 * is the deliberate reversal of that choice for this one panel.
 *
 * What still paints above it, correctly and by design: `popMenu` context menus
 * (1001) and the toolbar drag preview (9999), both mounted on `editor-host`
 * outside the contained widgets layer. A dropdown opened FROM this panel would
 * go through `popMenu` and land on top of it, which is what one wants.
 */
const READING_PANEL_Z_INDEX = 'calc(var(--affine-z-index-popover, 1000) + 10)';

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
 * ## Where it sits
 *
 * **Anchored to the EDITOR, low and centred, over every toolbar** — the PO's
 * recette of 02/08/2026. It shipped as a bubble floating beside the element and
 * came back with two faults: it rendered BEHIND the contextual toolbar, and a
 * paragraph of prose is not a thing to read out of the corner of a shape. So it
 * is now a bottom-centre panel at a comfortable measure, in a layer above every
 * toolbar including the senior menu and its sub-menu — see
 * {@link READING_PANEL_Z_INDEX} for why that layer is where it is, and the
 * styles for why the host stays zero-sized while the panel carries the box.
 *
 * Modelled on `violation-detail-widget.ts` down to the mechanics that are easy
 * to get wrong: a zero-sized host so the canvas stays clickable, the pointer
 * pair swallowed on the panel itself, Escape listened for on the EDITOR HOST
 * rather than on `document`, and click-away that observes without swallowing.
 */
export class ReadingProposalWidget extends WidgetComponent<RootBlockModel> {
  static override styles = css`
    /*
      A ZERO-SIZED host, pinned to the bottom centre of the editor.

      Zero-sized is not a style choice, it is the only safe one:
      \`.widgets-container > * { pointer-events: auto }\` is an OUTER-tree rule
      on a shadowless block component, so it beats \`:host { pointer-events:
      none }\` outright. A host with a real box would swallow canvas clicks
      across the whole bottom of the board. The panel below carries the box.

      \`left: 50%\` centres against \`.widgets-container\`, which is the editor
      viewport at 100% × 100% — the very reference \`edgeless-toolbar\` centres
      on, so the two are co-centred by construction rather than by arithmetic.
    */
    :host {
      position: absolute;
      left: 50%;
      bottom: 0;
      z-index: ${unsafeCSS(READING_PANEL_Z_INDEX)};
      pointer-events: none;
    }

    /*
      Anchored to the editor, not to the element: \`left: 0\` is the host's
      zero-width box — the editor's horizontal centre — and the translate puts
      the panel's own centre on it. \`bottom\` lifts it clear of the toolbar
      strip so the buttons underneath stay usable.
    */
    .reading-panel {
      position: absolute;
      left: 0;
      bottom: ${unsafeCSS(PANEL_BOTTOM_GAP)}px;
      transform: translateX(-50%);
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
        // The panel used to CLOSE here, because it hung off an element that a
        // pan or a zoom moved out from under it. Anchored to the editor it no
        // longer does: panning to look at what the reading is talking about
        // while the reading is on screen is the obvious thing to want, and
        // dismissing it mid-gesture was the old anchor's problem, not the
        // user's. A re-render is still owed — `viewportUpdated` fires on a
        // RESIZE too, and the panel's box is clamped to the editor's.
        if (this._manager?.open$.value) this._revision++;
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
   * The nature the element CARRIES — and, when the record carries a different
   * one, the record's, offered for confirmation. Never a derived one, and never
   * a word the framework does not describe.
   *
   * `record.nature` has already been resolved against the tag def
   * (`resolveRecordNature`), so what this button writes is always a value id the
   * vocabulary knows. What could NOT be resolved is named in a sentence with no
   * button beside it: the honest thing to say about `"Activity"` when the def
   * describes `wardley:nature/activity` is that the record says something this
   * framework does not recognise — not to offer a click that would put the
   * host's word into the document.
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

    const unknown = record?.unknownNature ?? [];

    return this._field(
      'reading-nature',
      translateKey(this.std, 'com.labre.reading.field.nature', 'Nature'),
      html`${value}
      ${unknown.length
        ? html`<div class="reading-note" data-testid="reading-nature-unknown">
            ${translateKey(
              this.std,
              'com.labre.reading.nature.unknown-record-value',
              'The record says'
            )}
            “${unknown.join('”, “')}”,
            ${translateKey(
              this.std,
              'com.labre.reading.nature.unknown-record-value.suffix',
              'a value this framework does not describe.'
            )}
          </div>`
        : nothing}
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

  /**
   * **Value flow** — the same typed edges as the relations above, said the way
   * a value chain is read: from the bottom up.
   *
   * One sentence per typed edge, and no section at all when the element has
   * none: an empty "Value flow" heading states nothing a user wants, and the
   * relations field already says in its own words that no link touches this
   * component.
   *
   * The sentence is assembled from two halves rather than interpolated, because
   * `translateKey` returns a plain string and a host catalogue that returned
   * markup would then be injected into the panel. The fallback reads
   * "Value flows up from X to Y"; a host that translates
   * `com.labre.reading.value-flow` gets the same two slots in its own order via
   * the `.to` suffix key.
   */
  private _renderValueFlow(reading: ElementReading) {
    const flows = readValueFlows(reading);
    if (flows.length === 0) return nothing;

    const from = translateKey(
      this.std,
      'com.labre.reading.value-flow',
      'Value flows up from'
    );
    const to = translateKey(this.std, 'com.labre.reading.value-flow.to', 'to');

    return this._field(
      'reading-value-flow',
      translateKey(
        this.std,
        'com.labre.reading.field.value-flow',
        'Value flow'
      ),
      html`${flows.map(
        flow => html`<div
          class="reading-value"
          data-testid="reading-value-flow-line"
          data-edge-id=${flow.edgeId}
        >
          ${from} ${flow.from} ${to} ${flow.to}
        </div>`
      )}`
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
    // The panel hangs off the selected element and is opened from its toolbar,
    // so that is the surface a confirmation is reported against — never the
    // palette it was not opened from.
    runCommand(
      this.std,
      command,
      { surface: 'contextual-toolbar', source: 'toolbar:general' },
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

    // `Promise.resolve().then(...)` rather than calling `pick` directly: the
    // contract says a picker MUST NOT throw, and this `.catch` is the only line
    // of defence behind that sentence. A picker that throws SYNCHRONOUSLY
    // escapes a `.catch` on its return value entirely — it never returns one —
    // and surfaces as an unhandled error out of a lit event handler. Wrapping
    // the CALL folds both failures onto the same behaviour as a cancel.
    Promise.resolve()
      .then(() => picker.pick(this.std, elementId))
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

  /**
   * The panel's box, clamped to the editor it is anchored to.
   *
   * The CSS already places it; this only stops a comfortable measure from
   * becoming an overflowing one on a narrow or short editor. Both dimensions
   * keep a floor, because a panel squeezed to nothing is not a smaller panel,
   * it is an unreadable one.
   */
  private _panelBox(): { width: number; maxHeight: number } {
    const { viewport } = this.gfx;
    return {
      width: Math.max(
        PANEL_MIN_WIDTH,
        Math.min(PANEL_WIDTH, viewport.width - PANEL_MARGIN * 2)
      ),
      maxHeight: Math.max(
        PANEL_MIN_HEIGHT,
        Math.min(
          PANEL_MAX_HEIGHT,
          viewport.height - PANEL_BOTTOM_GAP - PANEL_MARGIN
        )
      ),
    };
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

    const element = this.gfx.surface?.getElementById(elementId);
    // The record's side of the reading, guarded and synchronous. `undefined`
    // on every degraded path: no binding, no provider, no configured fields.
    const record = element ? readRecord(this.std, element, profile) : undefined;
    // Read-only: the readings are all there, the confirmations are not. A
    // gesture that cannot be carried out must not be offered — the two commands
    // would refuse it anyway, silently, which is worse.
    const writable = !this.std.store.readonly;

    const { width, maxHeight } = this._panelBox();

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
        width: `${width}px`,
        maxHeight: `${maxHeight}px`,
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
      ${this._renderRelations(reading)} ${this._renderValueFlow(reading)}
      ${this._renderPhase(reading)}
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
