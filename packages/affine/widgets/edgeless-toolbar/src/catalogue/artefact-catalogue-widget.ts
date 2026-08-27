import { EDITOR_ANCHORED_PANEL_Z_INDEX } from '@labre/affine-block-surface';
import { TOUCH_TARGET_MIN_PX } from '@labre/affine-shared/consts';
import type { RootBlockModel } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import { IS_MAC } from '@labre/global/env';
import {
  type AnyCommandDescriptor,
  type CommandOwner,
  getCommandIcon,
  getCommandsForSurface,
  isCommandAvailable,
  normalizeLegacyCombo,
  runCommand,
  ShortcutOverrideIdentifier,
  WidgetComponent,
  WidgetViewExtension,
} from '@labre/std';
import { css, html, nothing, unsafeCSS } from 'lit';
import { state } from 'lit/decorators.js';
import { literal, unsafeStatic } from 'lit/static-html.js';

import {
  CATALOGUE_CATEGORY_KEY_PREFIX,
  type CatalogueGroup,
  groupCommandsByCategory,
  humanizeCategory,
} from './catalogue-groups.js';
import { formatChord } from './chord-format.js';

export const EDGELESS_ARTEFACT_CATALOGUE_WIDGET =
  'edgeless-artefact-catalogue-widget';

/** Wide enough for an icon, a label and a chord; never more than most of a phone. */
const PANEL_WIDTH = 'min(320px, 85vw)';

/**
 * The **artefact catalogue** sidepanel (PF6).
 *
 * A framework's senior sub-menu is a row of icons, and a row of icons stops
 * working somewhere around fourteen. The BPMN pack is the first framework to
 * pass that line, so the sub-menu shows the seven the ranking put first and
 * hands the rest to this panel: everything the owner declares on the
 * `'catalogue'` surface, grouped by the categories the framework itself
 * declared, with the label and the chord spelled out instead of guessed from a
 * glyph.
 *
 * ## Left, full height, inside the editor
 *
 * Not a popover, not a modal. It is a column down the left edge of the editor
 * host — the side no toolbar occupies — the canvas stays live to its right, and
 * a click on the canvas puts it away. Twenty artefacts want a list you scroll,
 * and a list you scroll wants height; a floating box would have had to choose
 * between covering the board and showing four rows at a time.
 *
 * ## Not an `EditorAnchoredPanel`
 *
 * The shared base (ADR 0011) exists for panels pinned ABOVE the senior button
 * bar and measured against it: its host is bottom-left and zero-sized, and
 * `anchorBox()` returns a `bottom` and a width read off the bar. None of that
 * is expressible for a full-height column, so the geometry is this file's own —
 * but the WISDOM is not reinvented. The layer constant is imported from there
 * rather than copied, and the host is zero-WIDTH for the same reason its host is
 * zero-sized (`.widgets-container > * { pointer-events: auto }` is an outer-tree
 * rule that beats `:host { pointer-events: none }`, so a host with a real box
 * would swallow canvas clicks down the whole left side of the board). The
 * click-away, the Escape-on-`std.host` scope and the disconnect cleanup are the
 * same contracts, replicated in about thirty lines.
 *
 * ## What closing does, and does not
 *
 * X, Escape and click-away all close, on the FIRST gesture, and none of them
 * touches the active senior tool: the panel is a way of reaching a command, not
 * a mode. Invoking a row closes it too — the PO's default is one tap and back
 * to the canvas.
 *
 * ## Who opens it
 *
 * `ArtefactCatalogueProvider`. This widget registers itself as the DEFAULT
 * implementation ({@link artefactCatalogueDefaultExtension}); a host with its
 * own sidebar registers `ArtefactCatalogueExtension(service)`, whose
 * `di.override` wins, and this panel is then never asked to open.
 */
