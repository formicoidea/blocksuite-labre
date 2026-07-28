import {
  EdgelessCRUDIdentifier,
  getLastPropsKey,
} from '@labre/affine-block-surface';
import type {
  LastProps,
  LastPropsKey,
} from '@labre/affine-shared/services';
import { EditPropsStore } from '@labre/affine-shared/services';
import { pickStylePropsForKey } from '@labre/affine-shared/utils';
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
    // Apply the last used style to the selected elements. "Last used" is the
    // flat accumulation of every style prop the user recorded (every style
    // edit and style pick records it), across element types: a fill picked on
    // a rect repaints an ellipse, a font style set on a text restyles a
    // shape. Each element only receives the props its own type supports —
    // schema-filtered per prop, so geometry and content are never touched.
    // The handler only consumes the keystroke when it actually applies
    // something; otherwise it falls through (on Windows/Linux Mod+Y is also
    // the `redo-windows` alias, which keeps working when no canvas element is
    // selected).
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

      const lastStyle = std.get(EditPropsStore).lastUsedStyle$.value;
      if (!Object.keys(lastStyle).length) return false;

      const targets = elements.flatMap(element => {
        const isPrimitive = element instanceof GfxPrimitiveElementModel;
        const key = getLastPropsKey(
          isPrimitive ? element.type : element.flavour,
          (isPrimitive ? element.serialize() : {}) as Partial<
            LastProps[LastPropsKey]
          >
        );
        const props = key ? pickStylePropsForKey(key, lastStyle) : null;
        return props ? [{ id: element.id, props }] : [];
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
