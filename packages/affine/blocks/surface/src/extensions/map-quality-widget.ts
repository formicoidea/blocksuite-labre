import type { RootBlockModel } from '@labre/affine-model';
import { TelemetryProvider, translateKey } from '@labre/affine-shared/services';
import {
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandDescriptor,
  WidgetComponent,
  WidgetViewExtension,
} from '@labre/std';
import {
  GfxControllerIdentifier,
  GfxPrimitiveElementModel,
} from '@labre/std/gfx';
import { effect } from '@preact/signals-core';
import { css, html, nothing, unsafeCSS } from 'lit';
import { state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { literal, unsafeStatic } from 'lit/static-html.js';

import {
  checkedNudges,
  type QualityNudge,
  setNudgeChecked,
} from './map-quality.js';
import {
  type CheckupRun,
  ValidationManager,
  type Violation,
} from './validation.js';

export const MAP_QUALITY_WIDGET = 'affine-map-quality-widget';

/**
 * Substitute `{name}` placeholders in a translated string.
 *
 * The whole of the library's interpolation needs, and deliberately not an i18n
 * runtime: what matters is that a sentence carrying a number reaches a
 * translator as ONE sentence, so a locale can put the count wherever its grammar
 * wants it. A placeholder the caller did not supply is left alone rather than
 * blanked — a visible `{done}` is a bug report, an empty gap is a mystery.
 */
function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  );
}

/**
 * The panel is TEXT and controls, so it is sized in screen pixels — the same
 * reasoning that keeps the violation bubble in screen units while the markers
 * that open it scale with the board.
 */
const PANEL_WIDTH = 320;
const PANEL_GAP = 12;
const PANEL_MAX_HEIGHT = 420;

/**
 * The **Map quality** panel (PF7.11): the checklist of nudges a framework
 * declares (PF7.10) and the remarks its on-demand check-up produces (PF5.14),
 * on one root instance.
 *
 * ## Generic, not Wardley
 *
 * Nothing here names a framework, a role or a rule. The panel asks the ENGINE
 * what this instance has ({@link ValidationManager.nudgesFor},
 * {@link ValidationManager.checkupRulesFor}) and renders the answer. A second
 * framework declaring nudges or an on-demand rule gets the toolbar entry, this
 * panel and its check-up with no code written anywhere — which is the acceptance
 * criterion of PF7.11 and the reason none of this lives in `gfx/wardley`.
 *
 * ## Why a widget and not a menu
 *
 * Because a dropdown closes on the first click, and this is a surface you WORK
 * in: four boxes to tick, a button to press, a list that fills in afterwards.
 * The entry in the Validation dropdown opens it and gets out of the way
 * (`validation-toolbar.ts`); `ValidationManager.mapQualityFor$` is the seam
 * between the two, because the entry lives in `editor-menu-button`'s shadow root
 * and the panel lives on the root block — two trees with no DOM path between
 * them.
 *
 * DOM rather than the canvas overlay for the reason `ViolationDetailWidget`
 * gives at length: it takes clicks. Same host geometry (an absolutely
 * positioned, zero-sized box at the viewport origin, so only its positioned
 * children are hit), same pointer-pair swallowing, same click-away and Escape
 * handling.
 *
 * ## Read-only
 *
 * Ticking a nudge WRITES on the document, so every checkbox is disabled in a
 * read-only store — and `setNudgeChecked` is behind the same guard, because a
 * disabled input is a UI promise and not an enforcement. Running the check-up
 * writes nothing at all, so it stays available: reading the quality of a map you
 * cannot edit is exactly what a reviewer is here to do.
 *
 * ## Ticking is assuming
 *
 * The panel never claims a nudge is satisfied. It records that somebody said so
 * — the same contract as an exception (PF8), and the reason the checklist and
 * the computed remarks are two clearly separated blocks rather than one list
 * that would blur what was measured with what was asserted.
 */
