import {
  collectTranslationKeys,
  commandTranslationEntries,
  mergeTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';

import { C4_BOARD_BACKGROUND, C4_BOUNDARY_BACKGROUND } from './background.js';
import { c4Commands } from './commands.js';
import { C4_PROFILES } from './profiles.js';
import { C4_ROLES } from './roles.js';
import { C4_RULES } from './rules.js';
import { C4_NODE_CHROME_KEYS } from './toolbar/node-config.js';

/**
 * THIS framework's contribution to the translation-key manifest — every
 * `com.labre.*` key C4 can hand to `TranslationProvider.t`, derived from the
 * very declarations the editor registers (never restated).
 *
 * The contribution ships WITH the framework, exactly as BPMN's does: in the
 * bundled distribution `@formicoidea/labre-framework-c4` carries it, and a host
 * composes it into its catalogue the same way it already composes `c4Commands`
 * into the command registry. See `packages/affine/all/src/translations.ts`.
 *
 * The two BACKGROUND declarations are walked even though neither carries a
 * `labelKey` today: both frames write the user's own words and have no
 * vocabulary to fall back to (`background.ts`). Walking them costs nothing and
 * means the day one of them gains a declared label the manifest already names
 * it — which is the whole reason these lists are derived rather than written.
 */
export const c4TranslationEntries: TranslationKeyManifestEntry[] =
  mergeTranslationEntries(
    commandTranslationEntries(c4Commands),
    collectTranslationKeys('role', C4_ROLES),
    collectTranslationKeys('background', [
      C4_BOARD_BACKGROUND,
      C4_BOUNDARY_BACKGROUND,
    ]),
    // AFTER the two above, and the order is load-bearing: a rule carries its
    // framework's `roles` and, for `c4.person-in-boundary`, the boundary's own
    // declaration, so walking the rules reaches keys those two lists already
    // named. `mergeTranslationEntries` keeps the FIRST occurrence, which is what
    // makes each key report the source it actually comes from.
    collectTranslationKeys('rule', C4_RULES),
    collectTranslationKeys('profile', C4_PROFILES),
    // The node toolbar's own wordings. Composed from the table the toolbar
    // declares beside the call that renders them, never restated here: a
    // wording written twice is a wording that drifts, and the manifest spec's
    // drift check would then be comparing this file against itself.
    C4_NODE_CHROME_KEYS.map(([key, fallback]) => ({
      key,
      fallback,
      source: 'chrome' as const,
    }))
  );
