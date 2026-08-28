import type {
  InterchangeImportContext,
  InterchangeImportResult,
  InterchangeNote,
  SerializedElementProps,
} from '@labre/affine-block-surface';
import {
  ConnectorMode,
  FontFamily,
  PointStyle,
  ShapeStyle,
  StrokeStyle,
  TextAlign,
} from '@labre/affine-model';
import type { ForeignInterchange } from '@labre/std/gfx';

import { WARDLEY_BACKGROUND } from './background.js';
import {
  OWM_DEFAULT_MAP_HEIGHT,
  OWM_DEFAULT_MAP_WIDTH,
  OWM_LABEL_HEIGHT,
  OWM_LABEL_WIDTH,
  OWM_SCOPE,
  OWM_TAIL_ATTR,
  OWM_KEYWORDS,
  OWM_TITLE_ATTR,
  owmDefaultPlot,
  owmPointOf,
  WARDLEY_OWM_FORMAT_ID,
} from './export.js';
import {
  HANDLE_SIZE,
  LABEL_GAP,
  LABEL_FONT_SIZE,
  LINK_GREY,
  LINK_STROKE_WIDTH,
  MARKET_DOT_RING,
  MARKET_DOT_SIZE,
  MARKET_DOT_STROKE_WIDTH,
  MARKET_LINK_COLOR,
  MARKET_LINK_WIDTH,
  MARKET_SIZE,
  ECOSYSTEM_SIZE,
  NODE_FILL,
  NODE_SIZE,
  NODE_STROKE,
  NODE_STROKE_WIDTH,
  PIPELINE_FILL,
  PIPELINE_HEIGHT,
  WARDLEY_RED,
} from './node/consts.js';
import { WARDLEY_ROLE } from './roles.js';

