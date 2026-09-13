import type { BlockStdScope } from '@labre/std';

export type Template = {
  /**
   * name of the sticker
   *
   * if not provided, it cannot be searched
   */
  name?: string;

  /**
   * template content
   */
  content: unknown;

  /**
   * external assets
   */
  assets?: Record<string, string>;

  preview?: string;

  /**
   * type of template
   * `template`: normal template, looks like an article
   * `sticker`: sticker template, only contains one image block under surface block
   */
  type: 'template' | 'sticker';

  /**
   * Id of the command this template was derived from, when it was derived
   * rather than hand-written (see `snapshotFromAction`). Lets a coverage test
   * assert that every framework artefact command has a template.
   */
  commandId?: string;

  /**
   * i18n key for the DISPLAYED name of a hand-composed template (a worked
   * scene, an example map) -- the ones {@link commandId} cannot help,
   * because nothing derives their tile from a command's own label. Resolved
   * with {@link name} as its fallback, exactly like
   * {@link TemplateCategory.nameKey} one level up, so registering no
   * `TranslationProvider` shows `name` letter for letter and a standalone
   * playground is unaffected.
   *
   * Checked BEFORE {@link commandId} in `resolveTemplateName`: a template
   * that carries both would be a contradiction (its name is either the
   * command's own wording or a wording of its own, never both), and no
   * shipped template declares both today.
   */
  nameKey?: string;

  /**
   * Rebuild {@link content} in the inserting editor's language — the seeds a
   * template writes into the document (a component's name, a lane's title) go
   * through the translation seam at placement, like a creation action's
   * (ADR 0016). Called once per insertion; without it `content` is inserted
   * as is.
   *
   * With no `TranslationProvider` registered it must return exactly
   * `content`: `content` is the English build, and a standalone playground
   * inserts what it always inserted.
   */
  localize?: (std: BlockStdScope) => unknown;

  /**
   * Run once the template's elements are on the surface, with the FRESH
   * element ids in snapshot order — for a template whose final shape depends
   * on what is already on the board.
   */
  afterInsert?: (std: BlockStdScope, insertedIds: string[]) => void;
};

export type TemplateCategory = {
  name: string;
  /**
   * i18n key of the category's own tab label, resolved with {@link name} as
   * its fallback — so registering no `TranslationProvider` shows exactly
   * `name`, letter for letter. A framework category reuses its OWN existing
   * key (`com.labre.framework.<id>`, the senior button's); a generic one
   * (`Other`) gets a key of its own. Absent for a category whose display name
   * cannot be attributed to one owner (Cynefin and Estuarine share a single
   * `cynefin-estuarine` framework key that names neither individually) or that
   * a host contributed through {@link TemplateManager.extend} — either way
   * `name` is shown as is.
   */
  nameKey?: string;
  templates: Template[] | (() => Promise<Template[]>);
};

export interface TemplateManager {
  list(category: string): Promise<Template[]> | Template[];

  categories(): Promise<string[]> | string[];

  search(keyword: string, category?: string): Promise<Template[]> | Template[];

  /** {@link TemplateCategory.nameKey} of the category named `name`, if any. */
  categoryLabel?(name: string): string | undefined;

  extend?(manager: TemplateManager): void;
}
