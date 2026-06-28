import { IS_WINDOWS } from '@labre/global/env';
import type { ShortcutDescriptor } from '@labre/std';

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
    defaultKeys: { mac: ['Mod', 'z'], other: ['Mod', 'z'] },
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
    defaultKeys: { mac: ['Shift', 'Mod', 'z'], other: ['Shift', 'Mod', 'z'] },
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
    defaultKeys: { mac: [], other: ['Control', 'y'] },
    scope: 'global',
    owner: 'core',
    handler: std => ctx => {
      if (!IS_WINDOWS) return;
      ctx.get('defaultState').event.preventDefault();
      if (std.store.canRedo) std.store.redo();
    },
  },
];
