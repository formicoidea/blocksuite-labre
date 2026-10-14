import {
  FrameTemplateProvider,
  type SavedFrameTemplate,
} from '@labre/affine-shared/services';
import { createIdentifier } from '@labre/global/di';
import type { BlockStdScope } from '@labre/std';
import type { ExtensionType } from '@labre/store';

import { builtInTemplates } from './toolbar/builtin-templates.js';
import { resolveTemplateName } from './toolbar/resolve-name.js';
import { TEMPLATE_PANEL_CATEGORY_SAVED_FRAMES } from './translations.js';
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

/**
 * The identity of the host's category of saved frames (the
 * `FrameTemplateProvider` seam): the stable name the panel remembers and
 * lists by. Its tab reads {@link TEMPLATE_PANEL_CATEGORY_SAVED_FRAMES}.
 */
export const SAVED_FRAMES_CATEGORY = 'Saved frames';

function savedFrameTemplate(saved: SavedFrameTemplate): Template {
  return {
    name: saved.title,
    type: 'template',
    content: saved.snapshot,
    preview: saved.preview,
  };
}

/**
 * The host's saved frames as a category, or none without a host. Lazy: the
 * host is asked only when the panel shows the tab or searches across tabs.
 */
function savedFramesCategory(std: BlockStdScope): TemplateCategory | null {
  const service = std.getOptional(FrameTemplateProvider);
  if (!service) return null;
  return {
    name: SAVED_FRAMES_CATEGORY,
    nameKey: TEMPLATE_PANEL_CATEGORY_SAVED_FRAMES[0],
    templates: async () => (await service.list()).map(savedFrameTemplate),
  };
}

function loadCategory(category: TemplateCategory): Promise<Template[]> {
  return Array.isArray(category.templates)
    ? Promise.resolve(category.templates)
    : category.templates();
}

/**
 * The catalogue ONE editor sees: the built-in `Other`, then the categories
 * the view extensions mounted on this `std` registered — i.e. exactly the
 * frameworks whose tooling is on — then the host's saved frames, when a
 * host keeps them (`FrameTemplateProvider`).
 *
 * Per editor, from its DI container: the module-level `extend(...)` of
 * 0.49 and earlier, which appended for every editor and was never emptied,
 * is gone (a host category is a `TemplateCategoryExtension`).
 */
export function templateManagerFor(std: BlockStdScope): TemplateManager {
  const saved = savedFramesCategory(std);
  const contributed = [
    ...std.provider.getAll(TemplateCategoryIdentifier).values(),
    ...(saved ? [saved] : []),
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
