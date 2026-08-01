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
import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import {
  GfxControllerIdentifier,
  GfxPrimitiveElementModel,
} from '@labre/std/gfx';

import { duplicate } from '../edgeless/utils/clipboard-utils.js';

/**
 * Core (always-on) commands, expressed as {@link CommandDescriptor}s.
 *
 * They were already rebindable descriptors; PF3 promotes them to the single
 * source so the keymap, Settings › Shortcuts and the palette read ONE list
 * (`docs/adr/0008`). Ids, `labelKey`s and `defaultKeys` are carried over
 * verbatim — persisted v0.29 override tables stay valid.
 *
 * They carry no `telemetry`: undo/redo/duplicate emitted nothing before, and
 * the bottleneck only emits what a descriptor declares.
 */

/**
 * The elements the "apply last style" gesture would actually repaint, with the
 * schema-filtered props each would receive.
 *
 * Computed by the `when` predicate AND by `run`, on purpose: the projection to
 * a shortcut only consumes the keystroke when `when` holds, and this gesture
 * must fall through when it has nothing to apply — on Windows `Mod+Y` is also
 * the `redo-windows` alias, which has to keep working.
 */
function lastStyleTargets(std: BlockStdScope) {
  const gfx = std.get(GfxControllerIdentifier);
  const lastStyle = std.get(EditPropsStore).lastUsedStyle$.value;
  if (!Object.keys(lastStyle).length) return [];

  return gfx.selection.selectedElements.flatMap(element => {
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
}

export const coreCommands: CommandDescriptor[] = [
  {
    id: 'undo',
    owner: 'core',
    kind: 'action',
    labelKey: 'com.affine.keyboardShortcuts.undo',
    labelFallback: 'Undo',
    surfaces: ['palette', 'agent'],
    scope: 'global',
    defaultKeys: { mac: ['Mod-z'], other: ['Mod-z'] },
    availability: 'always',
    run: std => {
      if (std.store.canUndo) std.store.undo();
    },
  },
  {
    id: 'redo',
    owner: 'core',
    kind: 'action',
    labelKey: 'com.affine.keyboardShortcuts.redo',
    labelFallback: 'Redo',
    surfaces: ['palette', 'agent'],
    scope: 'global',
    defaultKeys: { mac: ['Shift-Mod-z'], other: ['Shift-Mod-z'] },
    availability: 'always',
    run: std => {
      if (std.store.canRedo) std.store.redo();
    },
  },
  {
    // Windows-only redo alias (Ctrl+Y); not bound on mac (empty combo).
    id: 'redo-windows',
    owner: 'core',
    kind: 'action',
    labelKey: 'com.affine.keyboardShortcuts.redo',
    labelFallback: 'Redo',
    // Not offered as a command: it is a platform alias of `redo`, not a second
    // capability. It stays bindable in Settings › Shortcuts like every command.
    surfaces: [],
    scope: 'global',
    defaultKeys: { mac: [], other: ['Control-y'] },
    availability: 'always',
    when: () => IS_WINDOWS,
    run: std => {
      if (std.store.canRedo) std.store.redo();
    },
  },
  {
    // Duplicate the current edgeless selection. Mod+D is the browser
    // "add bookmark" gesture, so the projection always preventDefaults when it
    // acts. On mac Mod resolves to Cmd (Cmd+D = duplicate) which coexists with
    // the imperative Ctrl+D = delete binding (see `edgeless-keyboard.ts`); on
    // Windows/Linux Mod resolves to Ctrl (Ctrl+D = duplicate).
    id: 'duplicate',
    owner: 'core',
    kind: 'action',
    labelKey: 'com.affine.keyboardShortcuts.duplicate',
    labelFallback: 'Duplicate',
    surfaces: ['palette', 'agent'],
    scope: 'edgeless',
    defaultKeys: { mac: ['Mod-d'], other: ['Mod-d'] },
    availability: 'selection',
    run: std => {
      const elements = std.get(GfxControllerIdentifier).selection
        .selectedElements;
      const rootId = std.store.root?.id;
      const edgeless = rootId ? std.view.getBlock(rootId) : null;
      if (!edgeless) return;
      duplicate(edgeless, elements).catch(console.error);
    },
  },
  {
    // Apply the last used style to the selected elements. "Last used" is the
    // flat accumulation of every style prop the user recorded (every style
    // edit and style pick records it), across element types: a fill picked on
    // a rect repaints an ellipse, a font style set on a text restyles a
    // shape. Each element only receives the props its own type supports —
    // schema-filtered per prop, so geometry and content are never touched.
    id: 'applyLastStyle',
    owner: 'core',
    kind: 'action',
    labelKey: 'com.affine.keyboardShortcuts.applyLastStyle',
    labelFallback: 'Apply last style',
    surfaces: ['palette', 'agent'],
    scope: 'edgeless',
    defaultKeys: { mac: ['Mod-y'], other: ['Mod-y'] },
    availability: 'selection',
    when: std => lastStyleTargets(std).length > 0,
    run: std => {
      const targets = lastStyleTargets(std);
      if (!targets.length) return;
      // One history frame: a single undo restores the previous styles.
      std.store.captureSync();
      const crud = std.get(EdgelessCRUDIdentifier);
      for (const { id, props } of targets) {
        crud.updateElement(id, props);
      }
    },
  },
];
