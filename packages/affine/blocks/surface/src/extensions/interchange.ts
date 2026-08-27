import { createIdentifier, type ServiceProvider } from '@labre/global/di';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import type { ExtensionType } from '@labre/store';

/**
 * The interchange registry (`docs/adr/0012`, P1).
 *
 * Reading a foreign file and writing one are DECLARED PLATFORM CAPABILITIES,
 * registered the way rules and profiles already are — `createIdentifier` plus
 * an `…Extension` helper — and not a function some toolbar happens to call.
 * What that buys is a question the platform can answer about itself: "what can
 * Labre read, what can it write, and for which framework" is a lookup, so the
 * roadmap is a table of real rows rather than a wish.
 *
 * Three properties are load-bearing, and each one is a decision, not a detail.
 *
 * **The unit is the TRIPLE — framework × format × direction.** A direction is
 * never implied by its opposite: BPMN writes `.bpmn` (#149) and cannot read one
 * yet, and a registry that keyed on the format alone would have no way to say
 * so. {@link interchangeCapabilityId} builds the key and
 * {@link InterchangeExtension} refuses a capability whose `id` disagrees with
 * its own three fields, because an id that lies is worse than no id.
 *
 * **The two `run` signatures are mirror images, and neither touches an
 * editor.** An exporter takes element models and returns text; an importer
 * takes text and returns SERIALIZED ELEMENT PROPS — never live models, because
 * it has no surface to add them to and giving it one would cost the purity that
 * lets both halves be unit-tested with plain objects and no DI. The caller does
 * the writing: `surface.addElement` from an editor command, a document mutation
 * from labre-mcp. See P3.
 *
 * **Registration is flag-gated tooling; what it wrote is content.** Call
 * {@link InterchangeExtension} from the framework's FLAG-GATED view extension,
 * beside `ValidationRuleExtension`, because offering to read a file is tooling.
 * Turning a framework's flag off removes its import and export commands; it
 * does not touch one element a past import created. See `docs/adr/0009`.
 */

/* ── What a format is ─────────────────────────────────────────────────── */

/**
 * A format Labre can read or write, and what it PROMISES (ADR 0012, P2).
 *
 * The tier is the single most load-bearing field here, because it is what a
 * user is entitled to expect:
 *
 * - **`semantic`** — the file carries a MODEL (`.bpmn` XML, mermaid, the OWM
 *   DSL). Import is a translation, the preservation contract is full (mapped /
 *   carried / quarantined), and a round-trip is promised.
 * - **`visual`** — the file carries a RENDERING (SVG). Import is best-effort
 *   RECOGNITION, it writes no foreign-matter payload, and it promises exactly
 *   one thing: the picture arrives as editable elements. No round-trip is
 *   implied, and the import surface must say so before the file is read.
 */
export interface InterchangeFormat {
  /**
   * Stable id, and THE KEY under which foreign matter is carried on an
   * element — `'bpmn'`, `'owm'`, `'mermaid'`, `'svg'`.
   */
  id: string;
  tier: 'semantic' | 'visual';
  /** For the file picker and the download name — `['.bpmn']`. */
  extensions: readonly string[];
  mime?: string;
}

/** Which way round a capability goes. Never both: see the triple, above. */
export type InterchangeDirection = 'import' | 'export';

/* ── What crosses the seam ────────────────────────────────────────────── */

/**
 * One element as it is handed to `surface.addElement` — the exact shape the
 * store already takes, so an importer's output is written with no translation
 * step in between and no live model in sight.
 */
export type SerializedElementProps = Record<string, unknown> & { type: string };

/**
 * What a semantic import did with every node of the file (ADR 0012, D1).
 *
 * Three states and not two, and the middle one is the whole point: **mapped**
 * became a drawn artefact, **carried** had no artefact and was kept verbatim on
 * the nearest mapped element, **quarantined** was kept in the document but will
 * not be re-emitted, because re-emitting it would produce a file that
 * contradicts itself. A semantic import classifies; it never silently discards,
 * and these counts are how it says so out loud.
 */
export interface InterchangeReport {
  /** Nodes that became a drawn, editable artefact. */
  mapped: number;
  /** Nodes kept verbatim on the nearest mapped element, invisible on canvas. */
  carried: number;
  /** Nodes kept but deliberately not re-emitted. */
  quarantined: number;
  /** What the reader could not do, one line each, in the user's words. */
  warnings: readonly string[];
}

/** What the caller tells an exporter about the document it is producing. */
export interface InterchangeExportContext {
  /**
   * Names the produced document and the file it is offered as. The board's own
   * title, sanitized by the caller — a capability writes a name, it does not go
   * looking for one.
   */
  name?: string;
}