export class MapQualityWidget extends WidgetComponent<RootBlockModel> {
  static override styles = css`
    /* Above edgeless-selected-rect (z-index 1) and level with the violation
       badge, well below the toolbars. */
    :host {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 2;
      pointer-events: none;
    }

    .map-quality-panel {
      position: absolute;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 12px;
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

    .map-quality-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-weight: 600;
    }

    .map-quality-close {
      border: none;
      background: transparent;
      color: var(--affine-text-secondary-color);
      font-family: inherit;
      font-size: 16px;
      line-height: 1;
      padding: 2px 6px;
      border-radius: 4px;
      cursor: pointer;
    }

    .map-quality-close:hover {
      background: var(--affine-hover-color);
      color: var(--affine-text-primary-color);
    }

    .map-quality-group-label {
      color: var(--affine-text-secondary-color);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .map-quality-nudge {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 4px 0;
      cursor: pointer;
    }

    .map-quality-nudge input[disabled] {
      cursor: not-allowed;
    }

    .map-quality-nudge input {
      margin: 2px 0 0;
      flex: none;
    }

    .map-quality-nudge[data-checked='true'] .map-quality-nudge-label {
      color: var(--affine-text-secondary-color);
    }

    .map-quality-nudge-label {
      overflow-wrap: anywhere;
    }

    .map-quality-run {
      align-self: flex-start;
      padding: 4px 10px;
      border-radius: 4px;
      border: 1px solid var(--affine-border-color);
      background: transparent;
      color: var(--affine-text-primary-color);
      font-family: inherit;
      font-size: 13px;
      cursor: pointer;
    }

    .map-quality-run:hover:not([disabled]) {
      background: var(--affine-hover-color);
    }

    .map-quality-run[disabled] {
      cursor: progress;
      color: var(--affine-text-secondary-color);
    }

    .map-quality-run:focus-visible,
    .map-quality-close:focus-visible,
    .map-quality-nudge input:focus-visible {
      outline: 2px solid var(--affine-primary-color);
      outline-offset: 1px;
    }

    .map-quality-stamp {
      color: var(--affine-text-secondary-color);
      font-size: 12px;
    }

    .map-quality-remark + .map-quality-remark {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--affine-border-color);
    }

    .map-quality-remark-suggestion {
      margin-top: 4px;
      color: var(--affine-text-secondary-color);
      font-size: 13px;
      overflow-wrap: anywhere;
    }
  `;

  /** The instance whose panel is open, mirrored off the manager's signal. */
  @state()
  private accessor _openFor: string | null = null;

  @state()
  private accessor _checkup: CheckupRun | null = null;

  /**
   * Bumped to force a re-render when the document changes underneath — a peer
   * ticking a nudge, an undo, the instance moving. The checklist state lives in
   * the Y.Map, not here: this widget renders it, it never caches it.
   */
  @state()
  private accessor _revision = 0;

  private _elementSubscriptions: { unsubscribe(): void }[] = [];

  /** The instance whose panel has already been given the focus, if any. */
  private _focused: string | null = null;

  get gfx() {
    return this.std.get(GfxControllerIdentifier);
  }

  private get _validation() {
    return this.std.getOptional(ValidationManager);
  }

  /** The open instance, if it still exists and still has a panel to show. */
  private get _element(): GfxPrimitiveElementModel | null {
    if (this._openFor === null) return null;
    const element = this.gfx.surface?.getElementById(this._openFor) ?? null;
    if (!(element instanceof GfxPrimitiveElementModel)) return null;
    return this._validation?.hasMapQuality(element) ? element : null;
  }

  private readonly _swallow = (event: Event) => {
    event.stopPropagation();
  };

  private readonly _close = () => {
    this._validation?.closeMapQuality();
  };

  private readonly _onDocumentPointerDown = (event: PointerEvent) => {
    if (this._openFor === null) return;
    // Anything inside this widget keeps it open. The toolbar entry that opened
    // it is in another tree, and its own click already landed.
    if (event.composedPath().includes(this)) return;
    this._close();
  };

  /**
   * Escape is listened for on the EDITOR HOST, not on `document`, so a host
   * application keeps its own global Escape while this panel handles its own —
   * the rule `ViolationDetailWidget` established.
   */
  private readonly _onHostKeydown = (event: KeyboardEvent) => {
    if (this._openFor === null || event.key !== 'Escape') return;
    event.stopPropagation();
    this._close();
  };