/**
 * An OnlineWardleyMaps (OWM) DSL document, read as a Wardley map — the inverse
 * of `export.ts` on the vocabulary Labre draws, and an honest accounting of
 * everything else (`docs/adr/0012`, D1–D6).
 *
 * ADR 0012 calls this row **the reference Wardley import**, and says why: the
 * OWM DSL is the one Wardley vocabulary that is settled, so it is what a user
 * should be pointed at while mermaid's Wardley diagram type is still
 * experimental upstream.
 *
 * ## Pure by construction, like its mirror
 *
 * A string in, element PROPS out. No `BlockStdScope`, no surface, no DOM, no
 * clock, no randomness — and, unlike `.bpmn`, no parser either: the DSL is
 * line-based, so this reads lines. The caller does the writing (P3).
 *
 * ## What the caller owes, and it is one thing
 *
 * **OWM has no ids: the NAME is the identity.** So every element below carries
 * the name it was declared under, verbatim, in `interchange.owm.id`, and a link
 * arrives with `source` / `target` naming those — which is exactly the map
 * `materializeInterchangeImport` folds the returned array into (D3). Nothing
 * else is needed to finish the import, and the same fold is what makes
 * `boardFromProps` in the spec suite a bridge rather than a mock.
 *
 * A name declared twice is imported twice — nothing is dropped — and every link
 * naming it means the FIRST, which is both the materializer's rule and OWM's
 * own. The report says so by name.
 *
 * ## Where the coordinates come from, and where they do not (D4)
 *
 * A `[visibility, evolution]` pair IS the authoritative position — that is D4's
 * "a format that carries coordinates but no pixels" — so the reader projects it
 * onto the plot of the map it lays down and re-layouts nothing. A statement
 * that carries NO pair inverts the same rule rather than contradicting it:
 * there is nothing to be authoritative, so the reader lays one out and SAYS SO,
 * with an `invented-layout` note naming the artefact. **An invented axis is
 * never presented as read from the file.** That is the whole of D4 for a
 * coordinate format, and it is the case `anchor Client` — one line of the
 * tea-shop corpus, and the shape half the maps in the wild are written in.
 *
 * ## Three states, and the middle one is where the file survives
 *
 * **Mapped** is what the pack draws: `component`, `anchor`, `market`,
 * `ecosystem`, `pipeline`, `note`, `evolve`, `title`, and the `->` links.
 * **Carried** is every other statement — `style`, `annotation`, `attitudes`
 * (`pioneers` / `settlers` / `townplanners`), `submap`, `url`, `size`,
 * `accelerator`, the axis-label overrides, the flow links (`+>`, `+<`, `+<>`,
 * `+'…'>`), a link carrying a `;` context, and every `//` comment — kept
 * verbatim in `interchange.owm.children['@document']` on the map's background
 * element (D6) and written back, in order, at the end of the next export.
 * **Quarantined** is empty, and that is a finding rather than an omission: see
 * the loss table.
 *
 * A mapped line keeps its own tail too — `label [12, -8]`, `(build)`,
 * `inertia`, a trailing comment — under `attrs['@self'].tail` on the artefact
 * it belongs to, so the modifiers this pack does not draw come back on the
 * line they were written on rather than at the bottom of the file.
 *
 * ## The loss table
 *
 * Every semantic capability owes one (ADR 0012), and this is the OWM DSL's.
 * INVISIBLE is not LOST, and the distinction is the deliverable.
 *
 * | what                                                                   | state       | after a round trip                                                                                                     |
 * | ---------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
 * | `component` / `anchor` / `market` / `ecosystem` and their coordinates  | mapped      | drawn, and written back from the drawing, to two decimals                                                              |
 * | the NAME, which in this format is the identity                        | mapped      | given back verbatim, quoted exactly as it needs to be — the fixed point                                                |
 * | `pipeline Name [m1, m2]`                                              | mapped      | drawn as the body + handle composite; `[m1, m2]` written back from the body's two edges                                |
 * | `note Text [v, e]`                                                    | mapped      | a free text on the map, written back from its centre                                                                   |
 * | `evolve X [-> Y] m`                                                   | mapped      | an evolved twin at the same height plus a change arrow, written back from the arrow                                    |
 * | `A->B` links                                                          | mapped      | a `wardley:dependency` connector, consumer → what it needs, never inverted                                             |
 * | `title`                                                               | mapped      | consumed as the board's own name; written back from the board's name (see the two rows below)                          |
 * | a mapped line's TAIL — `label [x, y]`, `(build)`, `inertia`, comments | carried     | invisible on the canvas, re-appended to the very line it came off                                                      |
 * | `style`, `annotation(s)`, `attitudes`, `submap`, `url`, `size`, `accelerator`, the axis-label overrides | carried | invisible on the canvas, re-emitted verbatim at the end of the file          |
 * | flow links (`+>`, `+<`, `+<>`, `+'…'>`) and a link with a `;` context | carried     | not drawn — a flow is not a dependency — and re-emitted verbatim                                                       |
 * | a `pipeline` with a `{ … }` body                                      | carried     | the block is kept whole and written back whole; the pack draws no pipeline children                                    |
 * | `//` comments                                                         | carried     | re-emitted verbatim, at the end                                                                                        |
 * | anything else the reader does not recognise                           | carried     | re-emitted verbatim, at the end                                                                                        |
 * | **nothing**                                                           | quarantined | every statement this format writes is a standalone sentence, so nothing carried can contradict the drawing (D5)        |
 * | a statement with NO coordinates (`anchor Client`)                     | **lost**    | the reader places it at the reference default (0.9, 0.1) and says so; the export then writes the coordinates we invented, not the silence the file had |
 * | a statement with MALFORMED coordinates                                | **lost**    | same, and the report carries a `warning` as well as the `invented-layout` note                                         |
 * | a statement positioned on ONE axis (`[0.5]`, `[nonsense, 0.5]`)       | **half mapped, half lost** | the axis the file gave is read and kept exactly; the other takes the reference default and gets its own `invented-layout` note naming WHICH axis was invented. The statement counts as `mapped` — it was positioned — and the export writes a full pair, so the axis the file left silent comes back as a number |
 * | the file's own line ORDER and its blank lines                         | **lost**    | the writer groups statements into sections. Nothing semantic depends on it, and carrying blank lines would make an untouched Labre file report a carried count |
 * | a `pipeline`'s visibility                                             | **lost**    | OWM derives it from the component of the same name; the reader places the body under that component and the writer does not write it back |
 * | an `evolve` twin drawn at a different height                          | **lost**    | `evolve` moves along the evolution axis only; the export warns                                                          |
 * | a Labre `method` node (build / buy / outsource)                       | **lost**    | written as a plain component — OWM says a method with a decorator this writer cannot tell apart. The export warns       |
 * | the file's `title`                                                    | **carried**, and it WINS | kept under `attrs['@document'].title` and written back in preference to the name the caller passes — D3's precedence, the same one `interchange.<fmt>.id` has on every element. A board renamed in Labre therefore still exports under the title its file carried, and the export warns that it did; the caller's name is used only when the file carried none (and is still what the DOWNLOAD is called either way) |
 * | surface identity across a re-import                                   | **lost**    | a new map beside the old one, never a merge                                                                            |
 * | a name whose whitespace matters (`Foo&nbsp;&nbsp;&nbsp;Bar`)          | **round-trips here, at risk elsewhere** | this reader keeps a name VERBATIM and this writer gives it back verbatim, so Labre → Labre is exact. onlinewardleymaps does not: `normalizeComponentName` collapses whitespace runs before it matches a link end to a component, so a map that goes Labre → OWM → Labre may come back with its links dangling. Not sanitized here, because sanitizing would lose the author's name to protect another tool's matcher |
 * | a top-level `market` / `ecosystem` statement                          | **round-trips here, refused elsewhere** | Labre reads and writes both. The reference `Converter` registers no strategy for either keyword, so such a line reaches `LinksExtractionStrategy`, has no `->` in it and is recorded as a PARSE ERROR — onlinewardleymaps does not merely fail to draw it. The interoperable spelling is a component carrying the decorator (`component Suppliers [0.3, 0.7] (market)`), which this pair already round-trips through the carried tail |
 *
 * `sourceVersion` reports the DIALECT, because the DSL declares no version: the
 * OnlineWardleyMaps frontend's own extraction strategies, which is what this
 * reader was written against. It reads `DSL (Labre)` for a file holding nothing
 * this library does not itself write — the honest form of "a file we wrote",
 * since the format has no marker to claim one with.
 */

/* ── The format, re-exported so both halves agree ─────────────────────── */

export { WARDLEY_OWM_FORMAT_ID, OWM_SCOPE };

/** The dialect this reader implements, and how a Labre-shaped file reads. */
const OWM_DIALECT = 'DSL';
const OWM_DIALECT_LABRE = 'DSL (Labre)';

/* ── Reading one line ─────────────────────────────────────────────────── */

/** A quoted value and what follows it. */
function readQuoted(raw: string): { value: string; rest: string } {
  let index = 1;
  let value = '';
  while (index < raw.length) {
    const char = raw[index];
    if (char === '\\' && index + 1 < raw.length) {
      value += raw[index] + raw[index + 1];
      index += 2;
      continue;
    }
    if (char === '"')
      return { value: unescapeName(value), rest: raw.slice(index + 1) };
    value += char;
    index += 1;
  }
  // No closing quote: OWM recovers rather than refusing, and so does this.
  return { value: unescapeName(value), rest: '' };
}

