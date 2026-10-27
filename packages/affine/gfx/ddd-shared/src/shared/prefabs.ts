import {
  DefaultTool,
  type SerializedElementProps,
} from '@labre/affine-block-surface';
import { createGroupCommand } from '@labre/affine-gfx-group';
import type { BlockStdScope } from '@labre/std';
import { type GfxController, GfxControllerIdentifier } from '@labre/std/gfx';
import * as Y from 'yjs';

import {
  CLOUD,
  CM_BUBBLE,
  DOT_SIZE,
  MARKER_SIZE,
  STICKY_SIZE,
} from './consts.js';
import {
  bubbleElement,
  cloudElements,
  dddConnectorElement,
  dddShapeElement,
  dotElements,
  markerElements,
  type ShapeOpts,
  stickyElements,
} from './elements.js';

/**
 * Irreducible reusable units composed by all three DDD sub-menus. Each helper
 * writes the elements its pure builder returns (`elements.ts`,
 * `docs/adr/0045`) through native `surface.addElement` (shape / text /
 * connector) and the group command; nothing here defines a new element type,
 * so the same builders back Event Storming stickies, Context Map bubbles +
 * relationships and Core Domain dots + arrows, here and on a host with no
 * editor.
 *
 * What stays here is what only an editor has: the viewport centre the
 * prefabs are placed around, and the group command, which names the group
 * ("Group N", resolved in the host's language) and stamps its user layer.
 */

type Surface = NonNullable<GfxController['surface']>;

/**
 * Build one DDD artefact at the viewport centre and select it, leaving the
 * palette open so several can be added in a row. This is the old
 * `DddMenuBase.finish` — moved here when PF3 turned the three menus into pure
 * renderers over the command registry, since the placement is what the command
 * bodies need and the menu no longer has any.
 */
export function placeDddElement(
  std: BlockStdScope,
  build: (surface: Surface, cx: number, cy: number) => string
): void {
  const gfx = std.get(GfxControllerIdentifier);
  const surface = gfx.surface;
  if (!surface) return;
  const { centerX, centerY } = gfx.viewport;
  const id = build(surface, centerX, centerY);
  gfx.doc.captureSync();
  gfx.tool.setTool(DefaultTool);
  gfx.selection.set({ elements: [id], editing: false });
}

/** Group several element ids; returns the group id (or the first id on failure). */
export function groupIds(std: BlockStdScope, ids: string[]): string {
  const [, result] = std.command.exec(createGroupCommand, { elements: ids });
  return result.groupId || ids[0];
}

/**
 * A shape's label as the `Y.Text` the prefabs have always written. The shape
 * model's `propsToY` makes the same `Y.Text` of a string, so this changes
 * nothing stored; it keeps what `addElement` receives from a prefab what it
 * was before the builders existed.
 */
function withYText<T extends Record<string, unknown>>(props: T): T {
  return props.type === 'shape' && typeof props.text === 'string'
    ? { ...props, text: new Y.Text(props.text) }
    : props;
}

/**
 * Write a builder's elements in order, minting real ids for the local ones;
 * a group goes through the group command with its members' minted ids.
 * Returns the id of the last element: the group of a composite, the element
 * itself otherwise.
 */
function addElements(
  surface: Surface,
  std: BlockStdScope | undefined,
  elements: readonly SerializedElementProps[]
): string {
  const minted = new Map<string, string>();
  let last = '';
  for (const { id: local, ...props } of elements) {
    if (props.type === 'group' && std) {
      const children = Object.keys(props.children as Record<string, true>);
      last = groupIds(
        std,
        children.map(child => minted.get(child) ?? child)
      );
    } else {
      last = surface.addElement(withYText(props));
    }
    if (typeof local === 'string') minted.set(local, last);
  }
  return last;
}

/**
 * The props a DDD shape is CREATED with, as a record — the write of the
 * prefabs, minus the write.
 *
 * Split out for the Core Domain morph, and for the reason C4's `presets.ts`
 * gives: a kind's appearance is written by the preset of the kind it was created
 * as and nothing else ever rewrites it, so a morph that restated the table would
 * agree with the palette the day it was written and drift on the first restyle.
 * Derived, they cannot — a morphed dot and one freshly placed are the same
 * element.
 */
