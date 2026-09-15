import { describe, expect, it } from 'vitest';

import { serializeDocument } from '../xml';
import {
  decodeXmlText,
  readXml,
  serializeXmlNode,
  xmlAttr,
  xmlChild,
  xmlChildren,
  xmlDescendants,
  xmlFragmentOf,
  xmlNamespaces,
} from '../xml-reader';

/**
 * The tolerant XML reader.
 *
 * ## Two things are being checked, and only one of them is parsing
 *
 * The first is ordinary: a well-formed document comes back as the tree it is.
 * The second is the one the importer depends on — **it never throws**. Every
 * malformation below is a real file somebody has handed a tool: a truncated
 * export, a close tag that names the wrong element, a `&` in a name, an
 * attribute nobody quoted. Each one has to produce a tree AND a note, because
 * the alternative is an import that says "not well-formed XML" and drops a
 * model the user can see in a text editor.
 *
 * There is no `DOMParser` anywhere in this file, and that is deliberate: the
 * reader has no DOM, so the spec needs no environment.
 */

describe('readXml — a well-formed document', () => {
  it('reads elements, attributes, prefixes and text', () => {
    const { root, roots, notes } = readXml(
      `<?xml version="1.0" encoding="UTF-8"?>
       <uml:Model xmlns:uml="http://www.omg.org/spec/UML/20161101" name="M">
         <packagedElement xmi:type="uml:Class" xmi:id="_3" name="Order"/>
         <ownedComment body="a note"><body>prose</body></ownedComment>
       </uml:Model>`
    );

    expect(notes).toEqual([]);
    expect(roots).toHaveLength(1);
    expect(root?.name).toBe('uml:Model');
    expect(root?.prefix).toBe('uml');
    expect(root?.local).toBe('Model');
    expect(root?.children).toHaveLength(2);

    const classifier = root!.children[0];
    expect(classifier.local).toBe('packagedElement');
    expect(classifier.attrs['xmi:type']).toBe('uml:Class');
    expect(xmlAttr(classifier, 'id')).toBe('_3');
    expect(classifier.text).toBeUndefined();

    expect(xmlChild(root!, 'ownedComment')?.children[0].text).toBe('prose');
  });

  it('keeps the prefix and still answers by local name', () => {
    // The whole reason `xmlAttr` is prefix-insensitive: three tools, three
    // spellings of one attribute, one model.
    const papyrus = readXml(`<uml:Class xmi:id="_1" name="A"/>`).root!;
    const ancient = readXml(`<UML:Class XMI:id="_1" name="A"/>`).root!;
    const plain = readXml(`<Class id="_1" name="A"/>`).root!;

    for (const node of [papyrus, ancient, plain]) {
      expect(xmlAttr(node, 'id')).toBe('_1');
      expect(node.local).toBe('Class');
    }
    // …and the file's own spelling is still there, verbatim.
    expect(Object.keys(ancient.attrs)).toEqual(['XMI:id', 'name']);
  });

  it('decodes the five named entities and any numeric reference', () => {
    expect(decodeXmlText('a &lt; b &amp;&amp; c &gt; d')).toBe(
      'a < b && c > d'
    );
    expect(decodeXmlText('two&#10;lines')).toBe('two\nlines');
    expect(decodeXmlText('&#x2039;&#x203A;')).toBe('‹›');
    // Unknown, and therefore left exactly as written: resolving it would need a
    // DTD the file does not ship, and dropping it would lose a character.
    expect(decodeXmlText('a&nbsp;b')).toBe('a&nbsp;b');
    // Out of Unicode's range — the one input that could have thrown.
    expect(decodeXmlText('&#9999999999;')).toBe('&#9999999999;');
  });

  it('skips comments, processing instructions and the doctype', () => {
    const { root, notes } = readXml(
      `<!DOCTYPE model [<!ENTITY x "y">]>
       <!-- a note > with markup in it -->
       <model><?target data?><a/></model>`
    );
    expect(notes).toEqual([]);
    expect(root?.local).toBe('model');
    expect(root?.children.map(child => child.local)).toEqual(['a']);
  });

  it('reads CDATA as the characters it holds, unescaped', () => {
    const { root } = readXml(`<body><![CDATA[a < b &amp; c]]></body>`);
    expect(root?.text).toBe('a < b &amp; c');
  });

  it('keeps every namespace declaration, by prefix', () => {
    const { root } = readXml(
      `<uml:Model xmlns="urn:default" xmlns:uml="urn:uml" xmlns:xmi="urn:xmi"/>`
    );
    expect(xmlNamespaces(root!)).toEqual({
      '': 'urn:default',
      uml: 'urn:uml',
      xmi: 'urn:xmi',
    });
  });

  it('finds children by local name and descendants at any depth', () => {
    const { root } = readXml(`<p><a id="1"/><b><a id="2"/></b><a id="3"/></p>`);
    expect(xmlChildren(root!, 'a').map(node => node.attrs['id'])).toEqual([
      '1',
      '3',
    ]);
    expect(xmlDescendants(root!).map(node => node.local)).toEqual([
      'a',
      'b',
      'a',
      'a',
    ]);
  });
});

