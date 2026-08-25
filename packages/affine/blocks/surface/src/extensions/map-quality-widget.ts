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
import {
  type CheckupRun,
  liveViolations,
  type RuleFamily,
  userFacingViolations,
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
 * Width of the column the checkboxes live in, in screen pixels.
 *
 * Every body row of the panel reserves it — the ones with a box put the box in
 * it, the ones without leave it empty — so one vertical line runs down the left
 * edge of every sentence in the panel. The alternative the PO offered (boxes
 * aligned right) would have put the control furthest from the words it governs.
 */
const CHECKBOX_GUTTER = 22;

/**
 * What the library calls each rule FAMILY, so a check-up can say what it looked
 * at — "Check-up (tones, nomenclature)" — instead of announcing a verdict about
 * nothing in particular.
 *
 * Chrome, and only chrome: a family is the LIBRARY's own vocabulary (it is
 * declared in `validation.ts` and no framework may add one), so wording it here
 * puts no words in a framework's mouth. The rule's own message still comes from
 * the framework, and the host catalogue still wins over both — these are keyed
 * like everything else.
 */
const FAMILY_FALLBACK: Record<RuleFamily, string> = {
  'element-in-background': 'placement',
  'orientation-against-axis': 'orientation',
  attachment: 'attachment',
  'no-overlap': 'overlaps',
  'relative-order-along-axis': 'order',
  'tone-convention': 'tones',
  'majority-fact': 'nomenclature',
};

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
 *
 * ## Saying which of the three it is (PO, 02/08)
 *
 * The review found a map wearing amber badges whose check-up reported "Nothing
 * to report", with a missing title and no legend. Every one of those statements
 * was true, and together they read as a contradiction, because the panel never
 * said WHO was speaking. Three different things live on this surface and the
 * wording now names all three, without moving a single boundary between them:
 *
 * - the CHECKLIST is introduced as "To be checked by you" — the tool does not
 *   judge it and now says so before the first box, not only in a comment here;
 * - the CHECK-UP names the families it walked — "Check-up (tones,
 *   nomenclature):" — so "Nothing to report" is a verdict about something
 *   rather than about everything;
 * - the REAL-TIME findings, which no check-up ever runs, get a read-only count
 *   for this map, so the badges on the canvas are accounted for in the panel
 *   that was appearing to deny them.
 *
 * No semantics changed: the same rules run at the same moments and write the
 * same things. Only the panel stopped leaving the reader to work out which is
 * which.
 */
export class MapQualityWidget extends EditorAnchoredPanel {
  static override styles = [
    editorAnchoredPanelStyles,
    css`
    /* The box, the layer and the anchoring come from the shared pattern; this
       is the panel's own stacking of sections inside it. */
    .map-quality-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
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

    /* One column for the control, one for the words — and the same two columns
       on every body row, whether or not it has a control to put in the first
       one (PO, 02/08: the check-up lines hung a checkbox-width to the left of
       the checklist and read as a hole). */
    .map-quality-nudge,
    .map-quality-indent {
      display: grid;
      grid-template-columns: ${unsafeCSS(CHECKBOX_GUTTER)}px 1fr;
      align-items: start;
    }

    .map-quality-nudge {
      padding: 4px 0;
      cursor: pointer;
    }

    /* The gutter is empty here: the second column is where the text goes. */
    .map-quality-indent > * {
      grid-column: 2;
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

    .map-quality-run {
      align-self: flex-start;
      justify-self: start;
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

    /* What the check-up looked at, and what is flagged in real time — context,
       not verdicts, so they read as secondary to the remarks they frame. */
    .map-quality-scope,
    .map-quality-realtime {
      color: var(--affine-text-secondary-color);
      font-size: 12px;
    }

    .map-quality-realtime {
      margin-top: 4px;
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
    `,
  ];

  /** The instance whose panel is open, mirrored off the manager's signal. */
  @state()
  private accessor _openFor: string | null = null;

  @state()
  private accessor _checkup: CheckupRun | null = null;

