/**
 * A tolerant XML READER — the inverse of `xml.ts`, and the one thing an
 * importer cannot do without.
 *
 * ## Why not `DOMParser`
 *
 * BPMN's reader calls it (`gfx/bpmn/src/import.ts`), and it is the right call
 * there: that parser has always run in a browser. This one must not. An
 * interchange parser is a PURE function of a string (`docs/adr/0012` P3) — the
 * same function an editor command, a unit test and labre-mcp all call — and
 * `DOMParser` is a DOM global that exists in exactly one of those three. A
 * reader that needs `happy-dom` to be loaded is a reader with an environment in
 * its signature.
 *
 * So: two hundred lines of scanner, and no global in sight.
 *
 * ## Tolerant, and what that costs
 *
 * **It never throws.** A file that stops mid-element, a close tag that names
 * the wrong element, an attribute with no quotes, an entity nobody declared —
 * every one of them produces a tree with a NOTE beside it rather than an
 * exception. That is not sloppiness, it is the job: the files this reader is
 * handed were written by Papyrus, StarUML, Enterprise Architect and a dozen
 * scripts, and a user who exported a model from one of them is entitled to get
 * back everything it said even when part of it is malformed. The alternative —
 * one exception for one stray `&` — imports nothing at all.
 *
 * What it does NOT do is pretend to be a conformant parser. There is no DTD, no
 * entity declaration, no namespace RESOLUTION (prefixes are kept exactly as the
 * file spelled them — see {@link XmlNode.prefix}), no attribute-value
 * normalization beyond the character references XML 1.0 §3.3.3 makes
 * mandatory. Every one of those is a feature an XMI file in the wild does not
 * use, and each would be a piece of surface with nothing behind it.
 *
 * ## Verbatim means the source's own bytes
 *
 * Every node records the byte RANGE it was read from ({@link XmlNode.range}),
 * and {@link xmlFragmentOf} hands back that slice of the original string. So a
 * quarantined fragment (ADR 0012 D5) is the file's own text — its comments, its
 * whitespace, its attribute order, its prefixes — and not this reader's opinion
 * of it. {@link serializeXmlNode} re-serializes from the tree instead, and is
 * the fallback for a node assembled rather than read.
 *
 * Pure: a string in, a tree out. No `std`, no DOM, no clock.
 */

/* ── The tree ─────────────────────────────────────────────────────────── */

/**
 * One element.
 *
 * `name` is the qualified name AS WRITTEN (`uml:Model`), with {@link prefix}
 * and {@link local} split out beside it, because an importer asks both
 * questions: the prefix is how a file says which vocabulary it means, and the
 * local name is the only half two tools reliably agree on — Papyrus writes
 * `uml:Class`, an older Enterprise Architect writes `UML:Class`, and a
 * namespace-defaulted file writes `Class`.
 */
export interface XmlNode {
  /** The qualified name, verbatim: `uml:Model`, `packagedElement`. */
  name: string;
  /** The prefix, `''` when the name carries none. */
  prefix: string;
  /** The local name — `Model`, `packagedElement`. */
  local: string;
  /** Attributes by qualified name, values entity-decoded, in document order. */
  attrs: Record<string, string>;
  children: XmlNode[];
  /**
   * The element's character data — text and CDATA, concatenated and decoded.
   *
   * Absent rather than `''` when the element holds nothing but whitespace and
   * children, which is what every element of an indented XMI document holds.
   * A `<body>` with prose in it has this; a `<packagedElement>` does not.
   */
  text?: string;
  /**
   * `[start, end)` in the SOURCE string — what {@link xmlFragmentOf} slices.
   *
   * `end` is the offset just past this element's close tag (or past `/>`). For
   * an element the file never closed it is the end of what was read, which is
   * the honest answer and keeps the slice well-formed enough to re-parse.
   */
  range: [number, number];
}

/** A document, and everything the reader had to complain about to read it. */
export interface XmlDocument {
  /** The first top-level element, or `undefined` for a document with none. */
  root?: XmlNode;
  /**
   * Every top-level element, in order.
   *
   * A well-formed document has exactly one. A file that has been concatenated,
   * truncated or hand-edited has none or several, and the reader says what it
   * found rather than deciding which one was meant.
   */
  roots: XmlNode[];
  /** One line each, in the user's words — see the header on tolerance. */
  notes: string[];
}

/* ── Entities ─────────────────────────────────────────────────────────── */

