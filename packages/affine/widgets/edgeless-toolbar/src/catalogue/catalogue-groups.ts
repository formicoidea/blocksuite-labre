import type { AnyCommandDescriptor } from '@labre/std';

/**
 * The header key prefix and the header fallback, re-exported from `@labre/std`
 * where they are declared.
 *
 * They moved there so a FRAMEWORK can derive its own catalogue-header keys for
 * the translation manifest without depending on this widget (#183): in the
 * bundled distribution core's command registry names no framework category, so
 * every framework has to contribute its own. Re-exported rather than moved
 * away, because the panel below is still the thing that renders them.
 */
export { CATALOGUE_CATEGORY_KEY_PREFIX, humanizeCategory } from '@labre/std';

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
