import {
  menu,
  popMenu,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import type { EditorMenuButton } from '@labre/affine-components/toolbar';
import { FrameworkBackgroundElementModel } from '@labre/affine-model';
import {
  ActionPlacement,
  type ChromeWording,
  type ToolbarAction,
  type ToolbarContext,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
  toolbarModuleKey,
  translateKey,
} from '@labre/affine-shared/services';
import {
  type AnyCommandDescriptor,
  BlockFlavourIdentifier,
  type BlockStdScope,
  getRegisteredCommands,
  runCommand,
} from '@labre/std';
import { signal } from '@preact/signals-core';
import { html } from 'lit';

import {
  type BoardSvgExportOptions,
  type BoardSvgExportPart,
  DEFAULT_BOARD_SVG_EXPORT_OPTIONS,
} from './parts.js';
import {
  EXPORT_SVG_CONFIRM,
  EXPORT_SVG_OPTION_FRAMEWORK,
  EXPORT_SVG_OPTION_SHAPES,
  EXPORT_SVG_OPTION_TEXTS,
} from './translations.js';

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

// `z.z-` and not `z.`: a framework's own export (`z.export-owm`,
// `z.export-xml`, `z.export-mermaid`) is the format that says what the board
// MEANS, and it reads first. The picture reads last, under everything, which
// is also where a reader looks for it.
const EXPORT_SVG_ACTION_ID = 'z.z-export-svg';

/** The same `source` the row's own entries report (`commandMoreAction`). */
const INVOCATION = {
  surface: 'contextual-toolbar',
  source: 'toolbar:general',
} as const;

const findCommand = (std: BlockStdScope) =>
  getRegisteredCommands(std).find(
    command => command.id === EXPORT_SVG_COMMAND_ID
  );

/**
 * The reader's last choice, per editor and for the session only: it is a
 * habit of the person exporting, not a property of the document, so it is
 * neither stored in the document nor in the browser. Per editor rather than
 * per module so two editors on one page do not answer for each other.
 */
const lastChoice = new WeakMap<BlockStdScope, BoardSvgExportOptions>();

const SWITCHES: readonly [BoardSvgExportPart, ChromeWording][] = [
  ['framework', EXPORT_SVG_OPTION_FRAMEWORK],
  ['shapes', EXPORT_SVG_OPTION_SHAPES],
  ['texts', EXPORT_SVG_OPTION_TEXTS],
];

/**
 * The options menu: three switches and Export, anchored on the "⋮" whose menu
 * it replaces. Built from the library's menu primitives (`menu.toggleSwitch`,
 * as the HTML embed's settings do) rather than a modal of its own.
 *
 * The choice lives in a signal read through `menu.dynamic`, so a row redrawn
 * after a flip says the CURRENT value: `toggleSwitch` hands its row click the
 * `on` it was built with, and a static `on` would undo a flip when the reader
 * then clicked the row's words.
 */
function openExportSvgOptions(
  std: BlockStdScope,
  command: AnyCommandDescriptor,
  item: HTMLElement
) {
  const more = item.closest<EditorMenuButton>('editor-menu-button');
  more?.hide();

  const choice = signal<BoardSvgExportOptions>({
    ...(lastChoice.get(std) ?? DEFAULT_BOARD_SVG_EXPORT_OPTIONS),
  });

  popMenu(popupTargetFromElement(more ?? item), {
    options: {
      items: [
        menu.group({
          items: [
            menu.dynamic(() =>
              SWITCHES.map(([part, wording]) =>
                menu.toggleSwitch({
                  name: translateKey(std, ...wording),
                  on: choice.value[part],
                  onChange: on => {
                    choice.value = { ...choice.peek(), [part]: on };
                  },
                  testId: `export-svg-option-${part}`,
                })
              )
            ),
          ],
        }),
        menu.group({
          items: [
            menu.action({
              name: translateKey(std, ...EXPORT_SVG_CONFIRM),
              prefix: ExportSvgIcon,
              testId: 'export-svg-confirm',
              select: () => {
                const options = { ...choice.peek() };
                lastChoice.set(std, options);
                runCommand(std, command, INVOCATION, options);
              },
            }),
          ],
        }),
      ],
    },
  });
}

/**
 * The "⋮" entry. It invokes the registered command like `commandMoreAction`
 * does — one behaviour, one availability rule, one usage record per export —
 * but asks for the options first, so it draws its own line: a menu line's
 * `run` is handed no element to anchor a popup on.
 */
const exportSvgMoreAction: ToolbarAction = {
  id: EXPORT_SVG_ACTION_ID,
  placement: ActionPlacement.More,
  when: (ctx: ToolbarContext) => {
    const command = findCommand(ctx.std);
    return command !== undefined && (command.when?.(ctx.std) ?? true);
  },
  content: (ctx: ToolbarContext) => {
    const label = translateKey(
      ctx.std,
      EXPORT_SVG_LABEL_KEY,
      EXPORT_SVG_LABEL_FALLBACK
    );
    return html`
      <editor-menu-action
        data-testid="z-export-svg"
        data-toolbar-action-id=${EXPORT_SVG_ACTION_ID}
        aria-label=${label}
        @click=${(event: MouseEvent) => {
          const command = findCommand(ctx.std);
          if (!command) return;
          openExportSvgOptions(
            ctx.std,
            command,
            event.currentTarget as HTMLElement
          );
        }}
      >
        ${ExportSvgIcon}
        <span class="label">${label}</span>
      </editor-menu-action>
    `;
  },
};

export const exportSvgToolbarConfig = {
  actions: [exportSvgMoreAction],
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
