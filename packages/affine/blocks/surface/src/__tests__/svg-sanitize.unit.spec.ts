import { describe, expect, it } from 'vitest';

import { InterchangeImportError } from '../extensions/interchange.js';
import { isSafeSvgValue, MAX_SVG_DEPTH } from '../extensions/svg-sanitize.js';
import {
  parseSvgSketch,
  sanitizeSvg,
  SvgSketchNotebook,
} from '../extensions/svg-sketch.js';
import {
  SVG_SKETCH_ERROR_MALFORMED_XML,
  SVG_SKETCH_REMOVED,
  SVG_SKETCH_TOO_DEEP,
} from '../extensions/svg-sketch-translations.js';

/**
 * GUARD — the SVG allow-list (`svg-sanitize.ts`), which replaced DOMPurify on
 * a DOM so a server reads an `.svg` with no DOM installed (ADR 0012, P3 as
 * amended 2026-10-14).
 *
 * Security code: these specs pin that nothing executable or fetching comes
 * through, whatever spelling the file uses. Would have caught: an `on*`
 * handler, a `javascript:` or external `href`, a `<use>` or `<foreignObject>`,
 * an external `url(…)` in a paint or a style, a CSS escape hiding any of
 * those, or a vendor-namespaced element surviving; and a walk that recurses
 * on the depth of a file. The first file is the P0 import spike's
 * `hostile.svg` (`labre/docs/spikes/import-edge/fixtures/`), verbatim.
 */

const HOSTILE = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="400" height="300" viewBox="0 0 400 300" onload="globalThis.__hostile = 'onload'">
  <script>globalThis.__hostile = 'script'</script>
  <foreignObject x="0" y="0" width="200" height="50"><div xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="globalThis.__hostile='img'"/></div></foreignObject>
  <rect x="20" y="20" width="120" height="60" fill="#fde68a" stroke="#000" onclick="globalThis.__hostile='click'" />
  <text x="30" y="55">Hello &lt;script&gt;</text>
  <a xlink:href="javascript:globalThis.__hostile='href'"><rect x="200" y="20" width="80" height="60" fill="#bfdbfe" /></a>
  <image href="https://attacker.example/track.png" x="0" y="200" width="10" height="10" />
  <use href="https://attacker.example/sprite.svg#icon" x="300" y="200" />
  <rect x="20" y="120" width="120" height="60" style="fill:url(https://attacker.example/x.svg#p)" />
  <circle cx="300" cy="150" r="30" fill="#bbf7d0" stroke="#000" />