export class EdgelessArtefactCatalogueWidget extends WidgetComponent<RootBlockModel> {
  static override styles = css`
    /*
      A zero-WIDTH host spanning the editor's full height. See the class
      docstring: a host with a real box would take every pointer event down the
      left edge of the canvas, open or not. The panel below carries the box.
    */
    :host {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 0;
      z-index: ${unsafeCSS(EDITOR_ANCHORED_PANEL_Z_INDEX)};
      pointer-events: none;
      font-family: var(--affine-font-family);
    }

    .artefact-catalogue-panel {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: ${unsafeCSS(PANEL_WIDTH)};
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      background: var(--affine-background-overlay-panel-color, #fff);
      border-right: 1px solid var(--affine-border-color);
      box-shadow: var(--affine-shadow-2);
      color: var(--affine-text-primary-color);
      font-size: 14px;
      line-height: 1.4;
      pointer-events: auto;
    }

    .artefact-catalogue-panel:focus-visible {
      outline: 2px solid var(--affine-primary-color);
      outline-offset: -2px;
    }

    .artefact-catalogue-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 8px 8px 16px;
      border-bottom: 1px solid var(--affine-border-color);
      font-weight: 600;
    }

    .artefact-catalogue-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /*
      A close button a finger can hit. Square at the touch minimum rather than
      the 6px-padded × the anchored panels use: this one is the only way out of
      a full-height surface on a tablet, where there is no Escape key.
    */
    .artefact-catalogue-close {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${unsafeCSS(TOUCH_TARGET_MIN_PX)}px;
      height: ${unsafeCSS(TOUCH_TARGET_MIN_PX)}px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--affine-text-secondary-color);
      font-family: inherit;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
    }

    .artefact-catalogue-close:hover,
    .artefact-catalogue-close:focus-visible {
      background: var(--affine-hover-color);
      color: var(--affine-text-primary-color);
    }

    .artefact-catalogue-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      /* The canvas behind must never scroll because this list bottomed out. */
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      padding: 8px 0 16px;
    }

    .artefact-catalogue-group-label {
      padding: 12px 16px 4px;
      color: var(--affine-text-secondary-color);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    /*
      Full-width rows, never narrower than a finger. A minimum and not a fixed
      height: a long label in a translated catalogue wraps and the row grows,
      which is the direction a touch target may move.
    */
    .artefact-catalogue-entry {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      min-height: ${unsafeCSS(TOUCH_TARGET_MIN_PX)}px;
      box-sizing: border-box;
      padding: 6px 16px;
      border: none;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    /*
      Visible states, not hover-only affordances: a finger never hovers, so the
      pressed state is what tells a tablet user the tap landed.
    */
    .artefact-catalogue-entry:hover {
      background: var(--affine-hover-color);
    }

    .artefact-catalogue-entry:active {
      background: var(--affine-hover-color);
      filter: brightness(0.97);
    }

    .artefact-catalogue-entry:focus-visible {
      outline: 2px solid var(--affine-primary-color);
      outline-offset: -2px;
    }

    .artefact-catalogue-icon {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      fill: var(--affine-icon-color);
      color: var(--affine-icon-color);
    }

    .artefact-catalogue-icon svg {
      width: 24px;
      height: 24px;
    }

    .artefact-catalogue-label {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .artefact-catalogue-chord {
      flex: none;
      color: var(--affine-text-secondary-color);
      font-size: 12px;
      white-space: nowrap;
    }
  `;

  /** Which framework's catalogue is on screen, or `null` when it is away. */
  @state()
  private accessor _owner: CommandOwner | null = null;

  /** The owner the body was last scrolled to the top for. */
  private _scrolledFor: CommandOwner | null = null;

  get catalogueOpen() {
    return this._owner !== null;
  }

  /**
   * Show `owner`'s catalogue. Called through `ArtefactCatalogueProvider`, never
   * from another widget's DOM — the sub-menu that opens it lives in a different
   * tree, and the seam is what keeps a host's own sidebar substitutable.
   */
  openFor(owner: CommandOwner) {
    this._owner = owner;
  }

  /**
   * Put the panel away. Deliberately writes NOTHING but its own state: the
   * senior tool the user armed before opening the catalogue is still armed
   * after, whichever gesture closed it.
   */
  readonly closePanel = () => {
    this._owner = null;
  };

  /** Keep a gesture inside the panel from reaching the canvas behind it. */
  private readonly _swallow = (event: Event) => {
    event.stopPropagation();
  };

  private readonly _onDocumentPointerDown = (event: PointerEvent) => {
    if (!this.catalogueOpen) return;
    // Anything inside this widget keeps it open. The sub-menu entry that opened
    // it is in another tree, and its own click already landed.
    if (event.composedPath().includes(this)) return;
    this.closePanel();
  };