/** What the caller tells an importer about the source it is handing over. */
export interface InterchangeImportContext {
  /**
   * A name for what is read, used only when the source document names nothing
   * itself. A file that carries its own name always wins: an import states what
   * the file says, and never what the caller wished it said.
   */
  name?: string;
}

/**
 * A whole document, as text, plus what a caller needs to hand it to a browser
 * or an HTTP response without knowing which format it asked for.
 */
export interface InterchangeExportResult {
  /** The document. */
  text: string;
  /** Suggested download name, extension included. */
  filename: string;
  /** `application/xml`, `text/plain`, … — the format's, not the caller's. */
  mime: string;
}

/** Element props for the caller to write, and what became of the source. */
export interface InterchangeImportResult {
  elements: readonly SerializedElementProps[];
  report: InterchangeReport;
}

/**
 * The whole board, in document order — never a selection.
 *
 * A framework document is one statement and half a statement is not a smaller
 * one, so the capability is handed the surface's elements and picks out what it
 * speaks about itself. Document order is the caller's, and it matters: it is
 * the tie-break the audit and the validation rules already break on, so an
 * export cannot disagree with a badge the user can see.
 */
export type InterchangeExporter = (
  elements: readonly GfxPrimitiveElementModel[],
  context: InterchangeExportContext
) => InterchangeExportResult;

/**
 * Text in, element props out. No surface, no `std`, no DI — see P3: this is
 * what makes the same function callable from an editor command and from
 * labre-mcp, and testable from neither.
 */
export type InterchangeImporter = (
  source: string,
  context: InterchangeImportContext
) => InterchangeImportResult;

/* ── The capability ───────────────────────────────────────────────────── */

/** One direction of one format for one framework. */
export interface InterchangeCapability {
  /**
   * `${framework}:${format.id}:${direction}` — unique, and the DI key. Build it
   * with {@link interchangeCapabilityId} rather than by hand.
   */
  id: string;
  /** `'bpmn'`, `'wardley'`, `'c4'` — the framework that owns the vocabulary. */
  framework: string;
  format: InterchangeFormat;
  direction: InterchangeDirection;
  /** The pure function. See P3 — this is the whole contract. */
  run: InterchangeImporter | InterchangeExporter;
}

/** The one way to spell a capability's id. */
export function interchangeCapabilityId(
  framework: string,
  formatId: string,
  direction: InterchangeDirection
): string {
  return `${framework}:${formatId}:${direction}`;
}

/** A framework registers its interchange here; nothing else registers any. */
export const InterchangeIdentifier =
  createIdentifier<InterchangeCapability>('Interchange');

/**
 * Register a framework's interchange capabilities. Call it from the FLAG-GATED
 * view extension — offering to read or write a file is tooling, so a disabled
 * framework offers neither, and a board a past import wrote keeps every byte it
 * was given (`docs/adr/0009`).
 *
 * ```ts
 * context.register(InterchangeExtension([BPMN_XML_EXPORT]));
 * ```
 *
 * The id is checked against the triple it claims to be, and the DI container
 * refuses a second capability under the same id. Both refusals are loud and
 * both are deliberate: a registry whose keys can lie or collide answers the
 * question "what can Labre read" with something other than the truth, and that
 * question is the only reason this registry exists.
 */
export function InterchangeExtension(
  capabilities: readonly InterchangeCapability[]
): ExtensionType {
  return {
    setup: di => {
      for (const capability of capabilities) {
        const expected = interchangeCapabilityId(
          capability.framework,
          capability.format.id,
          capability.direction
        );
        if (capability.id !== expected) {
          throw new Error(
            `Interchange capability id "${capability.id}" is not its triple: expected "${expected}".`
          );
        }
        di.addImpl(InterchangeIdentifier(capability.id), () => capability);
      }
    },
  };
}

/* ── Reading the registry back ────────────────────────────────────────── */

/** Narrows {@link interchangeCapabilities}. Every field is optional and ANDed. */
export interface InterchangeQuery {
  framework?: string;
  /** The format's id, not its extension. */
  format?: string;
  direction?: InterchangeDirection;
}

/**
 * The capabilities registered in this assembly, optionally narrowed.
 *
 * Read straight off the DI identifier, exactly as the audit reads the rules:
 * registration is the gate, so a framework whose flag is off contributes
 * nothing here for the same reason it contributes no rule. Sorted by id, so a
 * menu built from this list is in the same order on every boot.
 */
export function interchangeCapabilities(
  provider: ServiceProvider,
  query: InterchangeQuery = {}
): InterchangeCapability[] {
  return [...provider.getAll(InterchangeIdentifier).values()]
    .filter(
      capability =>
        (query.framework === undefined ||
          capability.framework === query.framework) &&
        (query.format === undefined || capability.format.id === query.format) &&
        (query.direction === undefined ||
          capability.direction === query.direction)
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
