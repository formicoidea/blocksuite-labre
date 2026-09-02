import { TelemetryProvider, translateKey } from '@labre/affine-shared/services';
import {
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandDescriptor,
  WidgetViewExtension,
} from '@labre/std';
import {
  GfxControllerIdentifier,
  GfxPrimitiveElementModel,
} from '@labre/std/gfx';
import { effect } from '@preact/signals-core';
import { css, html, nothing, unsafeCSS } from 'lit';
import { state } from 'lit/decorators.js';
import { literal, unsafeStatic } from 'lit/static-html.js';

import {
  EditorAnchoredPanel,
  editorAnchoredPanelStyles,
} from './editor-anchored-panel.js';
import {
  checkedNudges,
  type QualityNudge,
  setNudgeChecked,
} from './map-quality.js';
import { ValidationManager } from './validation.js';

export const MAP_QUALITY_WIDGET = 'affine-map-quality-widget';

/**
 * Width of the column the checkboxes live in, in screen pixels.
 *
 * One vertical line runs down the left edge of every sentence in the panel: the
 * box sits in this column, the words in the next. The alternative the PO offered
 * (boxes aligned right) would have put the control furthest from the words it
 * governs.
 */
const CHECKBOX_GUTTER = 22;

/**
 * The **Map quality** panel (PF7.11): the checklist of nudges a framework
 * declares (PF7.10), on one root instance.
 *
 * ## One kind of statement, and only one (PO, 02/08/2026)
 *
 * The panel used to carry three: the checklist, a "Run check-up" button with the
 * remarks and the families it had walked, and a count of the real-time warnings
 * on the map. All three were true and the reader had to work out which was
 * speaking — a check-up saying "Nothing to report" over a map wearing amber
 * badges reads as a contradiction until you know it never looked at them. The
 * PO's answer was not more wording: it was to take the other two away. What is
 * left is the one thing the panel is FOR, the expectations the tool cannot judge
 * and the user says they have taken care of.
 *
 * Nothing was removed from the engine. The on-demand moment (PF5.14) and the
 * families that used it are still there, still tested; the canvas still carries
 * the real-time findings, which is where they were always legible. Only this
 * panel got shorter.
 *
 * ## Generic, not Wardley
 *
 * Nothing here names a framework, a role or a rule. The panel asks the ENGINE
 * what this instance has ({@link ValidationManager.nudgesFor}) and renders the
 * answer. A second framework declaring nudges gets the toolbar entry and this
 * panel with no code written anywhere — which is the acceptance criterion of
 * PF7.11 and the reason none of this lives in `gfx/wardley`.
 *
 * ## Why a widget and not a menu
 *
 * Because a dropdown closes on the first click, and this is a surface you WORK
 * in: four boxes to tick, one at a time, while looking at the map. The entry in
 * the Validation dropdown opens it and gets out of the way
 * (`validation-toolbar.ts`); `ValidationManager.mapQualityFor$` is the seam
 * between the two, because the entry lives in `editor-menu-button`'s shadow root
 * and the panel lives on the root block — two trees with no DOM path between
 * them.
 *
 * ## Where it sits
 *
 * **Anchored to the EDITOR, above the senior button bar and at its width** —
 * the same place, the same layer and the same shared class as the reversed
 * reading's panel (ADR 0011, PO decision of 02/08/2026). It shipped as a
 * popover hanging off the map's top-right corner, at 320px, flipping sides and
 * ends to stay on screen; every line of that arithmetic is gone, and with it
 * the two faults the PO named — a floating box that loses the z-order contest
 * with the toolbars, and a measure that lines up with nothing.
 *
 * Only the PRESENTATION moved. The entry in the background's contextual menu is
 * still the trigger, the panel is still about one root instance and still says
 * so in `data-element-id`, and nothing about what it renders changed.
 *
 * ## Read-only
 *
 * Ticking a nudge WRITES on the document, so every checkbox is disabled in a
 * read-only store — and `setNudgeChecked` is behind the same guard, because a
 * disabled input is a UI promise and not an enforcement. Opening the panel
 * writes nothing, so a reviewer still reads the checklist.
 *
 * ## Ticking is assuming
 *
 * The panel never claims a nudge is satisfied. It records that somebody said so
 * — the same contract as an exception (PF8), and the reason the checklist is
 * introduced as "To be checked by you" rather than as "Checklist", which left
 * the reader to guess whether the tool had already been through it.
 */
