import { DefaultTool } from '@labre/affine-block-surface';
import type { SerializedElementProps } from '@labre/affine-block-surface/interchange';
import type { BlockStdScope } from '@labre/std';
import { type GfxController, GfxControllerIdentifier } from '@labre/std/gfx';

import { HEX_SIZE } from './estuarine/consts';
import {
  CYNEFIN_H,
  CYNEFIN_W,
  ESTUARINE_MAP_H,
  ESTUARINE_MAP_W,
} from './presets';
import {
  constraintHexagonElement,
  cynefinElement,
  estuarineMapElement,
} from './toolbox';

/**
 * Creation actions for the Cynefin / Estuarine toolbox — lifted out of
 * `toolbar/menu.ts` by PF3. This is also the framework that emitted NO
 * telemetry at all before the switchover: routing every surface through
 * `runCommand` fixes that for free (`docs/adr/0008`).
 *
 * What each artefact IS lives in `presets.ts`, which the palette reads too: the
 * templates used to restate these props and drifted from them. What the
 * toolbar places comes from the ONE assembly a host with no editor also calls
 * (`toolbox.ts`, `docs/adr/0045`); only the viewport centre and the selection
 * stay here.
 */

const gfxOf = (std: BlockStdScope) => std.get(GfxControllerIdentifier);

function finish(gfx: GfxController, id: string) {
  gfx.doc.captureSync();
  gfx.tool.setTool(DefaultTool);
  gfx.selection.set({ elements: [id], editing: false });
}

/** The top-left an artefact of the given size is born at, centred on the viewport. */
function centered(gfx: GfxController, width: number, height: number) {
  const { centerX, centerY } = gfx.viewport;
  return { x: centerX - width / 2, y: centerY - height / 2 };
}

/** Write one built element; the builder's local id is the editor's to mint. */
function place(gfx: GfxController, element: SerializedElementProps) {
  const surface = gfx.surface;
  if (!surface) return;
  const { id: _local, ...props } = element;
  finish(gfx, surface.addElement(props));
}

export function createCynefin(std: BlockStdScope) {
  const gfx = gfxOf(std);
  place(gfx, cynefinElement(centered(gfx, CYNEFIN_W, CYNEFIN_H)));
}

export function createEstuarineMap(std: BlockStdScope) {
  const gfx = gfxOf(std);
  place(
    gfx,
    estuarineMapElement(centered(gfx, ESTUARINE_MAP_W, ESTUARINE_MAP_H))
  );
}

export function createConstraintHexagon(std: BlockStdScope) {
  const gfx = gfxOf(std);
  place(gfx, constraintHexagonElement(centered(gfx, HEX_SIZE, HEX_SIZE)));
}
