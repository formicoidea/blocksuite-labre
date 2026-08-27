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
  /**
   * For the file picker and the download name — `['.bpmn']`. The FIRST is the
   * one a download is given, and the type says there is one: a format nothing
   * on a disk is ever called is not a format anybody can hand us.
   */
  extensions: readonly [string, ...string[]];
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
 * One thing an import did that the drawing does not show, named (ADR 0012).
 *
 * The counts below say how much; a note says WHICH, and the ADR asks for that
 * in five places — D1's quarantined column is "listed in the report", D3
 * "records the substitution" of an id it could not keep and the lane
 * disagreement it resolved, D4 "names" a shape that arrived with no diagram and
 * says so when it laid one out, D5 surfaces `mustUnderstand` "by name". The
 * ADR's own rejection of a document-level side table is the argument for this
 * type: a tool that says "I lost some things" and cannot say which, where, or
 * how to get them back has told the user nothing they can act on.
 */
export interface InterchangeNote {
  kind: InterchangeNoteKind;
  /** The Labre element it landed on or rides on, when there is one. */
  elementId?: string;
  /** The source element's id, VERBATIM, when it had one (D3). */
  sourceId?: string;
  /** Its source element name — `boundaryEvent`, `bioc:fill` (D1, D5). */
  element?: string;
  /** One line, in the user's words: what happened and what it costs them. */
  message: string;
}

/**
 * The five things worth saying about one item, and no sixth.
 *
 * - `carried` — no artefact for it; kept verbatim on the nearest mapped
 *   element, invisible on the canvas, re-emitted in place (D1).
 * - `quarantined` — kept in the document and deliberately NOT re-emitted,
 *   because re-emitting it would write a file that contradicts the drawing.
 *   The four cases are closed and named in D5.
 * - `substituted-id` — the file's id could not be given back, so one was
 *   minted. D3's whole point: record what we were given, never reconstruct
 *   what we think we sent.
 * - `invented-layout` — a position the source did not carry. D4 forbids
 *   claiming an invented position came from the file, so it is declared here.
 * - `warning` — the reader proceeded but its reading may be wrong;
 *   `extension/@mustUnderstand="true"` is the named case (D5), a lane the DI
 *   and the `flowNodeRef` disagreed about is the other (D3).
 */
export type InterchangeNoteKind =
  | 'carried'
  | 'quarantined'
  | 'substituted-id'
  | 'invented-layout'
  | 'warning';

/**
 * What a semantic import did with every node of the file (ADR 0012, D1).
 *
 * Three states and not two, and the middle one is the whole point: **mapped**
 * became a drawn artefact, **carried** had no artefact and was kept verbatim on
 * the nearest mapped element, **quarantined** was kept in the document but will
 * not be re-emitted, because re-emitting it would produce a file that
 * contradicts itself. A semantic import classifies; it never silently discards.
 *
 * The counts are here because a UI wants a headline it can render without
 * walking a list; {@link notes} is here because a headline is not a product
 * surface. Neither derives from the other — an import may carry a hundred
 * fragments and have three worth naming — so both are stated.
 */
export interface InterchangeReport {
  /** Nodes that became a drawn, editable artefact. */
  mapped: number;
  /** Nodes kept verbatim on the nearest mapped element, invisible on canvas. */
  carried: number;
  /** Nodes kept but deliberately not re-emitted. */
  quarantined: number;
  /** Which ones, and why. Empty is a claim: nothing was worth naming. */
  notes: readonly InterchangeNote[];
  /**
   * The format version actually read — `'2.0'`, a mermaid release (P2, as
   * amended). Absent when the source declared none, which is itself a fact
   * about the file rather than a gap in the reader.
   */
  sourceVersion?: string;
}

