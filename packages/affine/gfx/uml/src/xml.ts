/**
 * A minimal XML tree, and the two escapes that make it safe to write.
 *
 * Sixty lines rather than a dependency, and rather than an import from
 * `gfx/bpmn`: BPMN's writer carries verbatim FRAGMENTS an importer handed it
 * (the foreign-matter contract of `docs/adr/0012` D1), and that unescaped node
 * is the one thing in its tree that must never be constructible from a string
 * nobody serialized. UML writes no fragments — it has no importer yet — so its
 * tree has no such node, and sharing the module would mean sharing an escape
 * hatch this writer has no use for. A copy of eight obvious functions is the
 * cheaper half of that trade.
 *
 * Pure: strings in, strings out, no `std`, no DOM (`DOMParser` appears only in
 * the SPECS, where it checks that what we wrote actually parses).
 */

/** Attribute values, `undefined` meaning "do not write this attribute". */
export type XmlAttrs = Record<string, string | number | boolean | undefined>;

export interface XmlElement {
  name: string;
  attrs: XmlAttrs;
  children: XmlElement[];
  /** Text content. Mutually exclusive with {@link children} in practice. */
  text?: string;
}

/** An element with attributes and children. */
export function el(
  name: string,
  attrs: XmlAttrs = {},
  children: XmlElement[] = []
): XmlElement {
  return { name, attrs, children };
}

/** An element whose content is character data. */
export function textEl(
  name: string,
  text: string,
  attrs: XmlAttrs = {}
): XmlElement {
  return { name, attrs, children: [], text };
}

/**
 * Character DATA — the three characters that would otherwise start markup.
 *
 * A newline, a tab and a carriage return are left exactly as they are, which is
 * what makes a multi-line note body faithful: inside an element, whitespace is
 * content.
 */
export function escapeText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/**
 * An attribute VALUE, which needs strictly more than character data does.
 *
 * The quotes are the obvious half. The other half loses data silently: XML 1.0
 * §3.3.3 makes every conformant parser replace a literal `#xA`, `#xD` or `#x9`
 * in an attribute value with a SPACE before anyone sees it —
 * attribute-value normalization, and it is not optional. Only a character
 * reference survives it.
 *
 * That matters here because a multi-line label is ordinary on this canvas (it is
 * how a class name fits in its box) and `name` is where nearly all of them go:
 * every classifier, every operation, every comment `body`. Written raw, a
 * two-line note comes back as one line, with no warning and no way for the
 * author to tell. Written as `&#10;` it comes back as it went in.
 */
export function escapeAttr(value: string): string {
  return escapeText(value)
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
    .replaceAll('\n', '&#10;')
    .replaceAll('\r', '&#13;')
    .replaceAll('\t', '&#9;');
}

/**
 * One element and everything under it, indented.
 *
 * Attribute ORDER is insertion order, which is what makes a golden test a
 * readable diff rather than a hash: the writer builds `xmi:type` then `xmi:id`
 * then `name` on every element, so two runs of the same model are the same
 * bytes.
 */
export function serializeElement(node: XmlElement, indent = ''): string {
  const attrs = Object.entries(node.attrs)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ` ${key}="${escapeAttr(String(value))}"`)
    .join('');

  if (node.text !== undefined) {
    return `${indent}<${node.name}${attrs}>${escapeText(node.text)}</${node.name}>`;
  }
  if (node.children.length === 0) {
    return `${indent}<${node.name}${attrs}/>`;
  }
  const inner = node.children
    .map(child => serializeElement(child, `${indent}  `))
    .join('\n');
  return `${indent}<${node.name}${attrs}>\n${inner}\n${indent}</${node.name}>`;
}

/**
 * A whole document: the prolog, the root, and a trailing newline.
 *
 * The encoding is DECLARED rather than assumed. An XMI file is handed to tools
 * that read bytes off a disk with no HTTP header to tell them anything, and the
 * default for an undeclared document is UTF-8 only by the XML spec's good
 * grace — several readers in this space guess the platform codepage instead,
 * and a `«interface»` that arrives as mojibake is a keyword that has stopped
 * meaning anything.
 */
export function serializeDocument(root: XmlElement): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serializeElement(root)}\n`;
}
