import {
  collectTranslationKeys,
  commandCategoryTranslationEntries,
  commandTranslationEntries,
  mergeTranslationEntries,
  type TranslationKeyManifestEntry,
} from '@labre/std';

import { cynefinEstuarineCommands } from './commands.js';
import { CYNEFIN_CANVAS_WORDINGS } from './cynefin/consts.js';
import { CYNEFIN_TOOLBAR_WORDINGS } from './cynefin/toolbar/config.js';
import { ESTUARINE_CANVAS_WORDINGS } from './estuarine/consts.js';
import { ESTUARINE_NUDGES } from './estuarine/nudges.js';
import { ESTUARINE_READING } from './estuarine/reading.js';
import { ESTUARINE_ROLES } from './estuarine/roles.js';
import { ESTUARINE_TOOLBAR_WORDINGS } from './estuarine/toolbar/config.js';
import {
  CYNEFIN_ESTUARINE_TEMPLATE_CATEGORY_WORDINGS,
  CYNEFIN_ESTUARINE_TEMPLATE_NAME_WORDINGS,
  CYNEFIN_ESTUARINE_TEMPLATE_SEEDS,
} from './templates/index.js';

/**
 * THIS framework's contribution to the translation-key manifest.
 *
 * Since WS4 it also carries the Estuarine ROLE labels and the four Map quality
 * NUDGES — the framework's entire validation vocabulary, since it declares no
 * rule and no profile (`estuarine/nudges.ts`). Cynefin contributes neither,
 * having no role of its own.
 *
 * Its command labels and descriptions are built from a TEMPLATE, so the
 * concrete keys exist nowhere but in the declarations themselves and the
 * core manifest could not restate them even if it wanted to. The
 * contribution therefore ships WITH the framework: in the bundled
 * distribution `@formicoidea/labre-framework-cynefin` carries it, and a host
 * composes it into its catalogue exactly as it already composes
 * `cynefinEstuarineCommands` into the command registry. See
 * `packages/affine/all/src/translations.ts`.
 */
export const cynefinEstuarineTranslationEntries: TranslationKeyManifestEntry[] =
  mergeTranslationEntries(
    commandTranslationEntries(cynefinEstuarineCommands),
    // The catalogue's own group headers, derived from the very categories
    // these commands declare. They ship WITH the framework because core's
    // registry names no framework category in the bundled distribution, so a
    // host that composed core's manifest alone drew translated entries under
    // English headers (#183).
    commandCategoryTranslationEntries(cynefinEstuarineCommands),
    collectTranslationKeys('role', ESTUARINE_ROLES),
    collectTranslationKeys('nudge', ESTUARINE_NUDGES),
    // LAST, and the order is load-bearing: a reading profile carries the
    // framework's own `roles`, so walking it reaches every role key the line
    // above already named. `mergeTranslationEntries` keeps the FIRST
    // occurrence, which is what makes each key report the source it comes from.
    // This profile declares no relation, so today it contributes no key of its
    // own — walking it costs nothing and means the day it gains one the
    // manifest already names it.
    collectTranslationKeys('reading', ESTUARINE_READING),
    // The seeds the two hand-composed templates write into the document
    // (`templates/index.ts`), resolved through `Template.localize` rather than
    // a creation action — no command draws these two scenes.
    CYNEFIN_ESTUARINE_TEMPLATE_SEEDS.map(([key, fallback]) => ({
      key,
      fallback,
      source: 'seed' as const,
    })),
    // The Templates-panel tab names — chrome, resolved by the panel widget,
    // never written into a document.
    CYNEFIN_ESTUARINE_TEMPLATE_CATEGORY_WORDINGS.map(([key, fallback]) => ({
      key,
      fallback,
      source: 'chrome' as const,
    })),
    // The two hand-composed templates' own tile names — chrome as well, and
    // distinct from the seeds they WRITE above.
    CYNEFIN_ESTUARINE_TEMPLATE_NAME_WORDINGS.map(([key, fallback]) => ({
      key,
      fallback,
      source: 'chrome' as const,
    })),
    // The two frameworks' own toolbar tooltips.
    [...CYNEFIN_TOOLBAR_WORDINGS, ...ESTUARINE_TOOLBAR_WORDINGS].map(
      ([key, fallback]) => ({ key, fallback, source: 'chrome' as const })
    ),
    // Every word the Cynefin frame's canvas renderer paints (headings,
    // decisions, annotations, markers) — fixed notation, not document seeds.
    CYNEFIN_CANVAS_WORDINGS.map(([key, fallback]) => ({
      key,
      fallback,
      source: 'chrome' as const,
    })),
    // The Estuarine map's own three curve legends.
    ESTUARINE_CANVAS_WORDINGS.map(([key, fallback]) => ({
      key,
      fallback,
      source: 'chrome' as const,
    }))
  );
