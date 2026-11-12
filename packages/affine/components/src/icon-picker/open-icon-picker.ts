import type { TranslationService } from '@labre/affine-shared/services';
import { BlockSuiteError } from '@labre/global/exceptions';
import { flip, offset, type Placement, shift } from '@floating-ui/dom';

import { createLitPortal } from '../portal/index.js';
import type { IconPickerSelectDetail, IconPickerTab } from './types.js';

export interface OpenIconPickerOptions {
  /** The tab it opens on; `'icons'` when left out, as the element. */
  activeTab?: IconPickerTab;
  /** The tint the icon panel starts on (a CSS colour). */
  color?: string;
  /** `false` hides "Remove", for a host where an icon is mandatory. */
  showRemove?: boolean;
  /** `false` keeps the picks out of `localStorage`. */
  rememberRecent?: boolean;
  /**
   * The host's translation service, the object it registers with
   * `TranslationExtension`; absent, the picker reads in English.
   */
  translation?: TranslationService;
  /** Where the popup sits against the anchor; `'bottom-start'` by default. */
  placement?: Placement;
  /**
   * The element the popup is appended to; `document.body` by default. A host
   * opening it from a modal dialog passes the dialog's content, so the
   * dialog's focus trap and outside-click guard see the picker as inside.
   */
  container?: Element;
  /** Aborting it closes the picker, which then resolves `undefined`. */
  signal?: AbortSignal;
}

/** The gap between the anchor and the popup, in px. */
const ANCHOR_GAP_PX = 4;
/** How close to the viewport edge the popup may slide, in px. */
const VIEWPORT_PADDING_PX = 8;

/** The single picker open through this function, if any. */
let opened: AbortController | null = null;

/**
 * Opens `affine-icon-picker` in a popup anchored to `anchor`, for a host that
 * has no editor around (the Labre shell's workspace icon, issue #636), and
 * resolves once the user is done:
 *
 * - with an `IconData` when they pick an emoji (`{ type: 'emoji', unicode }`)
 *   or an icon (`{ type: 'affine-icon', name, color }`); both are plain JSON
 *   the host stores as is;
 * - with `null` when they press "Remove";
 * - with `undefined` when they cancel: Escape, a click outside the popup, the
 *   anchor leaving the page, `signal` aborting, or another `openIconPicker`
 *   call (one picker at a time).
 *
 * The popup closes in every case. Escape is consumed while the picker is
 * open, so a host dialog behind it stays open.
 *
 * The element must be registered first: call `effects()` of the same entry
 * once at boot, as for `edgeless-color-picker`. Nothing is defined at import.
 *
 * To show the stored value again: an emoji is its `unicode` as text; an icon
 * is `renderAffineIcon(name)` (same entry, a Lit template to `render` into an
 * element) painted in `color`.
 */
export function openIconPicker(
  anchor: Element,
  options: OpenIconPickerOptions = {}
): Promise<IconPickerSelectDetail | undefined> {
  if (!customElements.get('affine-icon-picker')) {
    throw new BlockSuiteError(
      BlockSuiteError.ErrorCode.ValueNotExists,
      'affine-icon-picker is not registered: call effects() from the icon-picker entry once before openIconPicker'
    );
  }

  opened?.abort();
  const controller = new AbortController();
  opened = controller;

  const picker = document.createElement('affine-icon-picker');
  if (options.activeTab) picker.activeTab = options.activeTab;
  if (options.color) picker.color = options.color;
  if (options.showRemove !== undefined) picker.showRemove = options.showRemove;
  if (options.rememberRecent !== undefined) {
    picker.rememberRecent = options.rememberRecent;
  }
  picker.translation = options.translation;

  return new Promise(resolve => {
    let outcome: IconPickerSelectDetail | undefined;
    controller.signal.addEventListener(
      'abort',
      () => {
        if (opened === controller) opened = null;
        resolve(outcome);
      },
      { once: true }
    );

    picker.addEventListener('select', event => {
      outcome = (event as CustomEvent<IconPickerSelectDetail>).detail;
      controller.abort();
    });

    // On `window` in the capture phase, so it runs before a host dialog's
    // own Escape listener on `document` and stops it there; prevented too,
    // because a native `<dialog>` opened with `showModal()` closes on
    // Escape's default action, not through a listener.
    window.addEventListener(
      'keydown',
      event => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        event.preventDefault();
        controller.abort();
      },
      { capture: true, signal: controller.signal }
    );

    const { signal } = options;
    if (signal?.aborted) {
      controller.abort();
      return;
    }
    signal?.addEventListener('abort', () => controller.abort(), {
      once: true,
      signal: controller.signal,
    });

    const portal = createLitPortal({
      template: picker,
      container: options.container,
      abortController: controller,
      computePosition: {
        referenceElement: anchor,
        placement: options.placement ?? 'bottom-start',
        middleware: [
          offset(ANCHOR_GAP_PX),
          flip(),
          shift({ padding: VIEWPORT_PADDING_PX }),
        ],
        autoUpdate: true,
      },
    });

    // The portal's own `closeOnClickAway` reads `event.target`; the composed
    // path is what says whether a click inside the picker's shadow tree landed
    // in the popup. Registered a task later so the opening click is not one.
    setTimeout(() => {
      if (controller.signal.aborted) return;
      document.addEventListener(
        'click',
        event => {
          if (event.composedPath().includes(portal)) return;
          controller.abort();
        },
        { signal: controller.signal }
      );
    });
  });
}