describe('readXml — verbatim, which is what quarantine means', () => {
  const source = `<root>
  <keep a="1">
    <!-- a hand-written comment -->
    <inner b="2">text &amp; more</inner>
  </keep>
</root>`;

  it('hands back the source’s own bytes for any element', () => {
    const { root } = readXml(source);
    const fragment = xmlFragmentOf(source, root!.children[0]);
    // The comment, the indentation, the attribute order: all of it, because
    // none of it was ever taken apart (ADR 0012 D1's "verbatim").
    expect(fragment).toContain('<!-- a hand-written comment -->');
    expect(fragment).toContain('text &amp; more');
    expect(fragment.startsWith('<keep a="1">')).toBe(true);
    expect(fragment.endsWith('</keep>')).toBe(true);
  });

  it('re-serializes from the tree when there is no source to slice', () => {
    const { root } = readXml(`<a x="1&amp;2"><b/>text</a>`);
    // Round-trips through the reader, which is the property that matters: what
    // this writes, this reads back the same.
    const written = serializeXmlNode(root!);
    const again = readXml(written).root!;
    expect(again.attrs['x']).toBe('1&2');
    expect(again.text).toBe('text');
    expect(again.children.map(node => node.local)).toEqual(['b']);
  });

  it('reads back everything `xml.ts` writes', () => {
    // The two halves of the pair, checked against each other rather than
    // against a literal: the writer escapes a newline in an attribute as
    // `&#10;` because XML 1.0 §3.3.3 makes it the only form that survives, and
    // this reader is what has to bring it back.
    const written = serializeDocument({
      name: 'uml:Model',
      attrs: { name: 'two\nlines', 'xmi:id': '_1' },
      children: [
        { name: 'ownedComment', attrs: { body: 'a & b < c' }, children: [] },
      ],
    });
    const { root, notes } = readXml(written);
    expect(notes).toEqual([]);
    expect(xmlAttr(root!, 'name')).toBe('two\nlines');
    expect(xmlAttr(root!.children[0], 'body')).toBe('a & b < c');
  });
});

describe('readXml — tolerance, and it never throws', () => {
  it('reads a document that stops in the middle', () => {
    const { root, notes } = readXml(`<a><b name="x"><c/>`);
    expect(root?.local).toBe('a');
    expect(root?.children[0].children[0].local).toBe('c');
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.join(' ')).toContain('never closed');
  });

  it('keeps an element a stray close tag cut short', () => {
    const { root, notes } = readXml(`<a><b><c/></a>`);
    // `<b>` lost its tag; it did not lose its child.
    expect(root?.children.map(node => node.local)).toEqual(['b']);
    expect(root?.children[0].children.map(node => node.local)).toEqual(['c']);
    expect(notes.join(' ')).toContain('closed by </a>');
  });

  it('ignores a close tag that opens nothing', () => {
    const { root, notes } = readXml(`<a></b></a>`);
    expect(root?.local).toBe('a');
    expect(notes.join(' ')).toContain('never opened');
  });

  it('reads an unquoted and a valueless attribute', () => {
    const { root, notes } = readXml(`<a width=120 isAbstract><b/></a>`);
    expect(root?.attrs).toEqual({ width: '120', isAbstract: '' });
    expect(root?.children).toHaveLength(1);
    expect(notes).toHaveLength(2);
  });

  it('reads a bare "<" as the character it is', () => {
    const { root, notes } = readXml(`<a>1 < 2</a>`);
    expect(root?.text).toBe('1 < 2');
    expect(notes.join(' ')).toContain('starts no tag');
  });

  it('returns nothing, and no exception, for what is not XML at all', () => {
    for (const source of ['', '   ', 'not xml', '{"json": true}']) {
      const document = readXml(source);
      expect(document.root).toBeUndefined();
      expect(document.roots).toEqual([]);
    }
  });

  it('keeps every top-level element of a concatenated file', () => {
    const { roots, root } = readXml(`<a/><b/>`);
    expect(roots.map(node => node.local)).toEqual(['a', 'b']);
    expect(root?.local).toBe('a');
  });
});