  /**
   * Escape is listened for on the EDITOR HOST, not on `document`: a host
   * application keeps its own global Escape, and with the catalogue open the
   * key dismisses the catalogue rather than clearing the canvas selection
   * behind it. Same scope and same reasoning as `EditorAnchoredPanel`.
   */
  private readonly _onHostKeydown = (event: KeyboardEvent) => {
    if (!this.catalogueOpen || event.key !== 'Escape') return;
    event.stopPropagation();
    this.closePanel();
  };

  /**
   * A wheel OVER THE PANEL scrolls the panel, never the board.
   *
   * Same bug and same fix as the violation bubble (PR #103, PO 02/08):
   * `EdgelessRootBlock` takes `wheel` off the event dispatcher on the editor
   * host and `preventDefault()`s unconditionally before panning — so a wheel
   * over the catalogue's overflowing list panned the canvas instead of
   * scrolling the twenty artefacts under the pointer (PO recette, 27/08/2026).
   * One CAPTURE-phase listener on the host stops the event before the
   * dispatcher sees it; no `preventDefault`, because the default action IS the
   * panel scrolling.
   *
   * Narrower than the bubble's freeze, deliberately: the bubble owns the wheel
   * everywhere while open (a reading gesture); the catalogue only claims the
   * wheel over its own box — `composedPath` gate — and the canvas to its right
   * keeps panning, because furnishing a diagram means looking around it.
   */
  private readonly _onHostWheel = (event: WheelEvent) => {
    if (!this.catalogueOpen) return;
    if (!event.composedPath().includes(this)) return;
    event.stopPropagation();
  };

