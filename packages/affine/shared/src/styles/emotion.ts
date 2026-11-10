import { cache, css } from '@emotion/css';

/**
 * The one emotion instance of the library (the table and database blocks).
 *
 * Emotion writes its rules into a `<style>` it appends to `<head>`, which a
 * Content-Security-Policy whose `style-src` has no `'unsafe-inline'` blocks:
 * its sheet is then `null` and every rule is lost. The canvas viewer of a
 * public page runs under such a policy (ADR 0050), and its blocks call `css()`
 * at import, before any viewer exists.
 *
 * So the rules wait for the next microtask before they reach emotion's
 * `<style>`: the editor gets them there as before, in the same order, before
 * its first render. A module that calls {@link adoptEmotionStyles} while the
 * modules are still evaluating (the viewer does, at import) gets them in an
 * adopted sheet instead, and no `<style>` is ever created.
 */
const tagSheet = cache.sheet;
const insertIntoTag = tagSheet.insert.bind(tagSheet);

const rules: string[] = [];
let pending: string[] = [];
let flushQueued = false;
let adopted: CSSStyleSheet | null = null;

const insertInto = (sheet: CSSStyleSheet, rule: string) => {
  try {
    sheet.insertRule(rule, sheet.cssRules.length);
  } catch {
    // A rule this engine refuses, which emotion's own sheet skips too.
  }
};

const flush = () => {
  flushQueued = false;
  const batch = pending;
  pending = [];
  if (!adopted) batch.forEach(insertIntoTag);
};

tagSheet.insert = (rule: string) => {
  rules.push(rule);
  if (adopted) {
    insertInto(adopted, rule);
    return;
  }
  pending.push(rule);
  if (!flushQueued) {
    flushQueued = true;
    queueMicrotask(flush);
  }
};

/**
 * Emotion's rules go to an adopted sheet from now on, and the ones already
 * written follow them there. Called before the first microtask, no `<style>`
 * is created at all. Idempotent.
 */
export function adoptEmotionStyles(): void {
  if (adopted || typeof document === 'undefined') return;
  const sheet = new CSSStyleSheet();
  rules.forEach(rule => insertInto(sheet, rule));
  adopted = sheet;
  pending = [];
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}

export { cache, css };