  /**
   * Follow the open instance, and only while one is open. On a board with no
   * panel these subscriptions do not exist, so the busiest signals on the
   * surface cost the widget nothing.
   *
   * `elementRemoved` as well as `elementUpdated`, and that is not symmetry for
   * its own sake: DELETING the instance is the one change that must close the
   * panel, and it is the one change `elementUpdated` never reports. Without it
   * the panel floats over a map that is gone, with a checkbox that writes to a
   * dead element.
   */
  private _watchElements() {
    const wanted = this._openFor !== null;
    if (wanted === (this._elementSubscriptions.length > 0)) return;

    for (const subscription of this._elementSubscriptions) {
      subscription.unsubscribe();
    }
    this._elementSubscriptions = [];
    if (!wanted) return;

    const surface = this.gfx.surface;
    if (!surface) return;
    this._elementSubscriptions.push(
      surface.elementUpdated.subscribe(() => {
        this._revision += 1;
      }),
      surface.elementRemoved.subscribe(({ id }) => {
        if (id === this._openFor) this._close();
        else this._revision += 1;
      })
    );
  }

  /**
   * Idempotent wiring, called from both `firstUpdated` and a later
   * `connectedCallback` — `WithDisposable` throws the group away on disconnect
   * while lit runs `firstUpdated` exactly once.
   */
  private _wire() {
    const { _disposables, gfx } = this;

    const validation = this._validation;
    if (validation) {
      _disposables.add(
        effect(() => {
          this._openFor = validation.mapQualityFor$.value;
          this._watchElements();
        })
      );
      _disposables.add(
        effect(() => {
          this._checkup = validation.checkup$.value;
        })
      );
    }

    _disposables.add(
      gfx.viewport.viewportUpdated.subscribe(() => {
        // The panel FOLLOWS the instance instead of closing on pan and zoom,
        // unlike the violation bubble: that one is a transient read of one
        // finding, this one is a surface somebody is halfway through ticking,
        // and losing their place because they scrolled would be the tool
        // throwing work away.
        if (this._openFor !== null) this.requestUpdate();
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
      for (const subscription of this._elementSubscriptions) {
        subscription.unsubscribe();
      }
      this._elementSubscriptions = [];
    });
  }

  override connectedCallback() {
    super.connectedCallback();
    if (this.hasUpdated) this._wire();
  }

  override firstUpdated() {
    this._wire();
  }

  /**
   * Move the focus into the panel when it opens, once.
   *
   * Without it the panel is unreachable from the keyboard and silent to a screen
   * reader — which matters most on the path the toolbar does not cover: opened
   * from the command palette, the focus is still in the host's own UI, so
   * nothing is announced and the Escape handler (on the editor host, which is
   * the right scope) never sees the key.
   *
   * The panel itself takes the focus, not the first checkbox: it carries the
   * dialog's label, so a screen reader reads "Map quality" before it reads the
   * first expectation. `preventScroll` because the host is a zero-sized box at
   * the viewport origin and the browser would otherwise scroll the editor to
   * "reveal" it.
   *
   * ## Deliberately NOT `aria-modal`, and no focus trap
   *
   * `aria-modal="true"` is a promise that everything behind the dialog is inert,
   * and this panel promises the opposite: the canvas stays usable behind it,
   * which is the whole reason it follows the instance on pan instead of closing.
   * Claiming modality without trapping focus is a label that lies to a screen
   * reader, and trapping Tab from a host that is still perfectly interactive
   * would be the library taking something that is not its to take. So:
   * `role="dialog"` for the announcement, `tabindex="-1"` and this focus move
   * for the reachability, and nothing that claims exclusivity.
   */
  override updated() {
    if (this._openFor === null || this._openFor === this._focused) {
      if (this._openFor === null) this._focused = null;
      return;
    }
    const panel = this.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="map-quality-panel"]'
    );
    if (!panel) return;
    this._focused = this._openFor;
    panel.focus({ preventScroll: true });
  }

  /**
   * Tick or untick, and report it.
   *
   * `captureSync` opens an undo checkpoint first, like every other write the
   * validation surfaces make, so one click is one undo.
   *
   * The read-only test here is the CHEAP half — it keeps `captureSync` and the
   * telemetry from firing for a write that will not happen. The one that
   * actually protects the document is inside `setNudgeChecked`, at the seam,
   * where every caller meets it (see the note there).
   */
  private _toggleNudge(
    element: GfxPrimitiveElementModel,
    nudge: QualityNudge,
    checked: boolean
  ) {
    if (this.std.store.readonly) return;

    this.std.store.captureSync();
    if (!setNudgeChecked(element, nudge.id, checked)) return;
    this._revision += 1;

    this.std.getOptional(TelemetryProvider)?.track('MapQualityNudgeToggled', {
      page: 'whiteboard editor',
      segment: 'whiteboard',
      module: 'map quality panel',
      control: 'nudge',
      framework: nudge.framework,
      nudgeId: nudge.id,
      checked,
    });
  }

  private _runCheckup(element: GfxPrimitiveElementModel) {
    const validation = this._validation;
    if (!validation) return;

    const rules = validation.checkupRulesFor(element);
    validation
      .runCheckup(element)
      .then(run => {
        // A superseded run reports nothing: the click that superseded it will.
        if (!run) return;
        this.std.getOptional(TelemetryProvider)?.track('MapQualityCheckupRun', {
          page: 'whiteboard editor',
          segment: 'whiteboard',
          module: 'map quality panel',
          control: 'run check-up',
          ruleCount: run.total,
          remarkCount: run.results.length,
          ...(run.error ? { error: true } : {}),
          ...(rules[0] !== undefined ? { framework: rules[0].framework } : {}),
        });
      })
      // `runCheckup` already turns a throwing RULE into a finished run carrying
      // `error`. This catches the rest — the driver itself failing — for the one
      // reason that matters: an unhandled rejection would leave the last
      // published run stuck below `total`, so the button stays disabled and
      // there is no way left to ask again, on this map or any other.
      .catch((error: unknown) => {
        console.error('[map-quality] check-up failed', error);
        this.requestUpdate();
      });
  }

  private _renderNudges(element: GfxPrimitiveElementModel) {
    const nudges = this._validation?.nudgesFor(element) ?? [];
    if (nudges.length === 0) return nothing;

    const checked = new Set(checkedNudges(element));
    const readonly = this.std.store.readonly;

    return html`<div>
      <div class="map-quality-group-label" id="map-quality-checklist-label">
        ${translateKey(
          this.std,
          'com.labre.validation.map-quality.checklist',
          'Checklist'
        )}
      </div>
      <div role="group" aria-labelledby="map-quality-checklist-label">
        ${nudges.map(nudge => {
          const on = checked.has(nudge.id);
          const label = translateKey(this.std, nudge.labelKey, nudge.fallback);
          return html`<label
            class="map-quality-nudge"
            data-testid="map-quality-nudge"
            data-nudge-id=${nudge.id}
            data-checked=${on ? 'true' : 'false'}
          >
            <input
              type="checkbox"
              .checked=${on}
              ?disabled=${readonly}
              aria-label=${label}
              @pointerdown=${this._swallow}
              @pointerup=${this._swallow}
              @change=${(event: Event) =>
                this._toggleNudge(
                  element,
                  nudge,
                  (event.target as HTMLInputElement).checked
                )}
            />
            <span class="map-quality-nudge-label">${label}</span>
          </label>`;
        })}
      </div>
    </div>`;
  }

  private _renderRemark(remark: Violation) {
    return html`<div class="map-quality-remark" data-testid="map-quality-remark">
      <div>
        ${
          // The FRAMEWORK's own wording when the host ships no catalogue, and
          // the raw key when the framework shipped none either — the library
          // never invents the wording of somebody else's rule.
          translateKey(this.std, remark.messageKey, remark.messageFallback)
        }
      </div>
      ${remark.suggestion
        ? html`<div class="map-quality-remark-suggestion">
            ${translateKey(
              this.std,
              remark.suggestion,
              remark.suggestionFallback
            )}
          </div>`
        : nothing}
    </div>`;
  }

  private _renderCheckup(element: GfxPrimitiveElementModel) {
    const rules = this._validation?.checkupRulesFor(element) ?? [];
    if (rules.length === 0) return nothing;

    // THIS map's check-up, and only this one. A run is measured on one instance
    // and says so (`CheckupRun.backgroundId`); a board carries several maps, and
    // rendering somebody else's run under this map's title would be the panel
    // asserting things about the map the user is actually looking at. The engine
    // already narrowed the remarks — this narrows the RUN, so a map nobody has
    // checked shows no timestamp rather than the neighbour's.
    const current = this._checkup;
    const run =
      current !== null && current.backgroundId === element.id ? current : null;
    const running = run !== null && run.done < run.total;

    return html`<div>
      <div class="map-quality-group-label" id="map-quality-checkup-label">
        ${translateKey(
          this.std,
          'com.labre.validation.map-quality.checkup',
          'Check-up'
        )}
      </div>
      <button
        class="map-quality-run"
        type="button"
        data-testid="map-quality-run"
        ?disabled=${running}
        @pointerdown=${this._swallow}
        @pointerup=${this._swallow}
        @click=${() => this._runCheckup(element)}
      >
        ${running
          ? // ONE translatable sentence, with the numbers as placeholders. The
            // concatenation it replaces ("Checking…" + " 1/2") was untranslatable
            // as a phrase: a locale that puts the count first, or writes it
            // differently, had no way to say so.
            fill(
              translateKey(
                this.std,
                'com.labre.validation.map-quality.running',
                'Checking… {done}/{total}'
              ),
              { done: run.done, total: run.total }
            )
          : translateKey(
              this.std,
              'com.labre.validation.map-quality.run',
              'Run check-up'
            )}
      </button>
      <div
        role="status"
        aria-live="polite"
        aria-labelledby="map-quality-checkup-label"
        data-testid="map-quality-results"
      >
        ${run === null
          ? nothing
          : html`<div class="map-quality-stamp" data-testid="map-quality-stamp">
                ${translateKey(
                  this.std,
                  'com.labre.validation.map-quality.stamp',
                  'Last check-up'
                )}:
                ${new Date(run.at).toLocaleTimeString()}
              </div>
              ${run.error
                ? html`<div data-testid="map-quality-error">
                    ${translateKey(
                      this.std,
                      'com.labre.validation.map-quality.error',
                      'The check-up could not finish. Try again.'
                    )}
                  </div>`
                : nothing}
              ${run.results.length === 0 && !running && !run.error
                ? html`<div data-testid="map-quality-clean">
                    ${translateKey(
                      this.std,
                      'com.labre.validation.map-quality.clean',
                      'Nothing to report.'
                    )}
                  </div>`
                : run.results.map(remark => this._renderRemark(remark))}`}
      </div>
    </div>`;
  }

  override render() {
    const element = this._element;
    // An instance that lost its role, or whose framework was flagged off while
    // the panel was open, takes the panel with it — and the manager is told, so
    // a stale id can never match a later element. Deletion is caught earlier, by
    // the `elementRemoved` subscription; this is the backstop for the changes
    // that leave the element in place.
    //
    // Deferred out of the render pass on purpose: `_close` writes a signal the
    // widget itself reads, and lit forbids scheduling an update from inside one.
    if (!element) {
      if (this._openFor !== null) queueMicrotask(this._close);
      return nothing;
    }
    // Read so lit re-renders on a document change; the value itself means
    // nothing.
    void this._revision;

    const { viewport } = this.gfx;
    const bound = element.elementBound;
    const [anchorX, anchorY] = viewport.toViewCoord(bound.maxX, bound.y);
    const flipX = anchorX + PANEL_GAP + PANEL_WIDTH > viewport.width;
    // Pinned by its BOTTOM edge when it would overflow, which is exact whatever
    // the content measures — the violation bubble's trick, and for the same
    // reason: the height is not known before layout.
    const flipY = anchorY + PANEL_GAP + PANEL_MAX_HEIGHT > viewport.height;
    const title = translateKey(
      this.std,
      'com.labre.validation.map-quality.section',
      'Map quality'
    );

    return html`<div
      class="map-quality-panel"
      role="dialog"
      aria-label=${title}
      data-testid="map-quality-panel"
      data-element-id=${element.id}
      data-flip-y=${flipY}
      tabindex="-1"
      style=${styleMap({
        left: flipX
          ? `${anchorX - PANEL_GAP - PANEL_WIDTH}px`
          : `${anchorX + PANEL_GAP}px`,
        top: flipY ? `${viewport.height - PANEL_GAP}px` : `${anchorY}px`,
        ...(flipY ? { transform: 'translateY(-100%)' } : {}),
      })}
      @pointerdown=${this._swallow}
      @pointerup=${this._swallow}
      @click=${this._swallow}
    >
      <div class="map-quality-head">
        <span>${title}</span>
        <button
          class="map-quality-close"
          type="button"
          data-testid="map-quality-close"
          aria-label=${translateKey(
            this.std,
            'com.labre.validation.map-quality.close',
            'Close'
          )}
          @pointerdown=${this._swallow}
          @pointerup=${this._swallow}
          @click=${this._close}
        >
          ×
        </button>
      </div>
      ${this._renderNudges(element)} ${this._renderCheckup(element)}
    </div>`;
  }
}

