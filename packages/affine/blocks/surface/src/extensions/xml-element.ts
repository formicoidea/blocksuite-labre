import {
  readXml,
  type XmlDocument,
  type XmlNode,
  type XmlReadOptions,
} from './xml-reader.js';

/**
 * A read-only, DOM-SHAPED view over {@link readXml}'s tree, with namespaces
 * resolved — what the BPMN reader and the SVG sketch walk instead of a
 * `DOMParser` document (ADR 0012, P3 as amended 2026-10-14).
 *
 * Both readers were written against the DOM and read only a small part of it:
 * `localName`, `namespaceURI`, `attributes`, `getAttribute`, `children`,
 * `childNodes`, `textContent`, `parentElement` and a few compound selectors.
 * This class answers exactly that part, with the DOM's names and the DOM's
 * answers for an XML document (case-sensitive names, `null` for a missing
 * attribute or namespace), so the readers kept their logic and lost their
 * global. It is not a DOM: nothing here mutates, and a member a reader does
 * not use does not exist.
 *
 * Built with an explicit stack: the depth of a file is its author's choice.
 */

export const XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';
export const XMLNS_NAMESPACE = 'http://www.w3.org/2000/xmlns/';

/** One attribute, as the DOM's `Attr` names it. */
export interface XmlAttribute {
  /** The qualified name as written: `xlink:href`, `fill`. */
  name: string;
  prefix: string | null;
  localName: string;
  /** Resolved; `null` for an unprefixed attribute, as XML namespaces say. */
  namespaceURI: string | null;
  value: string;
}

/** Character data or a comment, as the DOM's `Text` / `Comment` show it. */
export interface XmlCharacterNode {
  /** 3 for text and CDATA, 8 for a comment, 7 for an instruction. */
  nodeType: 3 | 7 | 8;
  nodeValue: string;
}

/** `Node.ELEMENT_NODE`, spelled. */
const ELEMENT_NODE = 1;

/** One compound selector: `g[data-layer="x"]`, `line.hit-area`, `[id]`. */
interface Compound {
  type?: string;
  classes: string[];
  attrs: { name: string; value?: string }[];
}

