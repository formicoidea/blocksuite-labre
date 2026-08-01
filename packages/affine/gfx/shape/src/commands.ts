import { ShapeElementModel, TextFitMode } from '@labre/affine-model';
import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';

import { applyTextFitMode, nextTextFitMode } from './text-fit.js';

/**
 * Shape commands (edgeless scope, always-on — shapes are core canvas), so
 * `owner: 'core'` rather than a framework. Host-rebindable through
 * `ShortcutOverrides` exactly as before (`docs/adr/0008`).
 */

/** The selected shapes that carry text — the ones the gesture would cycle. */
const textShapes = (std: BlockStdScope) =>
  std
    .get(GfxControllerIdentifier)
    .selection.selectedElements.filter(
      (el): el is ShapeElementModel =>
        el instanceof ShapeElementModel && !!el.text
    );

export const shapeCommands: CommandDescriptor[] = [
  {
    id: 'shape.cycleTextFit',
    owner: 'core',
    kind: 'action',
    labelKey: 'com.labre.keyboardShortcuts.shape.cycleTextFit',
    labelFallback: 'Cycle text fit',
    surfaces: ['palette', 'agent'],
    scope: 'edgeless',
    defaultKeys: { mac: ['Mod-Shift-f'], other: ['Mod-Shift-f'] },
    availability: 'selection',
    when: std => textShapes(std).length > 0,
    run: std => {
      const models = textShapes(std);
      if (!models.length) return;
      const mode = models[0].textFitMode ?? TextFitMode.Grow;
      applyTextFitMode(std, models, nextTextFitMode(mode));
    },
  },
];
