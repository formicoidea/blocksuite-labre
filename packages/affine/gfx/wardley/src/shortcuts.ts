import type { ShortcutDescriptor } from '@labre/std';
import { type GfxController, GfxControllerIdentifier } from '@labre/std/gfx';

import {
  activateWardleyConnector,
  createWardleyBackground,
  createWardleyInertia,
  createWardleyNode,
  createWardleyPipeline,
  WARDLEY_SHORTCUT_SOURCE,
} from './actions';

/**
 * Wardley canvas chords: press `w`, then the action key. Edgeless-scoped and
 * registered by {@link WardleyViewExtension}, so they only exist when the
 * edgeless editor is mounted AND the `wardley` block flag is enabled. The
 * host can rebind or disable each id via `ShortcutOverrides`.
 *
 * This is the reference pattern for other frameworks: same shape with their
 * own prefix letter, listed in `FRAMEWORK_SHORTCUT_GROUPS` (manifest) and
 * registered via `ShortcutExtension` in their view extension (binding).
 */
const wardleyShortcut = (
  id: string,
  key: string,
  run: (gfx: GfxController) => void
): ShortcutDescriptor => ({
  id: `wardley.${id}`,
  labelKey: `com.labre.keyboardShortcuts.wardley.${id}`,
  defaultKeys: { mac: ['w', key], other: ['w', key] },
  scope: 'edgeless',
  owner: 'wardley',
  handler: std => ctx => {
    const gfx = std.get(GfxControllerIdentifier);
    // Never fire while editing text on the canvas.
    if (gfx.selection.editing) return false;
    ctx.get('defaultState').event.preventDefault();
    run(gfx);
    return true;
  },
});

export const wardleyShortcuts: ShortcutDescriptor[] = [
  wardleyShortcut('addComponent', 'c', gfx =>
    createWardleyNode(gfx, 'component', WARDLEY_SHORTCUT_SOURCE)
  ),
  wardleyShortcut('linkTool', 'l', gfx =>
    activateWardleyConnector(gfx, 'link', WARDLEY_SHORTCUT_SOURCE)
  ),
  wardleyShortcut('evolutionArrow', 'a', gfx =>
    activateWardleyConnector(gfx, 'arrow', WARDLEY_SHORTCUT_SOURCE)
  ),
  wardleyShortcut('addInertia', 'i', gfx =>
    createWardleyInertia(gfx, WARDLEY_SHORTCUT_SOURCE)
  ),
  wardleyShortcut('addPipeline', 'p', gfx =>
    createWardleyPipeline(gfx, WARDLEY_SHORTCUT_SOURCE)
  ),
  wardleyShortcut('addMethod', 'm', gfx =>
    createWardleyNode(gfx, 'method', WARDLEY_SHORTCUT_SOURCE)
  ),
  wardleyShortcut('addBackground', 'b', gfx =>
    createWardleyBackground(gfx, 'classic', WARDLEY_SHORTCUT_SOURCE)
  ),
];