/** OWM's `unescapeComponentNameFromMapText`, minus the quote stripping. */
function unescapeName(raw: string): string {
  return raw
    .replaceAll('\\n', '\n')
    .replaceAll('\\r', '\r')
    .replaceAll('\\t', '\t')
    .replaceAll('\\"', '"')
    .replaceAll('\\]', ']')
    .replaceAll('\\[', '[')
    .replaceAll('\\\\', '\\');
}

/** A name (quoted or bare) and what follows it, in a keyword statement. */
function readName(raw: string): { name: string; rest: string } {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith('"')) {
    const { value, rest } = readQuoted(trimmed);
    return { name: value, rest };
  }
  // Bare: the name runs up to the coordinate bracket, exactly as OWM's own
  // `setName` splits it. A statement that opens straight on `[` has no name.
  if (trimmed.startsWith('[')) return { name: '', rest: trimmed };
  const spaced = trimmed.indexOf(' [');
  if (spaced !== -1) {
    return {
      name: trimmed.slice(0, spaced).trim(),
      rest: trimmed.slice(spaced),
    };
  }
  // `component Kettle[0.1, 0.2]`, with no space before the bracket. OWM's own
  // `setName` splits on `' ['` and therefore keeps `Kettle[0.1, 0.2]` whole as
  // the name, while `extractLocation` splits on a bare `[` and reads the pair
  // anyway — so the file IS positioned, and only the name comes out wrong.
  // Splitting on the bare bracket maps the statement the way the coordinates
  // say it was meant, which beats both inventing a layout and keeping OWM's
  // own mangled name.
  const tight = trimmed.indexOf('[');
  if (tight !== -1) {
    return { name: trimmed.slice(0, tight).trim(), rest: trimmed.slice(tight) };
  }
  return { name: trimmed.trim(), rest: '' };
}

/**
 * OWM's own defaults for an axis a statement did not give
 * (`extractLocation`, `constants/extractionFunctions.ts`). Used rather than a
 * layout of our own, so an artefact this reader places without coordinates
 * lands where the tool that wrote the file would have drawn it.
 */
export const OWM_DEFAULT_VISIBILITY = 0.9;
export const OWM_DEFAULT_EVOLUTION = 0.1;

/** One coordinate bracket, read per AXIS, plus everything after it VERBATIM. */
interface Bracket {
  /** Whether the statement had a `[...]` at all. */
  present: boolean;
  /** `undefined` for an axis the bracket did not give a readable number for. */
  visibility?: number;
  evolution?: number;
  tail: string;
}

/**
 * Read `[v, e]` the way `extractLocation` reads one — PER AXIS.
 *
 * The per-axis reading is not pedantry, it is what the reference parser does:
 * `[0.5]` is a legal pair whose second member falls back to the default, and so
 * is `[nonsense, 0.5]`. Reading the bracket as all-or-nothing would invent a
 * layout for a statement the file had positioned on one axis, and D4 forbids
 * presenting an invented axis as read from the file — so the two axes are
 * tracked separately all the way to the note.
 */
function readBracket(raw: string): Bracket {
  const match = /^\s*\[([^\]]*)\]/.exec(raw);
  if (!match) return { present: false, tail: raw };
  const tail = raw.slice(match[0].length);
  const [visibility, evolution] = match[1]
    .split(',')
    .map(part => Number.parseFloat(part.trim()))
    .map(value => (Number.isFinite(value) ? value : undefined));
  return { present: true, visibility, evolution, tail };
}

/**
 * A maturity, the way OWM spells one — and it always has a decimal point.
 *
 * The reference regex is `/\s[0-9]?\.[0-9]+[0-9]?/` (`setNameWithMaturity`), so
 * a bare integer is NOT a maturity there. Accepting `0` and `1` here looked
 * harmless and was not: `evolve Tier 1 0.75` would take `1` as the maturity and
 * `Tier` as the name, so the component the line is about is one nobody
 * declared — the twin and its arrow then vanish on the next export. Names
 * ending in a digit are ordinary (`Tier 1`, `Wave 0`, `Region 1`).
 */
const MATURITY = String.raw`[0-9]*\.[0-9]+`;
/**
 * `<anything> <maturity>[ <tail>]`. The `.*?` is lazy, so the FIRST
 * maturity-shaped token ends the name and everything after it is the tail —
 * which is the reference reader's own behaviour (`element.match(...)` returns
 * the first hit).
 */
const BEFORE_MATURITY = new RegExp(String.raw`^(.*?)(\s+${MATURITY})(\s.*)?$`);
const LEADING_MATURITY = new RegExp(String.raw`^\s*(${MATURITY})`);

/* ── The statements a document is made of ─────────────────────────────── */

/** The keywords that declare a positioned artefact, and the kind each is. */
const NODE_KEYWORDS = {
  component: 'component',
  anchor: 'anchor',
  market: 'market',
  ecosystem: 'ecosystem',
} as const;

type NodeKeyword = keyof typeof NODE_KEYWORDS;

interface NodeStatement {
  keyword: NodeKeyword;
  name: string;
  visibility: number;
  evolution: number;
  tail: string;
  invented: boolean;
}

interface PipelineStatement {
  name: string;
  from: number;
  to: number;
  tail: string;
  invented: boolean;
}

interface NoteStatement {
  text: string;
  visibility: number;
  evolution: number;
  tail: string;
  invented: boolean;
}