  /**
   * Idempotent, and called from both `firstUpdated` and a later
   * `connectedCallback`: `WithDisposable` throws the group away on disconnect
   * while lit runs `firstUpdated` exactly once.
   */
  private _wire() {
    document.addEventListener('pointerdown', this._onDocumentPointerDown, true);
    const host = this.std.host;
    host.addEventListener('keydown', this._onHostKeydown, true);
    host.addEventListener('wheel', this._onHostWheel, true);
    this._disposables.add(() => {
      document.removeEventListener(
        'pointerdown',
        this._onDocumentPointerDown,
        true
      );
      host.removeEventListener('keydown', this._onHostKeydown, true);
      host.removeEventListener('wheel', this._onHostWheel, true);
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
   * On open: the panel takes the focus and the list starts at the top.
   *
   * The focus is what makes the panel reachable from a keyboard and audible to
   * a screen reader — it carries the dialog's label, so the framework's name is
   * read before the first artefact. `preventScroll` because the host is a
   * zero-width box at the editor's origin and the browser would otherwise
   * scroll the editor to "reveal" it.
   *
   * The scroll reset matters on the second open: a user who scrolled to the
   * bottom of BPMN's twenty artefacts, closed, and opened the panel again for
   * another framework would otherwise land mid-list with no idea what is above.
   */
  override updated() {
    const owner = this._owner;
    if (owner === null || owner === this._scrolledFor) {
      if (owner === null) this._scrolledFor = null;
      return;
    }
    const panel = this.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="artefact-catalogue-panel"]'
    );
    if (!panel) return;
    this._scrolledFor = owner;
    const body = this.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="artefact-catalogue-body"]'
    );
    if (body) body.scrollTop = 0;
    panel.focus({ preventScroll: true });
  }

  /**
   * The commands this panel draws: the owner's `'catalogue'` surface, minus the
   * ones whose preconditions do not hold.
   *
   * Unavailable commands are DROPPED, not greyed out. A disabled row in a list
   * of twenty is noise a reader has to step over on every pass, and the panel
   * has no room to say why it is disabled; a command that comes back when the
   * selection changes simply reappears.
   */
  private _commands(owner: CommandOwner): AnyCommandDescriptor[] {
    const { std } = this;
    return getCommandsForSurface(std, owner, 'catalogue').filter(
      command =>
        isCommandAvailable(std, command) && (!command.when || command.when(std))
    );
  }

  /**
   * The chord this command answers to on this platform, as the user would type
   * it — or `null` for the many commands that ship keyless (and stay bindable).
   *
   * The host's override table is consulted, so a rebound command shows what it
   * is actually bound to rather than what it shipped with, and a `'disabled'`
   * entry shows nothing at all.
   */
  private _chord(command: AnyCommandDescriptor): string | null {
    const overrides = this.std.getOptional(ShortcutOverrideIdentifier) ?? {};
    const override = overrides[command.id];
    if (override === 'disabled') return null;
    const keys = normalizeLegacyCombo(
      override ?? (IS_MAC ? command.defaultKeys.mac : command.defaultKeys.other)
    );
    return keys.length ? formatChord(keys, IS_MAC) : null;
  }

  /**
   * Run the command. The panel STAYS OPEN.
   *
   * `runCommand` is the one bottleneck (ADR 0008): the telemetry and the usage
   * measure are emitted there, and `surface: 'catalogue'` is what makes this
   * panel distinguishable from the sub-menu in the numbers.
   *
   * Staying open is the PO's call (recette, 27/08/2026), reversing the first
   * default: a catalogue is where a user furnishes a diagram, and furnishing is
   * several artefacts in a row — closing after each one turned that into
   * open-click-reopen. The exits are unchanged and all one gesture: ×, Escape,
   * or a click on the canvas.
   */
  private _invoke(command: AnyCommandDescriptor) {
    runCommand(this.std, command, {
      surface: 'catalogue',
      source: 'toolbar:general',
    });
  }

  private _groupLabel(group: CatalogueGroup): string {
    const { category } = group;
    if (category === null) {
      return translateKey(this.std, 'com.labre.catalogue.other', 'Other');
    }
    return translateKey(
      this.std,
      `${CATALOGUE_CATEGORY_KEY_PREFIX}${category}`,
      humanizeCategory(category)
    );
  }

  private _renderEntry(command: AnyCommandDescriptor) {
    const icon = getCommandIcon(this.std, command.iconKey);
    const label = translateKey(
      this.std,
      command.labelKey,
      command.labelFallback
    );
    const chord = this._chord(command);

    return html`<button
      class="artefact-catalogue-entry"
      type="button"
      data-testid="artefact-catalogue-entry"
      data-command-id=${command.id}
      @click=${() => this._invoke(command)}
    >
      <span class="artefact-catalogue-icon">${icon ?? nothing}</span>
      <span class="artefact-catalogue-label">${label}</span>
      ${chord
        ? html`<span class="artefact-catalogue-chord">${chord}</span>`
        : nothing}
    </button>`;
  }

  override render() {
    const owner = this._owner;
    if (owner === null) return nothing;

    const groups = groupCommandsByCategory(this._commands(owner));
    // A framework's own name, through the same key the senior button uses. The
    // fallback is the owner id respelled — the library invents no framework
    // prose, and a host with a catalogue always wins.
    const frameworkLabel = translateKey(
      this.std,
      `com.labre.framework.${owner}`,
      humanizeCategory(owner)
    );
    const catalogueTitle = translateKey(
      this.std,
      'com.labre.catalogue.title',
      'Artefacts'
    );

    return html`<div
      class="artefact-catalogue-panel"
      role="dialog"
      tabindex="-1"
      aria-label=${`${frameworkLabel} — ${catalogueTitle}`}
      data-testid="artefact-catalogue-panel"
      data-owner=${owner}
      @pointerdown=${this._swallow}
      @pointerup=${this._swallow}
      @click=${this._swallow}
    >
      <div class="artefact-catalogue-head">
        <span class="artefact-catalogue-title">${frameworkLabel}</span>
        <button
          class="artefact-catalogue-close"
          type="button"
          data-testid="artefact-catalogue-close"
          aria-label=${translateKey(
            this.std,
            'com.labre.catalogue.close',
            'Close'
          )}
          @click=${this.closePanel}
        >
          ×
        </button>
      </div>
      <div
        class="artefact-catalogue-body"
        data-testid="artefact-catalogue-body"
      >
        ${groups.map(
          group =>
            html`<div
              class="artefact-catalogue-group"
              data-testid="artefact-catalogue-group"
              data-category=${group.category ?? ''}
              role="group"
              aria-label=${this._groupLabel(group)}
            >
              <div class="artefact-catalogue-group-label">
                ${this._groupLabel(group)}
              </div>
              ${group.commands.map(command => this._renderEntry(command))}
            </div>`
        )}
      </div>
    </div>`;
  }
}

export const edgelessArtefactCatalogueWidget = WidgetViewExtension(
  'affine:page',
  EDGELESS_ARTEFACT_CATALOGUE_WIDGET,
  literal`${unsafeStatic(EDGELESS_ARTEFACT_CATALOGUE_WIDGET)}`
);
