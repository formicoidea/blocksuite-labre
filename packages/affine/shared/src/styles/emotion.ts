import createEmotion from '@emotion/css/create-instance';

/**
 * The library's own emotion instance (the table and database blocks), with
 * the `labre` key: its classes read `labre-…`, and emotion's default
 * instance, which a host importing `@emotion/css` shares when its install
 * deduplicates, is never touched.
 *
 * Emotion writes its rules into a `<style>` it appends to `<head>`, which a
 * Content-Security-Policy whose `style-src` has no `'unsafe-inline'` blocks:
 * its sheet is then `null` and every rule is lost. The canvas viewer of a
 * public page runs under such a policy (ADR 0050), so it calls
 * {@link adoptEmotionStyles} before any block module evaluates: the rules then
 * go to an adopted sheet, and no `<style>` is created.
 *
 * Until something calls it, every rule goes to emotion's `<style>` as it
 * always did, synchronously: the editor's cascade and timing do not change.
 */
const emotion = createEmotion({ key: 'labre' });

export const { cache, css } = emotion;

const tagSheet = cache.sheet;
const insertIntoTag = tagSheet.insert.bind(tagSheet);

/** Every rule inserted so far, for a sheet adopted after them. */
const rules: string[] = [];
let adopted: CSSStyleSheet | null = null;

const insertInto = (sheet: CSSStyleSheet, rule: string) => {
  try {
    sheet.insertRule(rule, sheet.cssRules.length);
  } catch {
    // A rule this engine refuses, which emotion's own sheet skips too.
  }
};

tagSheet.insert = (rule: string) => {
  rules.push(rule);
  if (adopted) insertInto(adopted, rule);
  else insertIntoTag(rule);
};

/**
 * The library's emotion rules go to an adopted sheet from now on, and the
 * ones already written follow them there. Called before the first `css()`,
 * no `<style>` is created at all. Idempotent.
 */
export function adoptEmotionStyles(): void {
  if (adopted || typeof document === 'undefined') return;
  const sheet = new CSSStyleSheet();
  rules.forEach(rule => insertInto(sheet, rule));
  adopted = sheet;
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}