interface EvolveStatement {
  name: string;
  becomes: string;
  evolution: number;
  tail: string;
  invented: boolean;
}

interface LinkStatement {
  from: string;
  to: string;
}

/* ── The reader ───────────────────────────────────────────────────────── */

/**
 * An OWM document as element props, plus what became of every line.
 *
 * @param source the file, verbatim.
 * @param context the caller's name for it, used only if the file names nothing.
 */
export function importWardleyOwm(
  source: string,
  context: InterchangeImportContext = {}
): InterchangeImportResult {
  const lines = source.split(/\r?\n/);

  const notes: InterchangeNote[] = [];
  const carriedLines: string[] = [];
  /** How many lines of each construct were carried — one note per kind. */
  const carriedKinds = new Map<string, number>();

  const nodeStatements: NodeStatement[] = [];
  const pipelines: PipelineStatement[] = [];
  const noteStatements: NoteStatement[] = [];
  const evolutions: EvolveStatement[] = [];
  const links: LinkStatement[] = [];
  let title: string | undefined;
  /** Whether a LINE of the file put it there — only that one is `mapped`. */
  let titledByFile = false;

  const carry = (line: string, kind: string) => {
    carriedLines.push(line);
    carriedKinds.set(kind, (carriedKinds.get(kind) ?? 0) + 1);
  };

  const inventedNote = (element: string, name: string, why: string) => {
    notes.push({
      kind: 'invented-layout',
      sourceId: name,
      element,
      message: why,
    });
  };

  /**
   * Where one positioned statement goes, and what the report owes for it (D4).
   *
   * Three outcomes, and the middle one is the reason this is per-axis. A
   * statement with NO bracket is laid out whole and declared. One whose bracket
   * this reader cannot make a single number of is the same, plus a `warning`,
   * because the file said something and we could not read it. And one that
   * positioned ONE axis — `[0.5]`, or `[nonsense, 0.5]`, both of which the
   * reference parser accepts and defaults the rest of — is MAPPED at the
   * coordinate it gave, with a note naming the axis it did not. An invented
   * axis is never presented as read from the file, and that is true of half a
   * pair as much as of a whole one.
   */
  const placeOf = (
    bracket: Bracket,
    element: string,
    name: string,
    lineIndex: number
  ): { visibility: number; evolution: number; invented: boolean } => {
    const { visibility, evolution } = bracket;
    const place = {
      visibility: visibility ?? OWM_DEFAULT_VISIBILITY,
      evolution: evolution ?? OWM_DEFAULT_EVOLUTION,
    };

    if (visibility !== undefined && evolution !== undefined) {
      return { ...place, invented: false };
    }

    if (visibility === undefined && evolution === undefined) {
      if (bracket.present) {
        notes.push({
          kind: 'warning',
          sourceId: name,
          element,
          message: `line ${lineIndex + 1} declares coordinates this reader cannot make a number of, so they were not used.`,
        });
      }
      inventedNote(
        element,
        name,
        bracket.present
          ? 'its coordinates were unreadable, so it was placed where a map with no coordinates places things. The file did not say where it goes.'
          : 'the file gives it no coordinates, so it was placed where a map with no coordinates places things. The file did not say where it goes.'
      );
      return { ...place, invented: true };
    }

    inventedNote(
      element,
      name,
      visibility === undefined
        ? 'the file positions it on the evolution axis only, so its place on the value chain is this reader’s and not the file’s.'
        : 'the file positions it on the value chain only, so its place on the evolution axis is this reader’s and not the file’s.'
    );
    return { ...place, invented: false };
  };

  /**
   * Inside a `/* … *​/` block, where every line is a comment.
   *
   * The reference reader strips these in `Converter.stripComments` BEFORE any
   * strategy sees the text, so a commented-out `component` is not a component
   * there. Tracking the state here is what makes that true of this reader too:
   * carrying only the opening line and then parsing the body would put an
   * artefact on the canvas that the file's author had switched off, which is a
   * worse failure than losing it — it is a drawing nobody made.
   */
  let insideBlockComment = false;

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();

    if (insideBlockComment) {
      carry(raw, 'comment');
      if (line.includes('*/')) insideBlockComment = false;
      continue;
    }
    if (line.length === 0) continue;

    if (line.startsWith('//')) {
      carry(raw, 'comment');
      continue;
    }
    if (line.startsWith('/*')) {
      carry(raw, 'comment');
      // A one-line block (`/* … */`) opens and closes on the same line.
      if (!line.includes('*/', 2)) insideBlockComment = true;
      continue;
    }

    /* `title` — consumed as the board's own name. */
    if (line.startsWith('title ')) {
      // FIRST wins, matching OWM's own reader, which returns on the first hit.
      if (title === undefined) {
        title = line.slice('title '.length).trim();
        titledByFile = true;
      } else carry(raw, 'title');
      continue;
    }

    /* The four positioned artefacts. */
    const keyword = (Object.keys(NODE_KEYWORDS) as NodeKeyword[]).find(word =>
      line.startsWith(`${word} `)
    );
    if (keyword !== undefined) {
      const { name, rest } = readName(line.slice(keyword.length + 1));
      const bracket = readBracket(rest);
      const named = name || `${keyword} ${index + 1}`;
      const place = placeOf(bracket, keyword, named, index);
      nodeStatements.push({
        keyword,
        name: named,
        visibility: place.visibility,
        evolution: place.evolution,
        tail: bracket.tail,
        invented: place.invented,
      });
      continue;
    }

    /* `pipeline` — the plain form is drawn; a `{ … }` body is carried whole. */
    if (line.startsWith('pipeline ')) {
      const block = blockAfter(lines, index);
      if (block !== undefined) {
        for (let at = index; at <= block; at += 1) carriedLines.push(lines[at]);
        carriedKinds.set(
          'pipeline{}',
          (carriedKinds.get('pipeline{}') ?? 0) + (block - index + 1)
        );
        index = block;
        continue;
      }
      const { name, rest } = readName(line.slice('pipeline '.length));
      const bracket = readBracket(rest);
      // A pipeline's bracket is a SPAN, not a position, so it defaults as a
      // span does (`setPipelineMaturity`) and only a whole one is usable: half
      // a span is not a narrower pipeline.
      const usable =
        bracket.visibility !== undefined && bracket.evolution !== undefined;
      const named = name || `pipeline ${index + 1}`;
      pipelines.push({
        name: named,
        from: usable ? bracket.visibility! : 0.2,
        to: usable ? bracket.evolution! : 0.8,
        tail: bracket.tail,
        invented: !usable,
      });
      if (!usable) {
        inventedNote(
          'pipeline',
          named,
          'the file gives it no span, so it was drawn across the default one. The file did not say how wide it is.'
        );
      }
      continue;
    }

    /* `note` — a free text at a position. */
    if (line.startsWith('note ')) {
      const { name, rest } = readName(line.slice('note '.length));
      const bracket = readBracket(rest);
      const place = placeOf(bracket, 'note', name, index);
      noteStatements.push({
        text: name,
        visibility: place.visibility,
        evolution: place.evolution,
        tail: bracket.tail,
        invented: place.invented,
      });
      continue;
    }

    /* `evolve` — a twin, and the arrow that says it is moving. */
    if (line.startsWith('evolve ')) {
      const parsed = readEvolve(line.slice('evolve '.length));
      evolutions.push(parsed);
      if (parsed.invented) {
        inventedNote(
          'evolve',
          parsed.name,
          'the line names no maturity to evolve to, so the default was used. The file did not say where it is going.'
        );
      }
      continue;
    }

    /* A link, or something this reader has no sentence for. */
    const opener = firstWord(line);
    // A statement is never a link, whatever arrows it holds. `evolution
    // Genesis->Custom->Product->Commodity` renames the evolution axis and would
    // otherwise arrive as two dependencies between components nobody declared —
    // which is why OWM's own `LinksExtractionStrategy` carries the same refusal
    // list. The `{` / `}` of a pipeline body get the same treatment.
    const reserved =
      OWM_KEYWORDS.has(opener) || line.startsWith('{') || line.startsWith('}');
    const flow = ['+>', "+'", '+<'].find(marker => line.includes(marker));
    if (!reserved && flow !== undefined) {
      carry(raw, 'flow link');
      continue;
    }
    const arrow = reserved ? -1 : line.indexOf('->');
    if (arrow >= 0) {
      if (line.includes(';')) {
        // A link with a context. The context is a sentence on the edge and this
        // pack draws none, so the whole statement is kept rather than half of it.
        carry(raw, 'link with a context');
        continue;
      }
      links.push({
        from: readLinkEnd(line.slice(0, arrow)),
        to: readLinkEnd(line.slice(arrow + 2)),
      });
      continue;
    }

    carry(raw, opener);
  }

  // The caller's name for what it handed over, used ONLY when the file names
  // nothing itself — a file that carries its own title always wins, because an
  // import states what the file says and never what the caller wished it said.
  // The extension goes: `tea-shop.owm` is what the file is CALLED, and the map
  // it holds is called `tea-shop`.
  if (title === undefined && context.name !== undefined) {
    const named = context.name.replace(/\.(owm|wm)$/i, '').trim();
    if (named.length > 0) title = named;
  }

  /* ── One note per carried CONSTRUCT, never one per line ───────────── */

  for (const [kind, count] of carriedKinds) {
    notes.push({
      kind: 'carried',
      element: kind,
      message: `${count} \`${kind}\` line${count === 1 ? '' : 's'} kept verbatim on the map and written back on the next export. Nothing on this canvas draws ${count === 1 ? 'it' : 'them'}.`,
    });
  }

  /* ── A name declared twice ────────────────────────────────────────── */

  const declared = new Set<string>();
  for (const statement of nodeStatements) {
    if (declared.has(statement.name)) {
      notes.push({
        kind: 'warning',
        sourceId: statement.name,
        element: statement.keyword,
        message:
          'this name is declared more than once. Both artefacts are on the map, and every link naming it means the first — OWM identifies a component by its name.',
      });
    }
    declared.add(statement.name);
  }

  /* ── A link naming something nobody declared ──────────────────────── */

  /**
   * D1's third state, applied to the one construct that can dangle.
   *
   * A link is the only statement in this DSL whose meaning depends on OTHER
   * statements: it names two components by name, and a name nothing declares
   * resolves to nothing. `materializeInterchangeImport` leaves such an endpoint
   * exactly as the file wrote it, which keeps the DOCUMENT honest — but the
   * connector then routes to an empty path and is INVISIBLE on the canvas. So a
   * file with a typo in it imported as `mapped: 2, notes: []`: two artefacts
   * drawn, one arrow silently missing, and a report claiming nothing was lost.
   *
   * One note per dangling END rather than per link, because a link with two of
   * them has two problems and an architect fixing the file needs both names.
   */
  for (const link of links) {
    for (const end of [link.from, link.to]) {
      if (end.length === 0) {
        notes.push({
          kind: 'warning',
          element: 'link',
          message:
            'a link names nothing on one of its ends, so the arrow it asks for runs to no artefact and is invisible on the canvas.',
        });
        continue;
      }
      if (declared.has(end)) continue;
      notes.push({
        kind: 'warning',
        sourceId: end,
        element: 'link',
        message:
          'a link names this, and no statement in the file declares it. The arrow is in the document and runs to no artefact, so it is invisible on the canvas.',
      });
    }
  }

  /* ── Laying it out ────────────────────────────────────────────────── */

  const plot = owmDefaultPlot();
  const elements: SerializedElementProps[] = [];

  /** The place a name was declared at, for the statements that reference one. */
  const declaredAt = new Map<
    string,
    { visibility: number; evolution: number }
  >();
  for (const statement of nodeStatements) {
    // FIRST wins, matching the materializer's own rule for a duplicated name
    // and OWM's: a pipeline or an `evolve` naming it means the first one.
    if (!declaredAt.has(statement.name)) {
      declaredAt.set(statement.name, {
        visibility: statement.visibility,
        evolution: statement.evolution,
      });
    }
  }

  /** Handles the reader mints so a composite's own wiring resolves (D3). */
  const minted = new Set<string>();
  const mintHandle = (stem: string) => {
    let candidate = stem;
    let suffix = 1;
    while (declared.has(candidate) || minted.has(candidate)) {
      suffix += 1;
      candidate = `${stem} #${suffix}`;
    }
    minted.add(candidate);
    return candidate;
  };

  /* The map itself, always first, and where the document's residue rides. */
  const mapPayload: ForeignInterchange = {};
  if (title !== undefined) {
    mapPayload.attrs = { [OWM_SCOPE.document]: { [OWM_TITLE_ATTR]: title } };
  }
  if (carriedLines.length > 0) {
    mapPayload.children = { [OWM_SCOPE.document]: carriedLines };
  }
  elements.push({
    type: WARDLEY_BACKGROUND.type,
    role: WARDLEY_BACKGROUND.role,
    resizeEnabled: WARDLEY_BACKGROUND.geometry.resizable,
    variant: 'classic',
    xywh: `[0,0,${OWM_DEFAULT_MAP_WIDTH},${OWM_DEFAULT_MAP_HEIGHT}]`,
    ...(Object.keys(mapPayload).length > 0
      ? { interchange: { [WARDLEY_OWM_FORMAT_ID]: mapPayload } }
      : {}),
  });

  for (const statement of nodeStatements) {
    const [cx, cy] = owmPointOf(
      plot,
      statement.visibility,
      statement.evolution
    );
    elements.push(
      ...artefact(
        statement.keyword,
        statement.name,
        cx,
        cy,
        statement.tail,
        mintHandle
      )
    );
  }

  for (const pipeline of pipelines) {
    const at = declaredAt.get(pipeline.name);
    if (at === undefined) {
      inventedNote(
        'pipeline',
        pipeline.name,
        'no component of this name is declared, so the pipeline was drawn halfway up the value chain. OWM takes a pipeline’s height from the component it belongs to.'
      );
    }
    const visibility = at?.visibility ?? 0.5;
    const [left] = owmPointOf(plot, visibility, pipeline.from);
    const [right, y] = owmPointOf(plot, visibility, pipeline.to);
    // Under the component it belongs to, the way OWM draws it.
    const top = y + NODE_SIZE;
    const width = Math.max(right - left, 1);
    const centre = left + width / 2;

    elements.push({
      type: 'wardleyNode',
      kind: 'pipeline',
      role: WARDLEY_ROLE.pipeline,
      shapeType: 'rect',
      filled: true,
      fillColor: PIPELINE_FILL,
      strokeColor: NODE_STROKE,
      strokeWidth: NODE_STROKE_WIDTH,
      shapeStyle: ShapeStyle.General,
      roughness: 0,
      radius: 0,
      xywh: `[${left},${top},${width},${PIPELINE_HEIGHT}]`,
      interchange: payload({ id: pipeline.name, tail: pipeline.tail }),
    });
    elements.push({
      type: 'wardleyNode',
      kind: 'handle',
      role: WARDLEY_ROLE.handle,
      shapeType: 'rect',
      filled: true,
      fillColor: NODE_FILL,
      strokeColor: NODE_STROKE,
      strokeWidth: NODE_STROKE_WIDTH,
      shapeStyle: ShapeStyle.General,
      roughness: 0,
      radius: 0,
      xywh: `[${centre - HANDLE_SIZE / 2},${top - HANDLE_SIZE / 2},${HANDLE_SIZE},${HANDLE_SIZE}]`,
      interchange: payload({
        id: mintHandle(`${pipeline.name} handle`),
        element: 'pipeline',
      }),
    });
    elements.push(
      label(
        pipeline.name,
        centre - OWM_LABEL_WIDTH / 2,
        top - LABEL_GAP - OWM_LABEL_HEIGHT,
        TextAlign.Center
      )
    );
  }

  for (const note of noteStatements) {
    const [cx, cy] = owmPointOf(plot, note.visibility, note.evolution);
    elements.push({
      type: 'text',
      text: note.text,
      fontFamily: FontFamily.Inter,
      fontSize: LABEL_FONT_SIZE,
      color: NODE_STROKE,
      textAlign: TextAlign.Left,
      xywh: `[${cx - OWM_LABEL_WIDTH / 2},${cy - OWM_LABEL_HEIGHT / 2},${OWM_LABEL_WIDTH},${OWM_LABEL_HEIGHT}]`,
      ...(note.tail.trim().length > 0
        ? { interchange: payload({ tail: note.tail }) }
        : {}),
    });
  }

  /** The twin an `evolve` line draws, and the handle its arrow points at. */
  const twinHandles: string[] = [];
  for (const evolution of evolutions) {
    const at = declaredAt.get(evolution.name);
    if (at === undefined) {
      inventedNote(
        'evolve',
        evolution.name,
        'no component of this name is declared, so its evolved twin was laid out halfway up the value chain. The file did not say where it sits.'
      );
    }
    const visibility = at?.visibility ?? 0.5;
    const [cx, cy] = owmPointOf(plot, visibility, evolution.evolution);
    const handle = mintHandle(`evolve ${evolution.name}`);
    twinHandles.push(handle);

    elements.push({
      type: 'wardleyNode',
      kind: 'component',
      role: WARDLEY_ROLE.component,
      shapeType: 'ellipse',
      filled: true,
      fillColor: NODE_FILL,
      strokeColor: WARDLEY_RED,
      strokeWidth: 2,
      shapeStyle: ShapeStyle.General,
      roughness: 0,
      xywh: `[${cx - NODE_SIZE / 2},${cy - NODE_SIZE / 2},${NODE_SIZE},${NODE_SIZE}]`,
      // `element: 'evolve'` is what says this id is a HANDLE the reader minted
      // so the arrow below can find its end, and not something the file said —
      // OWM has no id for a twin, and D3 forbids inventing one that pretends
      // otherwise. The writer never reads it: an `evolve` line is written from
      // the arrow and the twin's own name.
      interchange: payload({
        id: handle,
        element: 'evolve',
        tail: evolution.tail,
      }),
    });
    elements.push(
      label(
        evolution.becomes,
        cx + NODE_SIZE / 2 + LABEL_GAP,
        cy - OWM_LABEL_HEIGHT / 2,
        TextAlign.Left,
        WARDLEY_RED
      )
    );
  }

  evolutions.forEach((evolution, index) => {
    elements.push({
      type: 'connector',
      mode: ConnectorMode.Straight,
      role: WARDLEY_ROLE.changeArrow,
      stroke: WARDLEY_RED,
      strokeStyle: StrokeStyle.Dash,
      strokeWidth: LINK_STROKE_WIDTH,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.Triangle,
      source: { id: evolution.name },
      target: { id: twinHandles[index] },
    });
  });

  for (const link of links) {
    elements.push({
      type: 'connector',
      mode: ConnectorMode.Straight,
      // The value-chain link. `source` is the CONSUMER and `target` is what it
      // needs — the verb of `wardley:dependency` (ADR 0010), which is exactly
      // what `A->B` says in this DSL. Never inverted.
      role: WARDLEY_ROLE.dependency,
      stroke: LINK_GREY,
      strokeStyle: StrokeStyle.Solid,
      strokeWidth: LINK_STROKE_WIDTH,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.None,
      source: { id: link.from },
      target: { id: link.to },
    });
  }

  /* ── The report ───────────────────────────────────────────────────── */

  const mapped =
    (titledByFile ? 1 : 0) +
    nodeStatements.length +
    pipelines.length +
    noteStatements.length +
    evolutions.length +
    links.length;

  return {
    elements,
    report: {
      mapped,
      carried: carriedLines.length,
      // Nothing. Every statement this format writes is a standalone sentence,
      // so a carried one cannot contradict the drawing — which is what D5's
      // quarantine is FOR. Stated here rather than left to be inferred from a
      // zero: a format with no quarantine case is a finding about the format.
      quarantined: 0,
      notes,
      sourceVersion:
        carriedLines.length === 0 && notes.length === 0
          ? OWM_DIALECT_LABRE
          : OWM_DIALECT,
    },
  };
}

