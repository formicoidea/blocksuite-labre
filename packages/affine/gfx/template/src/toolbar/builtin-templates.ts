import { otherTemplateCategory } from '../builtin/other.js';
import { slidesTemplateCategory } from '../builtin/slides/index.js';
import type {
  Template,
  TemplateCategory,
  TemplateManager,
} from './template-type.js';

export const templates: TemplateCategory[] = [
  otherTemplateCategory,
  slidesTemplateCategory,
];

/** A category's pack, whichever of its two shapes (array or thunk) it has. */
export function loadTemplates(category: TemplateCategory): Promise<Template[]> {
  return Array.isArray(category.templates)
    ? Promise.resolve(category.templates)
    : category.templates();
}

/**
 * The ONE search predicate of the Templates panel, built-in and contributed
 * categories alike: a case-insensitive substring of the English `name` (the
 * stable identity, what a catalogue-less playground shows) or of the
 * displayed name the caller resolved through the translation seam.
 *
 * Until 0.58 the built-in half matched the keyword against
 * `Object.entries(templates)` of an ARRAY, i.e. against "0", "1", … — SWOT,
 * Kanban, BMC, Fishbone and Gantt were unfindable, and a lazy built-in
 * category's results were dropped (`template-search.unit.spec.ts`).
 */
export function templateMatches(
  template: Template,
  keyword: string,
  displayName?: string
): boolean {
  const k = keyword.trim().toLocaleLowerCase();
  return [template.name, displayName].some(
    name => name !== undefined && name.toLocaleLowerCase().includes(k)
  );
}

/**
 * The catalogue every editor has, whatever is mounted: `Other` and `Slides`. A host or a
 * framework adds a category per editor with `TemplateCategoryExtension`; the
 * module-level `extend(...)` this object carried until 0.49 appended for every
 * editor of the page and was never emptied.
 */
export const builtInTemplates = {
  list: async (category: string): Promise<Template[]> => {
    const cate = templates.find(cate => cate.name === category);
    if (!cate) return [];
    return loadTemplates(cate);
  },

  categories: async (): Promise<string[]> => templates.map(cate => cate.name),

  categoryLabel: (name: string): string | undefined =>
    templates.find(cate => cate.name === name)?.nameKey,

  // No `std` here, so the English name only; `templateManagerFor` (what the
  // panel reads) also matches the translated name.
  search: async (keyword: string, cateName?: string): Promise<Template[]> => {
    const pool = templates.filter(c => !cateName || c.name === cateName);
    return (await Promise.all(pool.map(loadTemplates)))
      .flat()
      .filter(t => templateMatches(t, keyword));
  },
} satisfies TemplateManager;