const COMPOUND =
  /^([A-Za-z][\w-]*)?((?:[.#][\w-]+|\[[\w:-]+(?:="[^"]*")?\])*)$/;
const PART = /\.([\w-]+)|#([\w-]+)|\[([\w:-]+)(?:="([^"]*)")?\]/g;

/**
 * A selector list without combinators — the only shape the readers write.
 * Anything else is a programming error in a reader, and says so.
 */
function parseSelectors(selectors: string): Compound[] {
  return selectors.split(',').map(raw => {
    const text = raw.trim();
    const match = COMPOUND.exec(text);
    if (!match || text.length === 0) {
      throw new Error(`XmlElement does not support the selector "${text}"`);
    }
    const compound: Compound = { type: match[1], classes: [], attrs: [] };
    for (const part of (match[2] ?? '').matchAll(PART)) {
      if (part[1] !== undefined) compound.classes.push(part[1]);
      else if (part[2] !== undefined)
        compound.attrs.push({ name: 'id', value: part[2] });
      else compound.attrs.push({ name: part[3], value: part[4] });
    }
    return compound;
  });
}

export class XmlElement {
  readonly nodeType = ELEMENT_NODE;
  readonly children: XmlElement[] = [];
  readonly childNodes: (XmlElement | XmlCharacterNode)[] = [];

  constructor(
    /** The reader's node, for a caller that wants its range or its content. */
    readonly node: XmlNode,
    readonly parentElement: XmlElement | null,
    readonly namespaceURI: string | null,
    readonly attributes: XmlAttribute[]
  ) {}

  get localName(): string {
    return this.node.local;
  }

  get prefix(): string | null {
    return this.node.prefix === '' ? null : this.node.prefix;
  }

  /** The qualified name as written, which is what the DOM says for XML. */
  get nodeName(): string {
    return this.node.name;
  }

  get tagName(): string {
    return this.node.name;
  }

  get firstElementChild(): XmlElement | null {
    return this.children[0] ?? null;
  }

  /** Every text and CDATA under this element, in order; comments excluded. */
  get textContent(): string {
    const parts: string[] = [];
    const stack: (XmlElement | XmlCharacterNode)[] = [
      ...this.childNodes,
    ].reverse();
    while (stack.length > 0) {
      const next = stack.pop()!;
      if (next instanceof XmlElement) {
        for (let index = next.childNodes.length - 1; index >= 0; index -= 1) {
          stack.push(next.childNodes[index]);
        }
      } else if (next.nodeType === 3) {
        parts.push(next.nodeValue);
      }
    }
    return parts.join('');
  }

  /** By qualified name, exactly as written — the DOM's rule for XML. */
  getAttribute(name: string): string | null {
    // Own properties only: an attribute named `constructor` is a string, and
    // a missing one is never `Object.prototype`'s.
    return Object.hasOwn(this.node.attrs, name) ? this.node.attrs[name] : null;
  }

  hasAttribute(name: string): boolean {
    return Object.hasOwn(this.node.attrs, name);
  }

  get classList(): { contains(token: string): boolean } {
    const tokens = (this.getAttribute('class') ?? '').split(/\s+/);
    return { contains: token => tokens.includes(token) };
  }

  /** Is `other` this element or one of its descendants? */
  contains(other: XmlElement | null): boolean {
    for (let at = other; at; at = at.parentElement) {
      if (at === this) return true;
    }
    return false;
  }

  /** Every descendant (never this element), in document order. */
  descendants(): XmlElement[] {
    const found: XmlElement[] = [];
    const stack = [...this.children].reverse();
    while (stack.length > 0) {
      const next = stack.pop()!;
      found.push(next);
      for (let index = next.children.length - 1; index >= 0; index -= 1) {
        stack.push(next.children[index]);
      }
    }
    return found;
  }

  matches(selectors: string): boolean {
    return parseSelectors(selectors).some(compound => this.is(compound));
  }

  querySelectorAll(selectors: string): XmlElement[] {
    const list = parseSelectors(selectors);
    return this.descendants().filter(element =>
      list.some(compound => element.is(compound))
    );
  }

  querySelector(selectors: string): XmlElement | null {
    return this.querySelectorAll(selectors)[0] ?? null;
  }

  private is(compound: Compound): boolean {
    if (compound.type !== undefined && compound.type !== this.localName) {
      return false;
    }
    if (compound.classes.some(token => !this.classList.contains(token))) {
      return false;
    }
    return compound.attrs.every(({ name, value }) => {
      const actual = this.getAttribute(name);
      return actual !== null && (value === undefined || actual === value);
    });
  }
}

/**
 * The namespaces in scope during a depth-first walk, as one stack per prefix:
 * {@link enter} and {@link exit} cost the element's own declarations, and
 * {@link resolve} is one lookup. A copied map per declaring element was
 * quadratic: a root declaring 2 000 prefixes over thousands of
 * `<g xmlns:q="x"/>` took 28 s and 284 MiB (security review, 2026-10-14).
 */
export class XmlNamespaceScope {
  private readonly bound = new Map<string, string[]>([
    ['xml', [XML_NAMESPACE]],
  ]);

  enter(node: XmlNode): void {
    for (const [prefix, value] of declarationsOf(node)) {
      const stack = this.bound.get(prefix);
      if (stack) stack.push(value);
      else this.bound.set(prefix, [value]);
    }
  }

  exit(node: XmlNode): void {
    for (const [prefix] of declarationsOf(node)) this.bound.get(prefix)?.pop();
  }

  /** `null` when unbound — or undeclared by `xmlns=""` (Namespaces in XML §6.2). */
  resolve(prefix: string): string | null {
    const stack = this.bound.get(prefix);
    return stack?.at(-1) || null;
  }

  /** The node's attributes, resolved in this scope (entered first). */
  attributesOf(node: XmlNode): XmlAttribute[] {
    return Object.entries(node.attrs).map(([name, value]) => {
      const colon = name.indexOf(':');
      const prefix = colon < 0 ? null : name.slice(0, colon);
      const localName = colon < 0 ? name : name.slice(colon + 1);
      let namespaceURI: string | null = null;
      if (name === 'xmlns' || prefix === 'xmlns')
        namespaceURI = XMLNS_NAMESPACE;
      else if (prefix !== null) namespaceURI = this.resolve(prefix);
      return { name, prefix, localName, namespaceURI, value };
    });
  }
}

function* declarationsOf(node: XmlNode): Generator<[string, string]> {
  for (const name in node.attrs) {
    if (name === 'xmlns') yield ['', node.attrs[name]];
    else if (name.startsWith('xmlns:')) yield [name.slice(6), node.attrs[name]];
  }
}

/**
 * The element view of a node the reader produced, namespaces resolved from the
 * `xmlns` declarations on the way down (`xml` is bound, as XML says it is).
 * An unbound prefix resolves to `null`, which is what a reader then refuses or
 * ignores: this function never guesses a namespace.
 */
export function xmlElementOf(root: XmlNode): XmlElement {
  const scope = new XmlNamespaceScope();
  const make = (node: XmlNode, parent: XmlElement | null) => {
    scope.enter(node);
    return new XmlElement(
      node,
      parent,
      scope.resolve(node.prefix),
      scope.attributesOf(node)
    );
  };
  // A node assembled by hand has no `content`; its children are all it has.
  const frameOf = (node: XmlNode, element: XmlElement) => ({
    node,
    element,
    entries: node.content ?? node.children,
    index: 0,
  });

  const top = make(root, null);
  const stack = [frameOf(root, top)];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.index >= frame.entries.length) {
      scope.exit(frame.node);
      stack.pop();
      continue;
    }
    const entry = frame.entries[frame.index];
    frame.index += 1;
    const { element } = frame;
    if (!('kind' in entry)) {
      const child = make(entry, element);
      element.children.push(child);
      element.childNodes.push(child);
      stack.push(frameOf(entry, child));
    } else if (entry.kind === 'text') {
      element.childNodes.push({ nodeType: 3, nodeValue: entry.value });
    } else if (entry.kind === 'comment') {
      element.childNodes.push({ nodeType: 8, nodeValue: entry.value });
    } else {
      element.childNodes.push({ nodeType: 7, nodeValue: entry.data });
    }
  }
  return top;
}

/** {@link readXml}, then {@link xmlElementOf} on its first root. */
export function readXmlElement(
  source: string,
  options: XmlReadOptions = {}
): { document: XmlDocument; root: XmlElement | undefined } {
  const document = readXml(source, options);
  return {
    document,
    root: document.root ? xmlElementOf(document.root) : undefined,
  };
}
