import { FrameworkBackgroundElementModel } from '@labre/affine-model';
import {
  commandMoreAction,
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
  toolbarModuleKey,
} from '@labre/affine-shared/services';
import { BlockFlavourIdentifier } from '@labre/std';
import { html } from 'lit';

/**
 * A sheet with an arrow leaving it: the board, on its way out of the editor.
 *
 * Drawn inline like its neighbours in this package (`reading-toolbar.ts`,
 * `tags-toolbar.ts`, `validation-toolbar.ts`): the surface block does not
 * depend on `@blocksuite/icons`, and one glyph is not worth a new dependency.
 */
const ExportSvgIcon = html`<svg
  width="20"
  height="20"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M12 3v12" />
  <path d="M8 11l4 4 4-4" />
  <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
</svg>`;

/** The keys the command declares; spelled once, read here and nowhere else. */
const EXPORT_SVG_COMMAND_ID = 'export.svg';
const EXPORT_SVG_LABEL_KEY = 'com.labre.command.export.svg';
const EXPORT_SVG_LABEL_FALLBACK = 'Export SVG';

export const exportSvgToolbarConfig = {
  actions: [
    commandMoreAction(
      // `z.z-` and not `z.`: a framework's own export (`z.export-owm`,
      // `z.export-xml`, `z.export-mermaid`) is the format that says what the
      // board MEANS, and it reads first. The picture reads last, under
      // everything, which is also where a reader looks for it.
      'z.z-export-svg',
      EXPORT_SVG_COMMAND_ID,
      EXPORT_SVG_LABEL_KEY,
      EXPORT_SVG_LABEL_FALLBACK,
      ExportSvgIcon
    ),
  ],
  // The module says "a board is selected"; the command's own `when` says the
  // same thing from the registry side, and the two are deliberately both there
  // — the entry is drawn from the module and the behaviour is guarded by the
  // command, whichever surface reaches it.
  when: (ctx: ToolbarContext) =>
    ctx.getSurfaceModelsByType(FrameworkBackgroundElementModel).length > 0,
} as const satisfies ToolbarModuleConfig;

/**
 * "Export SVG" in the "⋮" of EVERY framework board (ADR 0025).
 *
 * ## Where it is registered
 *
 * `custom:affine:surface:*` — the wildcard slot merged into the toolbar of every
 * canvas element — with an OWNER suffix. The bare key is already taken by
 * `validation-toolbar.ts` (and `affine:surface:*` by the root's built-in misc
 * module), so a second module on either would be a
 * `DuplicateServiceDefinitionError` at setup rather than a menu entry;
 * {@link toolbarModuleKey} is what gives a second contributor a distinct DI
 * variant while `modulesFor` still hands it to the row drawn for that flavour.
 *
 * One registration therefore covers all eleven board kinds and every one that
 * follows, which is the whole claim of the ADR: the export is generic, so it is
 * registered once, generically, and a new framework inherits it by extending
 * `FrameworkBackgroundElementModel` and doing nothing else.
 */
export const exportSvgToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier(
    toolbarModuleKey('custom:affine:surface:*', 'export-svg')
  ),
  config: exportSvgToolbarConfig,
});