/* ── The pieces ───────────────────────────────────────────────────────── */

/** The `interchange` value for an element, or `undefined` when it carries none. */
function payload(parts: {
  id?: string;
  element?: string;
  tail?: string;
}): Record<string, ForeignInterchange> | undefined {
  const carried: ForeignInterchange = {};
  if (parts.id !== undefined) carried.id = parts.id;
  if (parts.element !== undefined) carried.element = parts.element;
  if (parts.tail !== undefined && parts.tail.trim().length > 0) {
    carried.attrs = { [OWM_SCOPE.self]: { [OWM_TAIL_ATTR]: parts.tail } };
  }
  if (Object.keys(carried).length === 0) return undefined;
  return { [WARDLEY_OWM_FORMAT_ID]: carried };
}

/** A name, as the free text element this canvas writes one as. */
function label(
  text: string,
  x: number,
  y: number,
  textAlign: TextAlign,
  color = NODE_STROKE
): SerializedElementProps {
  return {
    type: 'text',
    text,
    // The role is the whole of what tells W3 this text is a NAME and not a
    // remark somebody wrote on the map — and it is what the writer matches on.
    role: WARDLEY_ROLE.label,
    color,
    fontFamily: FontFamily.Inter,
    fontSize: LABEL_FONT_SIZE,
    textAlign,
    xywh: `[${x},${y},${OWM_LABEL_WIDTH},${OWM_LABEL_HEIGHT}]`,
  };
}

