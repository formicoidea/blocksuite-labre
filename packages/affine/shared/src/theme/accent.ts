import {
  combinedDarkCssVariables,
  combinedLightCssVariables,
} from '@toeverything/theme';

import { LABRE_ACCENT } from '../consts/accent.js';

/**
 * Re-pointing the upstream theme's accent at Labre's own (ADR 0029).
 *
 * ## The problem this solves
 *
 * The library declares variable NAMES and never values: the values come from
 * `@toeverything/theme`, whose stylesheet the host loads. That theme paints
 * roughly forty variables with AFFiNE's accent — `--affine-primary-color`,
 * `--affine-brand-color`, `--affine-v2-button-primary`, the focus ring in
 * `--affine-active-shadow`, the marquee, the checkbox, the activated icon, and
 * so on. Asking the host to restate all of them is not a seam, it is a chore,
 * and every upgrade of the theme package would add more.
 *
 * So the library derives the override itself: it reads the upstream tables,
 * finds every value that carries the upstream accent — in any of its
 * spellings, keeping whatever alpha it had — and restates that entry with
 * Labre's accent instead. Nothing is hand-listed, so a theme bump that adds a
 * new accent-coloured token is covered the day it lands.
 *
 * ## No literal of either accent lives here
 *
 * The upstream accent is not spelled out: it is READ from the theme, as the
 * light and dark values of `--affine-primary-color`. Labre's own accent is
 * `LABRE_ACCENT`, the single place it is written. `brand-hex.unit.spec.ts`
 * enforces the first half of that.
 */

/** `#rrggbb` (with an optional `aa` alpha byte), as CSS writes it. */
const HEX = /#([0-9a-f]{6})([0-9a-f]{2})?\b/gi;

/**
 * The head of an `rgb()` / `rgba()` call, up to but excluding the separator
 * that follows the blue channel — so the alpha argument, when there is one, is
 * left untouched.
 */
const RGB_HEAD =
  /\b(rgba?)\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?=[,)])/gi;

/**
 * The upstream accent in both of its theme values, read from the theme package
 * rather than written down: `--affine-primary-color` is the variable every
 * other accent-coloured token agrees with.
 */
const BORROWED = new Set(
  [
    combinedLightCssVariables['--affine-primary-color'],
    combinedDarkCssVariables['--affine-primary-color'],
  ].map(hex => hex.trim().toLowerCase())
);

function channelsOf(hex: string): [number, number, number] {
  const base = hex.trim().slice(1);
  return [0, 2, 4].map(i => parseInt(base.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function isBorrowed(hex: string): boolean {
  return BORROWED.has(hex.toLowerCase());
}

function toHex(r: string, g: string, b: string): string {
  return (
    '#' +
    [r, g, b]
      .map(channel => Number(channel).toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * `value` with every occurrence of the upstream accent replaced by `accent`,
 * in the same shape it was written: a hex stays a hex and keeps its alpha
 * byte, an `rgb()`/`rgba()` call keeps its function name and its alpha
 * argument. A value that does not carry the accent is returned unchanged
 * (identity, not a copy with the same text), which is what lets
 * {@link accentVariables} tell "re-pointed" from "left alone".
 */
export function withAccent(
  value: string,
  accent: string = LABRE_ACCENT
): string {
  if (typeof value !== 'string') return value;
  const [r, g, b] = channelsOf(accent);
  const next = value
    .replace(HEX, (whole, base: string, alpha?: string) =>
      isBorrowed(`#${base}`) ? `${accent}${alpha ?? ''}` : whole
    )
    .replace(
      RGB_HEAD,
      (whole, fn: string, red: string, green: string, blue: string) =>
        isBorrowed(toHex(red, green, blue)) ? `${fn}(${r}, ${g}, ${b}` : whole
    );
  return next === value ? value : next;
}

/** The upstream table for one scheme. Kept private: callers pass a scheme. */
function tableOf(dark: boolean): Record<string, string> {
  return (dark
    ? combinedDarkCssVariables
    : combinedLightCssVariables) as unknown as Record<string, string>;
}

/**
 * Every upstream variable of one scheme whose value carries the accent, with
 * the accent re-pointed — and ONLY those. The result is the smallest override
 * that repaints the chrome: restating the other six hundred variables would
 * make the library a theme, which it is not.
 */
export function accentVariables(
  dark: boolean,
  accent: string = LABRE_ACCENT
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(tableOf(dark))) {
    if (typeof value !== 'string') continue;
    const next = withAccent(value, accent);
    if (next !== value) out[name] = next;
  }
  return out;
}

function block(selector: string, vars: Record<string, string>): string {
  const body = Object.entries(vars)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}

/**
 * The override stylesheet, mirroring the selectors the upstream sheet uses for
 * the same variables: `:root` plus `[data-theme='light']` for the light set,
 * `[data-theme='dark']` for the dark one.
 *
 * `[data-theme]` matters as much as `:root`. A host — and this repo's own
 * playground — puts `data-theme` on the viewport DIV that wraps the editor,
 * and the upstream sheet's `[data-theme='light']` rule then re-declares the
 * WHOLE variable set on that div, below `<html>`. An override that only
 * targeted `:root` would be shadowed for everything inside the editor while
 * still applying to menus portalled onto `document.body` — half the chrome one
 * colour, half the other.
 */
export function accentStyleSheetText(accent: string = LABRE_ACCENT): string {
  return [
    `/* Labre accent (ADR 0029) — generated from @toeverything/theme. */`,
    block(`:root,\n[data-theme='light']`, accentVariables(false, accent)),
    block(`[data-theme='dark']`, accentVariables(true, accent)),
  ].join('\n\n');
}

/**
 * One sheet per document, kept so a second editor on the same page adopts the
 * same object rather than stacking another copy, and so a change of accent
 * rewrites in place.
 */
const installed = new WeakMap<
  Document,
  { sheet: CSSStyleSheet; accent: string }
>();

/**
 * Adopt the override into `doc`, idempotently.
 *
 * `adoptedStyleSheets` is the right vehicle rather than a `<style>` in
 * `document.head`: constructed sheets cascade AFTER the document's own
 * stylesheets, so the override beats the upstream `[data-theme='…']` rules at
 * equal specificity without an `!important` and without having to be injected
 * after them in load order.
 *
 * It also means an inline declaration still wins, which is the host's escape
 * hatch for the DOM. The supported seam, the one that moves the canvas too, is
 * `ChromeAccentExtension`.
 *
 * Silent no-op where constructed stylesheets do not exist (a DOM shim in a
 * unit test, a server render): the accent then comes from the JS side only,
 * which is all a headless caller can observe anyway.
 */
export function installAccentStyleSheet(
  doc: Document,
  accent: string = LABRE_ACCENT
): void {
  const current = installed.get(doc);
  if (current?.accent === accent) return;
  try {
    if (typeof CSSStyleSheet === 'undefined') return;
    const sheet = current?.sheet ?? new CSSStyleSheet();
    sheet.replaceSync(accentStyleSheetText(accent));
    if (!current) {
      doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
    }
    installed.set(doc, { sheet, accent });
  } catch {
    // A DOM that knows `CSSStyleSheet` but not `replaceSync` or a mutable
    // `adoptedStyleSheets`. Nothing to recover: the JS path still resolves the
    // accent, and the chrome falls back to the upstream theme.
  }
}