  /**
   * The live real-time findings, mirrored off the manager's signal for the
   * context line ({@link _renderRealtime}).
   *
   * Mirrored rather than read inside `render`: a lit template does not track a
   * preact signal, so a count read there would be whatever it was the last time
   * something else forced a render — a number that is silently wrong is worse
   * than no number, and this one exists precisely to be trusted against the
   * badges on the canvas.
   */
  @state()
  private accessor _violations: readonly Violation[] = [];

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
    const { _disposables } = this;

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
      _disposables.add(
        effect(() => {
          const next = liveViolations(
            userFacingViolations(validation.violations$.value)
          );
          // A clean board hands out a fresh empty array on every evaluation;
          // assigning it would re-render the panel for nothing, and does so
          // once from inside the widget's own first update.
          if (next.length === 0 && this._violations.length === 0) return;
          this._violations = next;
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

  /**
   * The families a check-up on this map walks, worded and joined — "tones,
   * nomenclature".
   *
   * Distinct and in declared order: two rules of the same family are one thing
   * being checked, and the list is read, not counted.
   */
  private _checkupScope(rules: readonly { family: RuleFamily }[]): string {
    const families: string[] = [];
    for (const rule of rules) {
      const label = translateKey(
        this.std,
        `com.labre.validation.family.${rule.family}`,
        FAMILY_FALLBACK[rule.family] ?? rule.family
      );
      if (!families.includes(label)) families.push(label);
    }
    return families.join(
      translateKey(this.std, 'com.labre.validation.list-separator', ', ')
    );
  }

  /**
   * "N real-time warnings active on this map" — the missing half of the PO's
   * 02/08 report, where a check-up said "Nothing to report" over a map wearing
   * amber badges.
   *
   * Both statements were true and neither was legible on its own: the badges
   * come from REAL-TIME rules, which a check-up never runs, and the check-up
   * only ever spoke about its own two. So the panel says both, in the order a
   * reader needs them, and neither one changes what the other means.
   *
   * Strictly READ-ONLY, and strictly this map's: the count comes off
   * `violations$` — the same list the badges are drawn from — narrowed on
   * `backgroundId`, exactly as `runCheckup` narrows a check-up. Audit findings
   * are excluded because they are invisible by design, and excused ones because
   * an exception is a decision already taken, not something still asking.
   *
   * Nothing is rendered when the count is zero: a line saying "0" is noise on
   * the clean board, which is most boards.
   */
  private _renderRealtime(element: GfxPrimitiveElementModel) {
    const count = this._violations.filter(
      violation => violation.backgroundId === element.id
    ).length;
    if (count === 0) return nothing;

    return html`<div class="map-quality-indent">
      <div class="map-quality-realtime" data-testid="map-quality-realtime">
        ${fill(
          translateKey(
            this.std,
            'com.labre.validation.map-quality.realtime',
            'Real-time warnings currently on this map: {count}.'
          ),
          { count }
        )}
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
      <div class="map-quality-indent">
        <button
          class="map-quality-run"
        type="button"
        data-testid="map-quality-run"
        ?disabled=${running}
        @pointerdown=${this.swallow}
        @pointerup=${this.swallow}
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
              <!-- WHAT was checked, on the result itself. A verdict that does
                   not say what it looked at reads as a verdict on everything,
                   which is how "Nothing to report" ended up contradicting the
                   badges on the same map. -->
              <div class="map-quality-scope" data-testid="map-quality-scope">
                ${fill(
                  translateKey(
                    this.std,
                    'com.labre.validation.map-quality.scope',
                    'Check-up ({families}):'
                  ),
                  { families: this._checkupScope(rules) }
                )}
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
        </div>
        ${this._renderNudges(element)} ${this._renderCheckup(element)}
        ${
          // Last, and outside the check-up block on purpose: it is context about
          // the MAP, not a result of the button above it, and it has to be there
          // for a framework that declares nudges and no on-demand rule at all.
          this._renderRealtime(element)
        }`
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