/** The five XML 1.0 §4.6 predefined entities, and nothing else. */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/**
 * Character data as its characters — the five named entities and any numeric
 * reference.
 *
 * An entity this reader does not know (`&nbsp;`, a DTD-declared one) is left
 * EXACTLY as it was written, unresolved and unannounced. Two reasons, and the
 * second is the one that matters: resolving it would need the DTD the file
 * does not ship, and dropping it would lose a character; leaving the reference
 * standing means a later re-serialization writes back what the file said, which
 * is the promise `xmlFragmentOf` makes and this keeps true for text as well.
 */
export function decodeXmlText(value: string): string {
  if (!value.includes('&')) return value;
  return value.replaceAll(
    /&(#x[0-9a-fA-F]+|#\d+|[A-Za-z][\w.-]*);/g,
    (match, reference: string) => {
      if (reference.startsWith('#')) {
        const hex = reference[1] === 'x' || reference[1] === 'X';
        const code = Number.parseInt(
          hex ? reference.slice(2) : reference.slice(1),
          hex ? 16 : 10
        );
        // Out of Unicode's range is a reference no character answers, and
        // `String.fromCodePoint` THROWS on one — which is the single place this
        // reader could have raised. It hands back the reference instead.
        return Number.isInteger(code) && code >= 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : match;
      }
      return NAMED_ENTITIES[reference] ?? match;
    }
  );
}

/* ── The scanner ──────────────────────────────────────────────────────── */

/** A name character, generously: XML's NameChar minus the exotic ranges. */
const NAME_CHAR = /[\w.:_\-À-￿]/;

/** The prefix and the local half of a qualified name. */
function splitName(name: string): { prefix: string; local: string } {
  const colon = name.indexOf(':');
  return colon < 0
    ? { prefix: '', local: name }
    : { prefix: name.slice(0, colon), local: name.slice(colon + 1) };
}

/** A node with no children and no text, ready to be filled. */
function nodeOf(name: string, start: number): XmlNode {
  const { prefix, local } = splitName(name);
  return {
    name,
    prefix,
    local,
    attrs: {},
    children: [],
    range: [start, start],
  };
}

/**
 * Read a document. Never throws; see the header.
 *
 * The scan is a single left-to-right pass with an explicit stack, which is what
 * makes the tolerance cheap: every recovery is "say what is wrong, and carry on
 * from the next `<`", and there is no recursion to unwind.
 */
export function readXml(source: string): XmlDocument {
  const notes: string[] = [];
  const roots: XmlNode[] = [];
  const stack: XmlNode[] = [];
  /** Character data accumulated for the element currently open. */
  const pending: string[] = [];
  let cursor = 0;

  /** Attach the text read since the last tag to whatever is open. */
  const flushText = () => {
    if (pending.length === 0) return;
    const text = pending.join('');
    pending.length = 0;
    const open = stack[stack.length - 1];
    if (!open) return;
    // Whitespace between two indented children is layout, not content, and an
    // element that held only that keeps no `text` at all — which is what lets a
    // caller ask `if (node.text)` and mean "the file wrote something here".
    if (!/\S/.test(text) && open.children.length > 0) return;
    if (!/\S/.test(text) && open.text === undefined) return;
    open.text = (open.text ?? '') + text;
  };

  const close = (node: XmlNode, end: number) => {
    node.range[1] = end;
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(node);
    else roots.push(node);
  };

  while (cursor < source.length) {
    const open = source.indexOf('<', cursor);
    if (open < 0) {
      pending.push(decodeXmlText(source.slice(cursor)));
      break;
    }
    if (open > cursor) pending.push(decodeXmlText(source.slice(cursor, open)));

    /* ── The four things that are not an element ─────────────────────── */

    if (source.startsWith('<!--', open)) {
      const end = source.indexOf('-->', open + 4);
      if (end < 0) {
        notes.push(
          'A comment in this file is never closed; the rest was read.'
        );
        break;
      }
      cursor = end + 3;
      continue;
    }
    if (source.startsWith('<![CDATA[', open)) {
      const end = source.indexOf(']]>', open + 9);
      if (end < 0) {
        notes.push('A CDATA section in this file is never closed.');
        pending.push(source.slice(open + 9));
        break;
      }
      // CDATA is character data with the escaping turned OFF, so it is pushed
      // raw: decoding it would resolve a `&amp;` the author wrote literally.
      pending.push(source.slice(open + 9, end));
      cursor = end + 3;
      continue;
    }
    if (source.startsWith('<?', open)) {
      const end = source.indexOf('?>', open + 2);
      if (end < 0) {
        notes.push('A processing instruction in this file is never closed.');
        break;
      }
      cursor = end + 2;
      continue;
    }
    if (source.startsWith('<!', open)) {
      // A DOCTYPE, with or without an internal subset. The subset is skipped
      // whole rather than parsed: this reader declares no entities, so what is
      // in there could only change how a `&name;` it cannot resolve is read.
      let scan = open + 2;
      let depth = 0;
      while (scan < source.length) {
        const char = source[scan];
        if (char === '[') depth += 1;
        else if (char === ']') depth -= 1;
        else if (char === '>' && depth <= 0) break;
        scan += 1;
      }
      cursor = Math.min(scan + 1, source.length);
      continue;
    }

    /* ── A close tag ─────────────────────────────────────────────────── */

    if (source.startsWith('</', open)) {
      const end = source.indexOf('>', open);
      if (end < 0) {
        notes.push('A close tag in this file is never finished.');
        break;
      }
      flushText();
      const name = source.slice(open + 2, end).trim();
      const depth = stack.findLastIndex(node => node.name === name);
      if (depth < 0) {
        notes.push(
          `</${name}> closes an element this file never opened; it was ignored.`
        );
      } else {
        // Everything still open INSIDE the element being closed is closed with
        // it, in order. `<a><b></a>` is a file that lost a tag, not a file with
        // no `<b>` in it, and the tree keeps the `<b>`.
        for (let index = stack.length - 1; index > depth; index -= 1) {
          const orphan = stack.pop()!;
          notes.push(
            `<${orphan.name}> is closed by </${name}> rather than by a tag of ` +
              `its own; it was read as far as it goes.`
          );
          close(orphan, open);
        }
        const node = stack.pop()!;
        close(node, end + 1);
      }
      cursor = end + 1;
      continue;
    }

    /* ── An open tag ─────────────────────────────────────────────────── */

    let scan = open + 1;
    while (scan < source.length && NAME_CHAR.test(source[scan])) scan += 1;
    const name = source.slice(open + 1, scan);
    if (name.length === 0) {
      // A bare `<` in character data — illegal, and every second hand-written
      // file has one. It is kept as the character it is.
      notes.push(
        'A "<" in this file starts no tag; it was read as a plain character.'
      );
      pending.push('<');
      cursor = open + 1;
      continue;
    }

    flushText();
    const node = nodeOf(name, open);

    /* ── Its attributes ──────────────────────────────────────────────── */

    let selfClosing = false;
    let tagEnd = source.length;
    while (scan < source.length) {
      while (scan < source.length && /\s/.test(source[scan])) scan += 1;
      if (scan >= source.length) break;
      if (source.startsWith('/>', scan)) {
        selfClosing = true;
        tagEnd = scan + 2;
        break;
      }
      if (source[scan] === '>') {
        tagEnd = scan + 1;
        break;
      }
      const attrStart = scan;
      while (scan < source.length && NAME_CHAR.test(source[scan])) scan += 1;
      const attrName = source.slice(attrStart, scan);
      if (attrName.length === 0) {
        // Something that is neither a name, a `>` nor whitespace. Skipped one
        // character at a time so the scan cannot stall on it.
        scan += 1;
        continue;
      }
      while (scan < source.length && /\s/.test(source[scan])) scan += 1;
      if (source[scan] !== '=') {
        // A valueless attribute — HTML's habit, not XML's. Recorded as the
        // empty string, which is what every tolerant reader does with one.
        notes.push(
          `The attribute "${attrName}" on <${name}> has no value; it was read ` +
            `as empty.`
        );
        node.attrs[attrName] = '';
        continue;
      }
      scan += 1;
      while (scan < source.length && /\s/.test(source[scan])) scan += 1;
      const quote = source[scan];
      let value = '';
      if (quote === '"' || quote === "'") {
        const end = source.indexOf(quote, scan + 1);
        if (end < 0) {
          notes.push(
            `The value of "${attrName}" on <${name}> is never closed; the ` +
              `rest of the file was read as its value.`
          );
          value = source.slice(scan + 1);
          scan = source.length;
        } else {
          value = source.slice(scan + 1, end);
          scan = end + 1;
        }
      } else {
        // Unquoted. Read to the next whitespace or tag end, which is the only
        // reading available and the one every tolerant parser agrees on.
        const start = scan;
        while (scan < source.length && !/[\s>/]/.test(source[scan])) scan += 1;
        value = source.slice(start, scan);
        notes.push(
          `The value of "${attrName}" on <${name}> is not quoted; it was read ` +
            `up to the next space.`
        );
      }
      node.attrs[attrName] = decodeXmlText(value);
    }

    if (tagEnd === source.length && !selfClosing && source[scan] !== '>') {
      notes.push(`<${name}> is never finished; the file stops inside its tag.`);
    }

    if (selfClosing) {
      close(node, tagEnd);
    } else {
      stack.push(node);
    }
    cursor = tagEnd;
  }

  flushText();

  // Whatever the file left open. Closed at the end of what there was, so the
  // tree holds every element the file named even when it stops mid-document.
  while (stack.length > 0) {
    const orphan = stack.pop()!;
    notes.push(`<${orphan.name}> is never closed; it was read to the end.`);
    close(orphan, source.length);
  }

  return { root: roots[0], roots, notes };
}

/* ── Getting back out ─────────────────────────────────────────────────── */

/**
 * The element's own bytes, from the string it was read from.
 *
 * This is what a quarantined fragment is (ADR 0012 D5): the file's text, not a
 * re-rendering of this reader's tree. Comments, attribute order, prefixes and
 * whitespace all survive, because none of them was ever taken apart.
 */
export function xmlFragmentOf(source: string, node: XmlNode): string {
  return source.slice(node.range[0], node.range[1]);
}

/** The three characters that would otherwise start markup. */
function escapeText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/** An attribute value — see `xml.ts`, whose escaping this mirrors exactly. */
function escapeAttr(value: string): string {
  return escapeText(value)
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
    .replaceAll('\n', '&#10;')
    .replaceAll('\r', '&#13;')
    .replaceAll('\t', '&#9;');
}

/**
 * A node back as XML, from the TREE rather than from the source.
 *
 * The fallback for a fragment that has no range to slice — one assembled by a
 * caller, or read out of a document this function's caller no longer holds. It
 * is faithful to what the tree records and therefore drops what the tree does
 * not: comments, processing instructions, and the file's own indentation.
 * Prefer {@link xmlFragmentOf} whenever the source string is still in hand.
 */
export function serializeXmlNode(node: XmlNode): string {
  const attrs = Object.entries(node.attrs)
    .map(([key, value]) => ` ${key}="${escapeAttr(value)}"`)
    .join('');
  const inner = [
    node.text === undefined ? '' : escapeText(node.text),
    ...node.children.map(child => serializeXmlNode(child)),
  ].join('');
  if (inner.length === 0) return `<${node.name}${attrs}/>`;
  return `<${node.name}${attrs}>${inner}</${node.name}>`;
}

/* ── Reading a tree ───────────────────────────────────────────────────── */

/** Children with this local name, whatever prefix the file gave them. */
export function xmlChildren(node: XmlNode, local: string): XmlNode[] {
  return node.children.filter(child => child.local === local);
}

/** The first child with this local name, if any. */
export function xmlChild(node: XmlNode, local: string): XmlNode | undefined {
  return node.children.find(child => child.local === local);
}

/**
 * An attribute by LOCAL name — `xmi:id`, `xmi:ID` and a bare `id` all answer.
 *
 * Prefix-insensitive on purpose, and it is the difference between reading three
 * tools and reading one: the XMI prefix is `xmi` by convention and by nothing
 * else, Enterprise Architect has shipped files under `XMI`, and an
 * attribute-defaulted file drops it altogether. The QUALIFIED name is still in
 * `attrs` for anything that needs it, and {@link xmlFragmentOf} still writes
 * back what the file said.
 *
 * The first match in document order wins, which only matters for a file that
 * spells the same attribute twice under two prefixes.
 */
export function xmlAttr(node: XmlNode, local: string): string | undefined {
  const direct = node.attrs[local];
  if (direct !== undefined) return direct;
  for (const [key, value] of Object.entries(node.attrs)) {
    if (splitName(key).local === local) return value;
  }
  return undefined;
}

/** Every `xmlns` / `xmlns:*` declaration on this element, by prefix (`''`). */
export function xmlNamespaces(node: XmlNode): Record<string, string> {
  const declarations: Record<string, string> = {};
  for (const [key, value] of Object.entries(node.attrs)) {
    if (key === 'xmlns') declarations[''] = value;
    else if (key.startsWith('xmlns:')) declarations[key.slice(6)] = value;
  }
  return declarations;
}

/** Every element under `node`, at any depth, in document order. */
export function xmlDescendants(node: XmlNode): XmlNode[] {
  return node.children.flatMap(child => [child, ...xmlDescendants(child)]);
}
