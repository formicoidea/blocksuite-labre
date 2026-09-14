/**
 * A name a file system will accept, minus the extension.
 *
 * The same transformations `c4SafeFilename` and `bpmnSafeFilename` apply, and
 * for the same reasons — reserved characters become `-`, whitespace runs
 * collapse, the result is capped, and the Windows tail of dots and spaces is
 * trimmed AFTER the cap so the extension is not the thing that gets eaten.
 *
 * Duplicated rather than imported, which is the trade the two packs before this
 * one made explicitly: a filename rule is not API, and coupling three frameworks
 * so they can share eight lines buys nothing and costs a shared thing to break.
 *
 * `fallback` is a parameter here where the other two hard-code theirs, because
 * UML writes two formats out of one pack and the word a nameless document should
 * take is the FORMAT's rather than the framework's.
 */
export function umlSafeFilename(
  raw: string | undefined,
  fallback = 'diagram'
): string {
  const safe = (raw ?? '')
    .trim()
    .replaceAll(/[\\/:*?"<>|]/g, '-')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .replace(/[. ]+$/, '');
  return safe || fallback;
}
