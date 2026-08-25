import { textFormatConfigs, textKeymap } from '@labre/affine-inline-preset';
import { TableBlockSchema } from '@labre/affine-model';
import {
  type BlockStdScope,
  KeymapExtension,
  type UIEventHandler,
} from '@labre/std';

/**
 * Format hotkeys (bold, italic, …) for a table cell.
 *
 * The shared `textFormatKeymap` bails out unless the store holds a
 * `TextSelection`, and a table cell never holds one: focusing a cell installs a
 * `TableSelection` instead (see `selection-controller.ts`). The format commands
 * themselves already fall back to the native selection, so that guard is the
 * only thing standing between the user and a bold word. Dropping it here — for
 * the table flavour alone — keeps every other block's behaviour untouched.
 */
export const tableTextFormatKeymap = (
  std: BlockStdScope
): Record<string, UIEventHandler> =>
  textFormatConfigs
    .filter(config => config.hotkey)
    .reduce(
      (acc, config) => {
        acc[config.hotkey as string] = ctx => {
          if (std.store.readonly) return;

          const allowed = config.textChecker?.(std.host) ?? true;
          if (!allowed) return;

          const event = ctx.get('keyboardState').raw;
          event.stopPropagation();
          event.preventDefault();

          config.action(std.host);
          return true;
        };
        return acc;
      },
      {} as Record<string, UIEventHandler>
    );

/**
 * Text shortcuts scoped to the table flavour. The cell no longer swallows every
 * keystroke, so the shortcuts a user expects while typing reach this keymap —
 * and stop there, instead of reaching the document.
 */
export const TableKeymapExtension = KeymapExtension(
  std => ({
    ...textKeymap(std),
    ...tableTextFormatKeymap(std),
  }),
  {
    flavour: TableBlockSchema.model.flavour,
  }
);