export function dddShapeProps(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: ShapeOpts
): Record<string, unknown> & { type: string } {
  return withYText(dddShapeElement(x, y, w, h, opts));
}

/**
 * A post-it: faux-shadow rect + coloured face whose label is the face's OWN
 * shape text in `contained` fit mode — like a real post-it, the box size is
 * fixed and the handwriting shrinks to fit. Grouped so shadow and face move
 * together. (Stickies created before the text-fit feature carry a separate
 * text element; they keep working untouched.)
 */
export function addSticky(
  surface: Surface,
  std: BlockStdScope,
  cx: number,
  cy: number,
  opts: {
    fill: string;
    text: string;
    label: string;
    shapeType?: 'rect' | 'diamond';
    size?: number;
    /**
     * Stamped on the FACE, never on the shadow: the face is the artefact — it
     * is what carries the words, what a connector attaches to and what the
     * grammar rules read. The shadow is ink.
     */
    role?: string;
  }
): string {
  const half = (opts.size ?? STICKY_SIZE) / 2;
  return addElements(
    surface,
    std,
    stickyElements({ x: cx - half, y: cy - half }, opts)
  );
}

/**
 * A Context Map bounded-context bubble: a rounded pill whose label is the
 * pill's own shape text in `overflow` fit mode (fixed pill, fixed font — a
 * long context name may spill out rather than deform the map).
 */
export function addBubble(
  surface: Surface,
  cx: number,
  cy: number,
  label: string,
  role?: string
): string {
  const { w, h } = CM_BUBBLE;
  return addElements(surface, undefined, [
    bubbleElement({ x: cx - w / 2, y: cy - h / 2 }, label, role),
  ]);
}

/** A Core Domain dot (sub-domain / bounded context); optional label to its right. */
export function addDot(
  surface: Surface,
  std: BlockStdScope,
  cx: number,
  cy: number,
  fill: string,
  label?: string,
  /** Stamped on the ELLIPSE, never on the group: the dot is the artefact. */
  role?: string
): string {
  const d = DOT_SIZE;
  return addElements(
    surface,
    std,
    dotElements({ x: cx - d / 2, y: cy - d / 2 }, fill, label, role)
  );
}

/** A relationship connector (the single connector unit reused for all patterns). */
export function addConnector(
  surface: Surface,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: {
    rearArrow?: boolean;
    dashed?: boolean;
    stroke?: string;
    strokeWidth?: number;
    /** Edge role; `undefined` leaves the connector a neutral line. */
    role?: string;
  } = {}
): string {
  return surface.addElement(
    dddConnectorElement({ position: [x1, y1] }, { position: [x2, y2] }, opts)
  );
}

/**
 * A Team Topologies interaction-mode marker: a coloured square + centred letter.
 *
 * The role rides on the SQUARE, never on the group — the same call as
 * {@link addDot}: the square is the artefact, the letter is its glyph and the
 * word beside it is a caption. `undefined` writes nothing, so a caller that
 * passes none keeps producing the neutral drawing it always did.
 */
export function addMarker(
  surface: Surface,
  std: BlockStdScope,
  cx: number,
  cy: number,
  opts: { fill: string; letter: string; label?: string; role?: string }
): string {
  const s = MARKER_SIZE;
  return addElements(
    surface,
    std,
    markerElements({ x: cx - s / 2, y: cy - s / 2 }, opts)
  );
}

/** A cloud (Big Ball of Mud / general-purpose boundary): a smoothed closed bezier polygon. */
export function addCloud(
  surface: Surface,
  std: BlockStdScope,
  cx: number,
  cy: number,
  label?: string,
  role?: string
): string {
  const { w, h } = CLOUD;
  return addElements(
    surface,
    std,
    cloudElements({ x: cx - w / 2, y: cy - h / 2 }, label, role)
  );
}