/** The circle (or composite) one positioned statement draws, plus its name. */
function artefact(
  keyword: NodeKeyword,
  name: string,
  cx: number,
  cy: number,
  tail: string,
  mintHandle: (stem: string) => string
): SerializedElementProps[] {
  const diameter =
    keyword === 'anchor'
      ? OWM_ANCHOR_SIZE
      : keyword === 'market'
        ? MARKET_SIZE
        : keyword === 'ecosystem'
          ? ECOSYSTEM_SIZE
          : NODE_SIZE;

  const circle: SerializedElementProps = {
    type: 'wardleyNode',
    kind: NODE_KEYWORDS[keyword],
    role: WARDLEY_ROLE[NODE_KEYWORDS[keyword]],
    shapeType: 'ellipse',
    filled: true,
    fillColor: NODE_FILL,
    strokeColor: NODE_STROKE,
    strokeWidth: NODE_STROKE_WIDTH,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    xywh: `[${cx - diameter / 2},${cy - diameter / 2},${diameter},${diameter}]`,
    interchange: payload({ id: name, tail }),
  };

  const named = label(
    name,
    cx + diameter / 2 + LABEL_GAP,
    cy - OWM_LABEL_HEIGHT / 2,
    TextAlign.Left
  );

  if (keyword !== 'market') return [circle, named];

  // A market is a COMPOSITE on this canvas: the outer circle plus three inner
  // dots wired into a triangle (`createWardleyMarket`). The dots and their
  // connectors are the glyph's own wiring — they carry no role, so no rule
  // measures them and the writer ignores them — but the connectors still have
  // to find their ends, so each dot gets a minted handle (see `mintHandle`).
  const ring = MARKET_DOT_RING;
  const sin60 = Math.sqrt(3) / 2;
  const vertices: [number, number][] = [
    [0, -ring],
    [ring * sin60, ring / 2],
    [-ring * sin60, ring / 2],
  ];
  const handles = vertices.map((_, index) =>
    mintHandle(`${name} market ${index + 1}`)
  );
  const dots: SerializedElementProps[] = vertices.map(([dx, dy], index) => ({
    type: 'wardleyNode',
    kind: 'component',
    shapeType: 'ellipse',
    filled: true,
    fillColor: NODE_FILL,
    strokeColor: NODE_STROKE,
    strokeWidth: MARKET_DOT_STROKE_WIDTH,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    xywh: `[${cx + dx - MARKET_DOT_SIZE / 2},${cy + dy - MARKET_DOT_SIZE / 2},${MARKET_DOT_SIZE},${MARKET_DOT_SIZE}]`,
    interchange: payload({ id: handles[index], element: 'market' }),
  }));
  const triangle: SerializedElementProps[] = [
    [0, 1],
    [1, 2],
    [2, 0],
  ].map(([from, to]) => ({
    type: 'connector',
    mode: ConnectorMode.Straight,
    source: { id: handles[from] },
    target: { id: handles[to] },
    stroke: MARKET_LINK_COLOR,
    strokeStyle: StrokeStyle.Solid,
    strokeWidth: MARKET_LINK_WIDTH,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.None,
  }));

  return [circle, ...dots, ...triangle, named];
}

