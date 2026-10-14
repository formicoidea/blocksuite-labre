import { describe, expect, it } from 'vitest';

import {
  readXmlElement,
  XML_NAMESPACE,
  XMLNS_NAMESPACE,
} from '../extensions/xml-element.js';
import { readXml, xmlDescendants } from '../extensions/xml-reader.js';

/**
 * The DOM-shaped view BPMN and the SVG sketch read instead of `DOMParser`
 * (ADR 0012, P3 as amended 2026-10-14), and the two things the reader gained
 * for it: content in document order and a conformant mode.
 *
 * Would have caught: a namespace resolved from the prefix's spelling instead
 * of its declaration (BPMN refuses a DMN file on the URI alone), text and
 * spans read out of order, an attribute named like an `Object.prototype`
 * member answering as present, and any walk that recurses on the depth of a
 * file — a hostile one is a hundred thousand deep and must cost a loop.
 */

describe('readXml content and conformant mode', () => {
  it('keeps text, children, comments and instructions in order', () => {
    const { root } = readXml(
      '<t>a<s>b</s><!--c--><?pi d e?>f<![CDATA[<g>]]></t>'
    );
    expect(
      root!.content!.map(entry =>
        'kind' in entry
          ? entry.kind === 'pi'
            ? `pi:${entry.target}:${entry.data}`
            : `${entry.kind}:${entry.value}`
          : `<${entry.name}>`
      )
    ).toEqual([
      'text:a',
      '<s>',
      'comment:c',
      'pi:pi:d e',
      'text:f',
      'text:<g>',
    ]);
  });

  it('normalizes attribute whitespace only when asked, and keeps a reference', () => {
    const source = '<a v="x\ty\r\nz&#10;w"/>';
    expect(readXml(source).root!.attrs.v).toBe('x\ty\r\nz\nw');
    expect(readXml(source, { conformant: true }).root!.attrs.v).toBe(
      'x y z\nw'
    );
  });

  it('notes a second top-level element only when conformant', () => {
    expect(readXml('<a/><b/>').notes).toEqual([]);
    expect(readXml('<a/><b/>', { conformant: true }).notes).toHaveLength(1);
  });

  it('expands nothing a DOCTYPE declares', () => {
    const { root, notes } = readXml(
      '<!DOCTYPE a [<!ENTITY e "boom">]><a v="&e;">&e;</a>'
    );
    expect(notes).toEqual([]);
    expect(root!.attrs.v).toBe('&e;');
    expect(root!.text).toBe('&e;');
  });

  it('gives an attribute named `__proto__` or `constructor` no prototype to hit', () => {
    const { root } = readXmlElement('<a __proto__="p" constructor="c"/>');
    expect(root!.getAttribute('__proto__')).toBe('p');
    expect(root!.getAttribute('constructor')).toBe('c');
    expect(root!.getAttribute('toString')).toBeNull();
    expect(root!.hasAttribute('hasOwnProperty')).toBe(false);
  });
});

describe('the element view', () => {
  it('resolves namespaces from their declarations, not their spelling', () => {
    const { root } = readXmlElement(
      '<m:a xmlns:m="urn:m" xmlns="urn:d" x:y="1" xml:space="preserve" xmlns:x="urn:x">' +
        '<b/><m:c/><d xmlns=""/><q:e/></m:a>'
    );
    expect(root!.namespaceURI).toBe('urn:m');
    expect(root!.localName).toBe('a');
    expect(root!.children.map(child => child.namespaceURI)).toEqual([
      'urn:d',
      'urn:m',
      null,
      // An unbound prefix resolves to nothing; it is never guessed.
      null,
    ]);
    const byName = Object.fromEntries(
      root!.attributes.map(attr => [attr.name, attr.namespaceURI])
    );
    expect(byName['x:y']).toBe('urn:x');
    expect(byName['xml:space']).toBe(XML_NAMESPACE);
    expect(byName['xmlns:m']).toBe(XMLNS_NAMESPACE);
  });

  it('answers textContent, parentElement and contains like the DOM', () => {
    const { root } = readXmlElement('<t>a<s>b<!--no--></s>c</t>');
    const span = root!.firstElementChild!;
    expect(root!.textContent).toBe('abc');
    expect(span.parentElement).toBe(root);
    expect(root!.contains(span)).toBe(true);
    expect(span.contains(root!)).toBe(false);
  });

  it('matches the compound selectors the readers write, and refuses the rest', () => {
    const { root } = readXmlElement(
      '<svg><g data-layer="nodes" id="n"><line class="hit-area x"/><line/></g>' +
        '<g data-id="a" data-kind="k"><text/></g><clipPath/></svg>'
    );
    const tags = (selector: string) =>
      root!.querySelectorAll(selector).map(element => element.localName);
    expect(tags('g[data-layer="nodes"]')).toEqual(['g']);
    expect(tags('line.hit-area, text')).toEqual(['line', 'text']);
    expect(tags('[data-id][data-kind]')).toEqual(['g']);
    expect(tags('#n')).toEqual(['g']);
    expect(tags('clipPath')).toEqual(['clipPath']);
    expect(tags('clippath')).toEqual([]);
    expect(root!.querySelector('rect')).toBeNull();
    expect(() => root!.querySelectorAll('g > line')).toThrow();
  });

  it('reads, views and walks a file 100 000 deep without recursing', () => {
    const depth = 100_000;
    const source = `${'<g>'.repeat(depth)}x${'</g>'.repeat(depth)}`;
    const document = readXml(source);
    expect(xmlDescendants(document.root!)).toHaveLength(depth - 1);
    const { root } = readXmlElement(source);
    expect(root!.descendants()).toHaveLength(depth - 1);
    expect(root!.textContent).toBe('x');
  }, 10_000);
});