export const mapQualityWidget = WidgetViewExtension(
  'affine:page',
  MAP_QUALITY_WIDGET,
  literal`${unsafeStatic(MAP_QUALITY_WIDGET)}`
);

/**
 * The single selected root instance with a Map quality panel, or `null` — the
 * same answer the toolbar entry computes, asked without a `ToolbarContext`.
 */
function mapQualityTarget(
  std: BlockStdScope
): GfxPrimitiveElementModel | null {
  const validation = std.getOptional(ValidationManager);
  if (!validation) return null;

  const selected = std.get(GfxControllerIdentifier).selection.selectedElements;
  if (selected.length !== 1) return null;

  const [element] = selected;
  if (!(element instanceof GfxPrimitiveElementModel)) return null;
  return validation.hasMapQuality(element) ? element : null;
}

/**
 * "Open Map quality", in the command registry (PF3 / ADR 0008).
 *
 * The toolbar entry is one SURFACE of this command, not a second implementation:
 * the palette, a host panel and the agent reach the same panel through the same
 * registry entry, and Settings › Shortcuts can bind it like anything else.
 *
 * `owner: 'core'` and not a framework's, because the panel belongs to none: it
 * is generic surface tooling that appears for whichever framework declared a
 * nudge or an on-demand rule. Its gating rides on `when`, which asks the engine
 * exactly what the toolbar asks — so a board with every framework flagged off
 * offers the command nowhere, with no flag test written here.
 *
 * Opening writes NOTHING, so there is no read-only guard: reading the quality of
 * a map you cannot edit is precisely what a reviewer does. The write is the
 * checkbox, and that one is guarded twice (see {@link MapQualityWidget}).
 */
const openMapQuality: CommandDescriptor = {
  id: 'validation.mapQuality',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.validation.map-quality',
  labelFallback: 'Map quality',
  descriptionKey: 'com.labre.command.validation.map-quality.description',
  surfaces: ['palette', 'agent'],
  scope: 'edgeless',
  // Keyless by intent — still bindable from Settings › Shortcuts, which is what
  // `toShortcutDescriptor` being total buys.
  defaultKeys: { mac: [], other: [] },
  // The serializable precondition a host catalogue can show. `when` narrows it
  // to "…and that selection is a root instance that HAS a panel", which no
  // member of the closed union can express.
  availability: 'selection:framework',
  when: std => mapQualityTarget(std) !== null,
  run: std => {
    const element = mapQualityTarget(std);
    if (!element) return;
    std.getOptional(ValidationManager)?.openMapQuality(element);
  },
};

export const mapQualityCommands: AnyCommandDescriptor[] = [openMapQuality];