</svg>
`;

const svg = (body: string, attrs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;

/** Every attribute of every element of the sanitized tree, as `name=value`. */
function everything(source: string): string[] {
  const root = sanitizeSvg(source, new SvgSketchNotebook());
  return [root, ...root.descendants()].flatMap(element => [
    `<${element.nodeName}>`,
    ...element.attributes.map(attr => `${attr.name}=${attr.value}`),
  ]);
}

describe('the SVG allow-list', () => {
  it('draws the spike’s hostile file as five inert elements and names what it took', () => {
    const result = parseSvgSketch(HOSTILE, {});
    expect(result.elements).toHaveLength(5);
    expect(JSON.stringify(result)).not.toMatch(
      /onload|onclick|onerror|javascript:|attacker\.example/
    );
    const removed = result.report.notes
      .filter(note => note.messageKey === SVG_SKETCH_REMOVED[0])
      .map(note => note.messageParams?.name);
    expect(removed).toEqual(['script', 'foreignObject', 'use']);
    // The escaped text is text, and stays the text the file wrote.
    expect(JSON.stringify(result.elements)).toContain('Hello <script>');
  });

  it('keeps nothing executable or fetching in the sanitized tree', () => {
    const kept = everything(HOSTILE).join('\n');
    expect(kept).not.toMatch(
      /^on|javascript|attacker|<script>|<foreignObject>|<use>|<div>|<img>/m
    );
  });

  it('keeps a same-document reference and an inline raster, nothing else', () => {
    const kept = everything(
      svg(
        `<linearGradient id="g"/><rect fill="url(#g)" style="fill: url('#g')"/>` +
          `<a href="#g"><rect/></a><a href="https://x.example"><rect/></a>` +
          `<image href="data:image/png;base64,iVBORw0KGgo="/>` +
          `<image href="data:image/svg+xml;base64,PHN2Zy8+"/>` +
          `<rect fill="url(data:x)"/><path d="M0 0" href="data:image/png;base64,AA=="/>`,
        'xmlns:xlink="http://www.w3.org/1999/xlink"'
      )
    );
    expect(kept).toContain('fill=url(#g)');
    expect(kept).toContain("style=fill: url('#g')");
    expect(kept).toContain('href=#g');
    expect(kept).toContain('href=data:image/png;base64,iVBORw0KGgo=');
    expect(kept.join('\n')).not.toMatch(/x\.example|svg\+xml|url\(data|AA==/);
  });

  it('refuses a value however it is spelled', () => {
    for (const value of [
      'javascript:alert(1)',
      ' JaVaScRiPt:alert(1)',
      'java\tscript:alert(1)',
      'java\u0000script:x',
      'vbscript:x',
      'url(https://x.example/a)',
      "url( 'http://x.example' )",
      'url(//x.example)',
      'url(\\68ttp://x.example)',
      'expression(alert(1))',
      '@import "x.css"',
      '-moz-binding: url(#x)',
      'data:text/html,<b>',
    ]) {
      expect(isSafeSvgValue(value), value).toBe(false);
    }
    for (const value of ['#ffeecc', 'url(#g)', "url('#g')", 'M 0 0 L 1 1']) {
      expect(isSafeSvgValue(value), value).toBe(true);
    }
  });

  it('removes a vendor-namespaced element, an XHTML one and an unsafe sheet', () => {
    const notes = new SvgSketchNotebook();
    const root = sanitizeSvg(
      svg(
        `<x:meta xmlns:x="urn:vendor"><rect/></x:meta>` +
          `<html:p xmlns:html="http://www.w3.org/1999/xhtml"/>` +
          `<style>@import url(https://x.example/a.css);</style>` +
          `<style>.a { fill: red }</style><rect inkscape:label="x"/>`
      ),
      notes
    );
    expect(root.children.map(child => child.nodeName)).toEqual([
      'style',
      'rect',
    ]);
    expect(root.querySelector('rect')!.attributes).toEqual([]);
    expect(
      notes.notes.map(note => note.messageParams?.name).filter(Boolean)
    ).toEqual(['x:meta', 'html:p', 'style']);
  });

  it('cuts what is nested deeper than the walk may recurse, and says so', () => {
    const depth = MAX_SVG_DEPTH + 50;
    const result = parseSvgSketch(
      svg(
        `${'<g>'.repeat(depth)}<rect width="1" height="1"/>${'</g>'.repeat(depth)}`
      ),
      {}
    );
    expect(result.elements).toEqual([]);
    expect(
      result.report.notes.some(
        note => note.messageKey === SVG_SKETCH_TOO_DEEP[0]
      )
    ).toBe(true);
  });

  it('expands nothing a DOCTYPE declares, and refuses what is malformed', () => {
    const laughs = `<!DOCTYPE svg [<!ENTITY a "lol"><!ENTITY b "&a;&a;&a;&a;">]>${svg('<text>&b;</text>')}`;
    expect(JSON.stringify(parseSvgSketch(laughs, {}).elements)).not.toContain(
      'lol'
    );
    let thrown: unknown;
    try {
      sanitizeSvg(svg('<g>'), new SvgSketchNotebook());
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(InterchangeImportError);
    expect((thrown as InterchangeImportError).messageKey).toBe(
      SVG_SKETCH_ERROR_MALFORMED_XML[0]
    );
  });
});
