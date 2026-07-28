import {
  EdgelessCRUDIdentifier,
  getLastPropsKey,
} from '@labre/affine-block-surface';
import type {
  LastProps,
  LastPropsKey,
} from '@labre/affine-shared/services';
import { EditPropsStore } from '@labre/affine-shared/services';
import { IS_WINDOWS } from '@labre/global/env';
import type { ShortcutDescriptor } from '@labre/std';
import {
  GfxControllerIdentifier,
  GfxPrimitiveElementModel,
} from '@labre/std/gfx';

import { duplicate } from '../edgeless/utils/clipboard-utils.js';

/**
 * Core (always-on) keyboard shortcuts, expressed as rebindable descriptors.
 * Migrated out of the imperative `PageKeyboardManager` bindings so the host can
 * enumerate and override them. Installed by `ShortcutKeymapExtension` (see
 * root `view.ts`).
 */
export const coreShortcuts: ShortcutDescriptor[] = [
  {
    id: 'undo',
    labelKey: 'com.affine.keyboardShortcuts.undo',
    defaultKeys: { mac: ['Mod-z'], other: ['Mod-z'] },
    scope: 'global',
    owner: 'core',
    handler: std => ctx => {
      ctx.get('defaultState').event.preventDefault();
      if (std.store.canUndo) std.store.undo();
    },
  },
  {
    id: 'redo',
    labelKey: 'com.affine.keyboardShortcuts.redo',
    defaultKeys: { mac: ['Shift-Mod-z'], other: ['Shift-Mod-z'] },
    scope: 'global',
    owner: 'core',
    handler: std => ctx => {
      ctx.get('defaultState').event.preventDefault();
      if (std.store.canRedo) std.store.redo();
    },
  },
  {
    // Windows-only redo alias (Ctrl+Y); not bound on mac (empty combo).
    id: 'redo-windows',
    labelKey: 'com.affine.keyboardShortcuts.redo',
    defaultKeys: { mac: [], other: ['Control-y'] },
    scope: 'global',
    owner: 'core',
    handler: std => ctx => {
      if (!IS_WINDOWS) return;
      ctx.get('defaultState').event.preventDefault();
      if (std.store.canRedo) std.store.redo();
    },
  },
  {
    // Duplicate the current edgeless selection. Mod+D is the browser
    // "add bookmark" gesture, so the handler always preventDefaults when it
    // acts. On mac Mod resolves to Cmd (Cmd+D = duplicate) which coexists with
    // the imperative Ctrl+D = delete binding (see `edgeless-keyboard.ts`); on
    // Windows/Linux Mod resolves to Ctrl (Ctrl+D = duplicate).
    id: 'duplicate',
    labelKey: 'com.affine.keyboardShortcuts.duplicate',
    defaultKeys: { mac: ['Mod-d'], other: ['Mod-d'] },
    scope: 'edgeless',
    owner: 'core',
    handler: std => ctx => {
      const gfx = std.get(GfxControllerIdentifier);
      if (gfx.selection.editing) return false;

      const elements = gfx.selection.selectedElements;
      if (!elements.length) return false;

      ctx.get('defaultState').event.preventDefault();

      const rootId = std.store.root?.id;
      const edgeless = rootId ? std.view.getBlock(rootId) : null;
      if (!edgeless) return true;

      duplicate(edgeless, elements).catch(console.error);
      return true;
    },
  },
  {
    // Apply the last used style to the selected canvas elements. "Last used"
    // is the shared "last props" store, which every style edit and element
    // creation already records — so Mod+Y repaints the selection with the
    // style you just used elsewhere. The handler only consumes the keystroke
    // when it actually applies something; otherwise it falls through (on
    // Windows/Linux Mod+Y is also the `redo-windows` alias, which keeps
    // working when no canvas element is selected).
    id: 'applyLastStyle',
    labelKey: 'com.affine.keyboardShortcuts.applyLastStyle',
    defaultKeys: { mac: ['Mod-y'], other: ['Mod-y'] },
    scope: 'edgeless',
    owner: 'core',
    handler: std => ctx => {
      const gfx = std.get(GfxControllerIdentifier);
      if (gfx.selection.editing) return false;

      const elements = gfx.selection.selectedElements;
      if (!elements.length) return false;

      const lastProps = std.get(EditPropsStore).lastProps$.value;
      const targets = elements.flatMap(element => {
        if (!(element instanceof GfxPrimitiveElementModel)) return [];
        // `lastProps` keys hold style-only props (schema-filtered), so
        // applying the whole entry never touches geometry or content.
        const key = getLastPropsKey(
          element.type,
          element.serialize() as Partial<LastProps[LastPropsKey]>
        );
        return key ? [{ id: element.id, props: lastProps[key] }] : [];
      });
      if (!targets.length) return false;

      ctx.get('defaultState').event.preventDefault();

      // One history frame: a single undo restores the previous styles.
      std.store.captureSync();
      const crud = std.get(EdgelessCRUDIdentifier);
      for (const { id, props } of targets) {
        crud.updateElement(id, props);
      }
      return true;
    },
  },
];