/** What the caller tells an exporter about the document it is producing. */
export interface InterchangeExportContext {
  /**
   * Names the produced document and the file it is offered as — the board's own
   * title. A capability writes a name, it does not go looking for one: the
   * caller reads the title, this says what to do with it.
   *
   * Making it safe to write to disk is the CAPABILITY's job, not the caller's,
   * because the answer is the format's — which characters, which cap, which
   * extension. Pass the raw title. Note the consequence, which is inherited and
   * not introduced here: the sanitized name is also what lands as the
   * document's own name INSIDE the file, so a board titled `Order/to cash` is
   * named `Order-to cash` in the XML as well as on the download.
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
  /**
   * What the WRITER could not say, one line each, in the user's words. Absent
   * when the board came out whole, which is the usual case.
   *
   * Not a three-way classification — an exporter has nothing foreign to sort,
   * which is why {@link InterchangeReport} is the importer's alone. But an
   * export loses things too: a board can hold sentences the format has no way
   * to write down, and the user who clicked Export is the one person entitled
   * to be told. Warnings are never errors — the file is valid and the export
   * succeeded.
   */
  warnings?: readonly string[];
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

/** Everything a capability declares that does not depend on its direction. */
export interface InterchangeCapabilityBase {
  /**
   * `${framework}:${format.id}:${direction}` — unique, and the DI key. Build it
   * with {@link interchangeCapabilityId} rather than by hand.
   */
  id: string;
  /** `'bpmn'`, `'wardley'`, `'c4'` — the framework that owns the vocabulary. */
  framework: string;
  format: InterchangeFormat;
}

/**
 * One direction of one format for one framework.
 *
 * A UNION discriminated on `direction`, so `run` is the function that direction
 * means and nothing else. This is what makes the triple structural rather than
 * a naming convention: `InterchangeExtension` can refuse an id that lies about
 * its three fields, but only the type system can refuse an importer handed over
 * as an export — no runtime check can tell two functions apart by looking. It
 * also means a caller that has narrowed on `direction` calls `run` directly,
 * with no cast, which is the difference between a registry and a bag.
 */
export type InterchangeCapability =
  | (InterchangeCapabilityBase & {
      direction: 'export';
      /** The pure function. See P3 — this is the whole contract. */
      run: InterchangeExporter;
    })
  | (InterchangeCapabilityBase & {
      direction: 'import';
      /** The pure function. See P3 — this is the whole contract. */
      run: InterchangeImporter;
    });

/** Narrowed by direction, for a caller that asked the registry for one. */
export type InterchangeExportCapability = Extract<
  InterchangeCapability,
  { direction: 'export' }
>;
export type InterchangeImportCapability = Extract<
  InterchangeCapability,
  { direction: 'import' }
>;

/** The separator the triple is built from, and therefore reserved in its parts. */
const ID_SEPARATOR = ':';

/** The one way to spell a capability's id. */
export function interchangeCapabilityId(
  framework: string,
  formatId: string,
  direction: InterchangeDirection
): string {
  return `${framework}${ID_SEPARATOR}${formatId}${ID_SEPARATOR}${direction}`;
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
 * The id is checked against the triple it claims to be, its parts are checked
 * for the separator that would let two different triples mint one key, and the
 * DI container refuses a second capability under the same id. All three
 * refusals are loud and all three are deliberate: a registry whose keys can lie
 * or collide answers the question "what can Labre read" with something other
 * than the truth, and that question is the only reason this registry exists.
 *
 * They fire at container setup — at boot, or in any test that mounts — never
 * mid-session, and never on a capability built with
 * {@link interchangeCapabilityId}.
 */
export function InterchangeExtension(
  capabilities: readonly InterchangeCapability[]
): ExtensionType {
  return {
    setup: di => {
      for (const capability of capabilities) {
        // Checked BEFORE the triple is minted from them: `('a', 'b:c')` and
        // `('a:b', 'c')` mint the same key, and the id would agree with itself.
        // Without this, that surfaces as an opaque DI collision instead of the
        // sentence this function already knows how to write.
        for (const [field, value] of [
          ['framework', capability.framework],
          ['format.id', capability.format.id],
        ] as const) {
          if (value.includes(ID_SEPARATOR)) {
            throw new Error(
              `Interchange ${field} "${value}" contains "${ID_SEPARATOR}", which separates the parts of a capability id.`
            );
          }
        }

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
 *
 * Asking for a direction returns that direction's capabilities, typed: a caller
 * that queried for exporters gets `run`s it can call, not a union it must
 * narrow a second time by hand.
 */
export function interchangeCapabilities(
  provider: ServiceProvider,
  query: InterchangeQuery & { direction: 'export' }
): InterchangeExportCapability[];
export function interchangeCapabilities(
  provider: ServiceProvider,
  query: InterchangeQuery & { direction: 'import' }
): InterchangeImportCapability[];
export function interchangeCapabilities(
  provider: ServiceProvider,
  query?: InterchangeQuery
): InterchangeCapability[];
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