/** The anchor circle `templates/maps.ts` draws — a person, and larger for it. */
const OWM_ANCHOR_SIZE = 24;

/** One end of a link, unquoted the way OWM unquotes one. */
function readLinkEnd(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 1) {
    return unescapeName(trimmed.slice(1, -1));
  }
  return trimmed;
}

/** The first word of a line, which is what names the construct it is. */
function firstWord(line: string): string {
  const match = /^[A-Za-z_][\w-]*/.exec(line);
  return match ? match[0] : 'unknown';
}

/**
 * The index of the `}` closing a `{ … }` block that opens after `from`, or
 * `undefined` when the statement has no block.
 *
 * OWM's own scan is this one: from the statement, forward, until either a `{`
 * (there is a block) or the next statement of the same keyword (there is not).
 */
function blockAfter(
  lines: readonly string[],
  from: number
): number | undefined {
  for (let index = from + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.length === 0) continue;
    if (!line.startsWith('{')) return undefined;
    for (let close = index; close < lines.length; close += 1) {
      if (lines[close].trim().includes('}')) return close;
    }
    // An unterminated block: everything after it belongs to it.
    return lines.length - 1;
  }
  return undefined;
}

/** `evolve X [-> Y] 0.85 [tail]`, as OWM's `setNameWithMaturity` reads one. */
function readEvolve(raw: string): EvolveStatement {
  let rest = raw.trimStart();
  let name: string;

  if (rest.startsWith('"')) {
    const quoted = readQuoted(rest);
    name = quoted.value;
    rest = quoted.rest;
  } else {
    const arrow = rest.indexOf('->');
    if (arrow >= 0) {
      name = rest.slice(0, arrow).trim();
      rest = rest.slice(arrow);
    } else {
      const match = BEFORE_MATURITY.exec(rest);
      if (match) {
        name = match[1].trim();
        rest = (match[2] ?? '') + (match[3] ?? '');
      } else {
        name = rest.trim();
        rest = '';
      }
    }
  }

  let becomes = name;
  rest = rest.trimStart();
  if (rest.startsWith('->')) {
    rest = rest.slice(2).trimStart();
    if (rest.startsWith('"')) {
      const quoted = readQuoted(rest);
      becomes = quoted.value;
      rest = quoted.rest;
    } else {
      const match = BEFORE_MATURITY.exec(rest);
      if (match) {
        becomes = match[1].trim();
        rest = (match[2] ?? '') + (match[3] ?? '');
      } else {
        becomes = rest.trim();
        rest = '';
      }
    }
  }

  const match = LEADING_MATURITY.exec(rest);
  return {
    name,
    becomes: becomes || name,
    // OWM's own default for an `evolve` that names no maturity.
    evolution: match ? Number.parseFloat(match[1]) : 0.85,
    tail: match ? rest.slice(match[0].length) : rest,
    invented: !match,
  };
}