export class MapQualityWidget extends EditorAnchoredPanel {
  static override styles = [
    editorAnchoredPanelStyles,
    css`
      /* The box, the layer, the anchoring AND the column of header over body
         all come from the shared pattern now — what is left here is the two
         rows this panel puts inside those two slots. */
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

      /* One column for the control, one for the words. */
      .map-quality-nudge {
        display: grid;
        grid-template-columns: ${unsafeCSS(CHECKBOX_GUTTER)}px 1fr;
        align-items: start;
        padding: 4px 0;
        cursor: pointer;
      }

      .map-quality-nudge input[disabled] {
        cursor: not-allowed;
      }

      .map-quality-nudge input {
        margin: 2px 0 0;
        justify-self: start;
      }

      .map-quality-nudge[data-checked='true'] .map-quality-nudge-label {
        color: var(--affine-text-secondary-color);
      }

      .map-quality-nudge-label {
        overflow-wrap: anywhere;
      }

      .map-quality-close:focus-visible,
      .map-quality-nudge input:focus-visible {
        outline: 2px solid var(--affine-primary-color);
        outline-offset: 1px;
      }
    `,
  ];

  /** The instance whose panel is open, mirrored off the manager's signal. */
  @state()
  private accessor _openFor: string | null = null;

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

  private get _validation() {
    return this.std.getOptional(ValidationManager);
  }

  protected override get panelOpen(): boolean {
    return this._openFor !== null;
  }

  protected override closePanel(): void {
    this._close();
  }

  /** The open instance, if it still exists and still has a panel to show. */
  private get _element(): GfxPrimitiveElementModel | null {
    if (this._openFor === null) return null;
    const element = this.gfx.surface?.getElementById(this._openFor) ?? null;
    if (!(element instanceof GfxPrimitiveElementModel)) return null;
    return this._validation?.hasMapQuality(element) ? element : null;
  }

  private readonly _close = () => {
    this._validation?.closeMapQuality();
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
    if (wanted === this._elementSubscriptions.length > 0) return;

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
    const { _disposables } = this;

    const validation = this._validation;
    if (validation) {
      _disposables.add(
        effect(() => {
          this._openFor = validation.mapQualityFor$.value;
          this._watchElements();
        })
      );
    }

    // Click-away, Escape, and the re-measure of the bar the panel is aligned
    // on — the shared pattern, and the same call the reading panel makes.
    //
    // The panel no longer follows the instance on a pan or a zoom, because it
    // no longer hangs off it: it is anchored to the EDITOR, so a gesture that
    // moves the map leaves the surface somebody is halfway through ticking
    // exactly where they left it — which was the point of not closing on pan in
    // the first place, now obtained by construction.
    this.wireAnchoredPanel();

    _disposables.add(() => {
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
   * The dialog semantics themselves — `role`, `tabindex`, and the deliberate
   * absence of `aria-modal` — come from {@link EditorAnchoredPanel}, which is
   * also where the reasoning for that absence now lives.
   */
  override updated() {
    super.updated();
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

  private _renderNudges(element: GfxPrimitiveElementModel) {
    const nudges = this._validation?.nudgesFor(element) ?? [];
    if (nudges.length === 0) return nothing;

    const checked = new Set(checkedNudges(element));
    const readonly = this.std.store.readonly;

    return html`<div>
      <div class="map-quality-group-label" id="map-quality-checklist-label">
        ${
          // Who is doing the checking, said in the label itself (PO, 02/08).
          // "Checklist" left the reader to guess whether the tool had already
          // been through it — and the whole contract of a nudge is that it has
          // not, and cannot. Ticking is assuming; the label now says so before
          // the first box rather than in a comment in this file.
          translateKey(
            this.std,
            'com.labre.validation.map-quality.checklist.yours',
            'To be checked by you:'
          )
        }
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
              @pointerdown=${this.swallow}
              @pointerup=${this.swallow}
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

    const title = translateKey(
      this.std,
      'com.labre.validation.map-quality.section',
      'Map quality'
    );

    return this.renderAnchoredPanel(
      {
        testid: 'map-quality-panel',
        variant: 'map-quality-panel',
        elementId: element.id,
        label: title,
      },
      html`<div class="map-quality-head">
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
          @pointerdown=${this.swallow}
          @pointerup=${this.swallow}
          @click=${this._close}
        >
          ×
        </button>
      </div>`,
      this._renderNudges(element)
    );
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
function mapQualityTarget(std: BlockStdScope): GfxPrimitiveElementModel | null {
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
 * nudge. Its gating rides on `when`, which asks the engine
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
