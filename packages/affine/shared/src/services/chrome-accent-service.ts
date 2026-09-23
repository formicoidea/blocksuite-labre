import { createIdentifier } from '@labre/global/di';
import { LifeCycleWatcher } from '@labre/std';
import type { ExtensionType } from '@labre/store';

import { LABRE_ACCENT } from '../consts/accent.js';
import { installAccentStyleSheet } from '../theme/accent.js';

/**
 * The host seam for the editor's accent (ADR 0029).
 *
 * The library ships Labre's accent by default, so a host that wants it does
 * nothing. A host with its own brand registers this extension, and ONE value
 * then moves both surfaces at once:
 *
 * - the DOM, through the override stylesheet `ChromeAccentWatcher` adopts;
 * - the canvas, through `ThemeService`, which resolves its colours in JS and
 *   can never read a CSS variable.
 *
 * That pairing is the whole point. A host could instead beat the stylesheet
 * with an inline declaration or an `!important` rule, and the chrome would
 * follow — but the canvas would not, and the editor would show two accents.
 * That was the defect ADR 0029 was written to end.
 */
export interface ChromeAccentService {
  /** A CSS colour in `#rrggbb` form — the shape the re-pointing expects. */
  accent: string;
}

export const ChromeAccentProvider = createIdentifier<ChromeAccentService>(
  'ChromeAccentService'
);

export function ChromeAccentExtension(accent: string): ExtensionType {
  return {
    setup: di => {
      di.addImpl(ChromeAccentProvider, { accent });
    },
  };
}

/** The accent in force for `std`: the host's if it registered one, else ours. */
export function resolveChromeAccent(std: {
  getOptional: (id: typeof ChromeAccentProvider) => ChromeAccentService | null;
}): string {
  return std.getOptional(ChromeAccentProvider)?.accent ?? LABRE_ACCENT;
}

/**
 * Adopts the accent override into the document the editor is mounted in.
 *
 * On `mounted` rather than at module load, for two reasons: the accent is only
 * known once the host's extensions are registered, and an editor can be
 * mounted in another document (a print iframe, a popped-out window), which
 * `std.host.ownerDocument` gives us and a module-level `document` would not.
 *
 * Installing is idempotent per document, so several editors on one page share
 * one sheet.
 */
export class ChromeAccentWatcher extends LifeCycleWatcher {
  static override readonly key = 'chrome-accent';

  override mounted() {
    const doc = this.std.host?.ownerDocument;
    if (!doc) return;
    installAccentStyleSheet(doc, resolveChromeAccent(this.std));
  }
}
