import type { AnyCommandDescriptor } from '@labre/std';

/** The i18n key prefix every catalogue group header is looked up under. */
export const CATALOGUE_CATEGORY_KEY_PREFIX = 'com.labre.catalogue.category.';

/**
 * One section of the catalogue: a category and the commands declaring it.
 *
 * `category` is `null` for the trailing group of commands that declare none —
 * see {@link groupCommandsByCategory}.
 */
export interface CatalogueGroup {
  category: string | null;
  commands: AnyCommandDescriptor[];
}

/**
 * Split a surface's commands into the sections the sidepanel draws.
 *
 * Two rules, and both exist to keep the panel's order the FRAMEWORK's order:
 *
 * - groups appear in the order their category is first met, not alphabetically.
 *   `getCommandsForSurface` has already sorted by `CommandDescriptor.order`, so
 *   a framework that declared backgrounds before nodes before connectors gets
 *   exactly that reading, and sorting the headers by name would quietly
 *   overrule it;
 * - a command with no category joins ONE trailing group, and that group exists
 *   only when something lands in it. An "Other" header over an empty section —
 *   or over a framework whose commands are all uncategorised, where it would be
 *   the only header — says nothing a reader can use.
 *
 * Pure on purpose: this is the half of the panel worth unit-testing, and it
 * knows nothing about lit, the DOM or the editor.
 */
export function groupCommandsByCategory(
  commands: readonly AnyCommandDescriptor[]
): CatalogueGroup[] {
  const byCategory = new Map<string, AnyCommandDescriptor[]>();
  const uncategorised: AnyCommandDescriptor[] = [];

  for (const command of commands) {
    const { category } = command;
    if (!category) {
      uncategorised.push(command);
      continue;
    }
    const group = byCategory.get(category);
    if (group) group.push(command);
    else byCategory.set(category, [command]);
  }

  const groups: CatalogueGroup[] = [...byCategory].map(
    ([category, commands]) => ({ category, commands })
  );
  if (uncategorised.length)
    groups.push({ category: null, commands: uncategorised });
  return groups;
}

/**
 * The English default for a category header, derived from the category id.
 *
 * `'backgrounds'` → `'Backgrounds'`, `'value-flow'` → `'Value flow'`,
 * `'boundedContext'` → `'Bounded context'`. Sentence case, not title case: a
 * header is a phrase, and capitalising every word turns `'change arrows'` into
 * a product name.
 *
 * It is a FALLBACK and nothing more. A host with a catalogue answers
 * `com.labre.catalogue.category.<id>` and this is never seen; a standalone
 * playground reads a word instead of a raw key. The library still invents no
 * framework prose — a category id is the framework's own word, only respelled.
 */
export function humanizeCategory(category: string): string {
  const words = category
    // camelCase and PascalCase boundaries, before the separators are split on:
    // `'boundedContext'` has no separator to find otherwise.
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(word => word.toLowerCase());

  if (!words.length) return category;
  const [first, ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}
