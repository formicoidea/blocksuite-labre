import { translateKey } from '@labre/affine-shared/services';
import { type BlockStdScope, getRegisteredCommands } from '@labre/std';

import type { Template } from './template-type.js';

/**
 * The DISPLAYED name of a template — resolved through the command it was
 * derived from ({@link Template.commandId}, set by `templateFromCommand`)
 * when it carries one, so a framework artefact's tile shows the command's own
 * translated label rather than the raw English text baked into `name` at
 * build time. A hand-written template (no `commandId`) shows its own `name`,
 * unresolved — those get a key of their own on a case-by-case basis, not
 * through this generic seam.
 *
 * `Template.name` itself stays the STABLE identity `templateFromCommand`
 * bakes in (the drag payload, the `repeat` key, the `templateCache` storage
 * key) — and it is ALSO what gets passed as `translateKey`'s fallback, never
 * `command.labelFallback`: most derived templates leave `name` at its default
 * (the command's own fallback, so the two agree anyway), but a few tiles
 * deliberately keep a name of their own, more specific than the command's
 * (`edgy.addFacets`'s own label is "Enterprise Design facets"; its tile has
 * always said "Facets diagram"). Falling back to `command.labelFallback`
 * would silently swap that wording out from under a catalogue-less
 * playground; reading through the command's `labelKey` while keeping the
 * TEMPLATE's own fallback is what lets a host translate the tile without
 * this function inventing a different English sentence for it first.
 */
export function resolveTemplateName(
  std: BlockStdScope,
  template: Template
): string {
  const fallback = template.name ?? '';
  // Checked FIRST: a hand-composed template (a worked scene, an example map)
  // carries no `commandId` at all, and `nameKey` is the only way its tile
  // gets a translated wording of its own.
  if (template.nameKey) return translateKey(std, template.nameKey, fallback);
  if (!template.commandId) return fallback;
  const command = getRegisteredCommands(std).find(
    c => c.id === template.commandId
  );
  return command ? translateKey(std, command.labelKey, fallback) : fallback;
}
