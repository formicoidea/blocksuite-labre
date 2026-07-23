import { getLastPropsKey } from '@labre/affine-block-surface';
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
    // Copy the style of the single selected canvas element into the shared
    // "last props" store, so the NEXT element created of the same type adopts
    // it (the same mechanism new elements already inherit their style from).
    // There is no paste-style-onto-an-existing-element path yet — that is out
    // of scope. The handler only consumes the keystroke when it actually
    // copies a style; otherwise it falls through (on Windows/Linux Mod+Y is
    // also the `redo-windows` alias, which keeps working when the selection is
    // not a single canvas element).
    id: 'copyStyle',
    labelKey: 'com.affine.keyboardShortcuts.copyStyle',
    defaultKeys: { mac: ['Mod-y'], other: ['Mod-y'] },
    scope: 'edgeless',
    owner: 'core',
    handler: std => ctx => {
      const gfx = std.get(GfxControllerIdentifier);
      if (gfx.selection.editing) return false;

      const elements = gfx.selection.selectedElements;
      if (elements.length !== 1) return false;

      const element = elements[0];
      if (!(element instanceof GfxPrimitiveElementModel)) return false;

      const props = element.serialize() as Partial<LastProps[LastPropsKey]>;
      const key = getLastPropsKey(element.type, props);
      if (!key) return false;

      ctx.get('defaultState').event.preventDefault();
      try {
        // `recordLastProps` re-parses against the style schema for this key,
        // stripping non-style fields (id/index/xywh/text/...).
        std.get(EditPropsStore).recordLastProps(key, props);
      } catch (e) {
        console.error(e);
      }
      return true;
    },
  },
];
