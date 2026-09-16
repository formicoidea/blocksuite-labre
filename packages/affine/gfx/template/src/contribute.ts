import { createIdentifier } from '@labre/global/di';
import type { BlockStdScope } from '@labre/std';
import type { ExtensionType } from '@labre/store';

import { builtInTemplates } from './toolbar/builtin-templates.js';
import { resolveTemplateName } from './toolbar/resolve-name.js';
import type {
  Template,
  TemplateCategory,
  TemplateManager,
} from './toolbar/template-type.js';

/**
 * A framework registers its Templates-panel categories here; the panel reads
 * them back from the std of the edgeless it opens on. One identifier per
 * category NAME, so two extensions claiming the same category collide at
 * setup (`DuplicateServiceDefinitionError`, caught by `di-mount.unit.spec.ts`)
 * rather than listing it twice.
 */
export const TemplateCategoryIdentifier =
  createIdentifier<TemplateCategory>('TemplateCategory');

/**
 * Register a framework's template categories. Call it from `setup()` of the
 * FLAG-GATED view extension, beside the senior tool — a category is creation
 * tooling, so a disabled framework must contribute none (`docs/adr/0009`):
 *
 * ```ts
 * context.register(TemplateCategoryExtension(wardleyTemplateCategory));
 * ```
 *
 * Replaces the module-level registry of 0.38.0–0.38.2 (`extendTemplateCategory`)
 * that appended from `effect()` and never removed: a category outlived the
 * editor whose flags had admitted it, so a framework switched off in the host
 * kept its category until a full reload (#244). The DI container is per editor;
 * nothing has to be un-registered.
 */
export function TemplateCategoryExtension(
  ...categories: TemplateCategory[]
): ExtensionType {
  return {
    setup: di => {
      for (const category of categories) {
        di.addImpl(TemplateCategoryIdentifier(category.name), () => category);
      }
    },
  };
}

function loadCategory(category: TemplateCategory): Promise<Template[]> {
  return Array.isArray(category.templates)
    ? Promise.resolve(category.templates)
    : category.templates();
}

/**
 * The catalogue ONE editor sees: the built-in categories (`Other`, plus
 * whatever a host appended through `EdgelessTemplatePanel.templates.extend`)
 * followed by the categories the view extensions mounted on this `std`
 * registered — i.e. exactly the frameworks whose tooling is on.
 */
export function templateManagerFor(std: BlockStdScope): TemplateManager {
  const contributed = [
    ...std.provider.getAll(TemplateCategoryIdentifier).values(),
  ];
  const byName = (name: string) => contributed.find(c => c.name === name);

  return {
    categories: async () => [
      ...new Set([
        ...(await builtInTemplates.categories()),
        ...contributed.map(c => c.name),
      ]),
    ],
    categoryLabel: name =>
      byName(name)?.nameKey ?? builtInTemplates.categoryLabel(name),
    // Both halves, so a host's `extend(...)` can still append to a framework's
    // own category (the global half answers `[]` for a name it does not know).
    list: async name => {
      const category = byName(name);
      return [
        ...(category ? await loadCategory(category) : []),
        ...(await builtInTemplates.list(name)),
      ];
    },
    search: async (keyword, name) => {
      const k = keyword.trim().toLocaleLowerCase();
      const pool = name ? [byName(name)].filter(c => !!c) : contributed;
      // Matches the ENGLISH name (`templateFromCommand`'s baked-in `name`,
      // still what a catalogue-less playground shows) or the host's own
      // translation of it (`resolveTemplateName`, through the command's
      // `labelKey`) — a search box must not go blind on a translated tile.
      const own = (await Promise.all(pool.map(loadCategory)))
        .flat()
        .filter(
          t =>
            t.name?.toLocaleLowerCase().includes(k) ||
            resolveTemplateName(std, t).toLocaleLowerCase().includes(k)
        );
      return [...(await builtInTemplates.search(keyword, name)), ...own];
    },
  };
}
