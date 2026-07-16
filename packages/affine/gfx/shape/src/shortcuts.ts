import { ShapeElementModel, TextFitMode } from '@labre/affine-model';
import type { ShortcutDescriptor } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';

import { applyTextFitMode, nextTextFitMode } from './text-fit.js';

/**
 * Shape shortcuts (edgeless scope, always-on — shapes are core canvas).
 * Host-rebindable via `ShortcutOverrides`.
 */
export const shapeShortcuts: ShortcutDescriptor[] = [
  {
    id: 'shape.cycleTextFit',
    labelKey: 'com.labre.keyboardShortcuts.shape.cycleTextFit',
    defaultKeys: { mac: ['Mod-Shift-f'], other: ['Mod-Shift-f'] },
    scope: 'edgeless',
    owner: 'core',
    handler: std => ctx => {
      const gfx = std.get(GfxControllerIdentifier);
      if (gfx.selection.editing) return false;

      const models = gfx.selection.selectedElements.filter(
        (el): el is ShapeElementModel =>
          el instanceof ShapeElementModel && !!el.text
      );
      if (!models.length) return false;

      ctx.get('defaultState').event.preventDefault();
      const mode = models[0].textFitMode ?? TextFitMode.Grow;
      applyTextFitMode(std, models, nextTextFitMode(mode));
      return true;
    },
  },
];
