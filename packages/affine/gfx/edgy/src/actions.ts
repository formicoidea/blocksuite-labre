import { DefaultTool } from '@labre/affine-block-surface';
import { ConnectorTool } from '@labre/affine-gfx-connector';
import { createGroupCommand } from '@labre/affine-gfx-group';
import { createTemplateJob } from '@labre/affine-gfx-template';
import { ConnectorMode, PointStyle, StrokeStyle } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { type GfxController, GfxControllerIdentifier } from '@labre/std/gfx';

import { edgyElementLabel, edgyElementLabelKey } from './metamodel';
import {
  NODE_LABEL,
  nodeLabelKey,
  NODE_SIZE,
  NODE_STROKE,
} from './node/consts';
import {
  EDGY_BOARD_SIZE,
  type EdgyBoxKind,
  RELATION_STROKE_WIDTH,
} from './presets';
import { EDGY_ROLE } from './roles';
import { edgyDynamicTemplate } from './templates/dynamic';
import {
  EDGY_FACETS_SIZE,
  EDGY_PEOPLE_SIZE,
  edgyBoardElement,
  edgyBoxElement,
  edgyFacetsElement,
  edgyPeopleElements,
} from './toolbox';

/**
 * Standalone creation actions for the EDGY toolbox — the behaviour layer,
 * lifted out of `toolbar/edgy-menu.ts` by PF3 so the menu can become a pure
 * renderer over the command registry. They emit no telemetry: the single
 * emission point is `runCommand` (`docs/adr/0008`).
 *
 * What they place comes from the ONE assembly a host with no editor also
 * calls (`toolbox.ts`, `docs/adr/0045`); what stays here is what only an
 * editor has: the viewport centre, the seeds resolved in the host's language
 * (`docs/adr/0023`), the group command and the selection.
 */

const gfxOf = (std: BlockStdScope) => std.get(GfxControllerIdentifier);

function finish(gfx: GfxController, id: string) {
  gfx.doc.captureSync();
  gfx.tool.setTool(DefaultTool);
  gfx.selection.set({ elements: [id], editing: false });
  // Keep the palette open (native sub-menu behaviour).
}

/**
 * Create the Enterprise Design Facets diagram centred on the viewport —
 * cropped to the circles + facet labels (no dead margins around the Venn).
 */
export function createEdgyFacets(std: BlockStdScope) {
  const gfx = gfxOf(std);
  if (!gfx.surface) return;

  const { w, h } = EDGY_FACETS_SIZE;
  const { centerX, centerY } = gfx.viewport;
  const zone = (name: 'identity' | 'architecture' | 'experience') =>
    translateKey(std, edgyElementLabelKey(name), edgyElementLabel(name));
  const { id: _local, ...props } = edgyFacetsElement(
    { x: centerX - w / 2, y: centerY - h / 2 },
    // The three facet names, written HERE rather than left to the model's
    // defaults (`EdgyFacetsElementModel.identityLabel` etc — a red-zone
    // field: a document created before this key existed keeps its literal
    // 'Identity' / 'Architecture' / 'Experience' verbatim). Shares its key
    // with the very same words wherever the metamodel names a zone
    // (`edgyElementLabelKey`, `templates/dynamic.ts`, `templates/index.ts`).
    {
      identity: zone('identity'),
      architecture: zone('architecture'),
      experience: zone('experience'),
    }
  );
  finish(gfx, gfx.surface.addElement(props));
}

/**
 * Insert the "EDGY dynamic" template (facets background + the 12 elements
 * linked by the 24 verbalised relations), then bring it into view.
 */
export async function createEdgyDynamic(std: BlockStdScope) {
  const gfx = gfxOf(std);
  if (!gfx.surface) return;

  const job = createTemplateJob(std, 'template');
  // Resolved through `localize` rather than the raw `content`: this action IS
  // the command the Templates panel derives "EDGY dynamic" from
  // (`templates/dynamic.ts`), and inserting the English snapshot here would
  // make the two paths disagree — a senior-menu insertion staying English
  // while the very same card from the panel comes out translated.
  const snapshot = edgyDynamicTemplate.localize
    ? edgyDynamicTemplate.localize(std)
    : edgyDynamicTemplate.content;
  const bound = await job.insertTemplate(structuredClone(snapshot));
  if (bound) {
    const padding = 20 / gfx.viewport.zoom;
    gfx.viewport.setViewportByBound(
      bound,
      [padding, padding, padding, padding],
      true
    );
  }
  gfx.doc.captureSync();
  gfx.tool.setTool(DefaultTool);
}

/** Create a blank EDGY board (hover spotlight host) centred on the viewport. */
export function createEdgyBoard(std: BlockStdScope) {
  const gfx = gfxOf(std);
  if (!gfx.surface) return;

  const { w, h } = EDGY_BOARD_SIZE;
  const { centerX, centerY } = gfx.viewport;
  const { id: _local, ...props } = edgyBoardElement({
    x: centerX - w / 2,
    y: centerY - h / 2,
  });
  finish(gfx, gfx.surface.addElement(props));
}

/** Create a box base element (outcome / object / activity) with inner text. */
export function createEdgyBox(std: BlockStdScope, kind: EdgyBoxKind) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const { w, h } = NODE_SIZE[kind];
  const { centerX: cx, centerY: cy } = gfx.viewport;

  const { id: _local, ...props } = edgyBoxElement(
    kind,
    { x: cx - w / 2, y: cy - h / 2 },
    // Translated HERE and once: what a gesture writes onto the canvas is
    // document content the moment it lands (`nodeLabelKey`).
    translateKey(std, nodeLabelKey(kind), NODE_LABEL[kind])
  );
  finish(gfx, surface.addElement(props));
}

/**
 * Create the People base element: an (invisible) ellipse decorated with the
 * person glyph by the renderer, plus a native text label below, grouped.
 */
export function createEdgyPeople(std: BlockStdScope) {
  const gfx = gfxOf(std);
  const surface = gfx.surface;
  if (!surface) return;

  const { centerX: cx, centerY: cy } = gfx.viewport;

  // The GLYPH, not the whole item, sits on the viewport centre, as it always
  // has: the item's box is as wide as the name and starts at the glyph's top.
  const elements = edgyPeopleElements(
    {
      x: cx - EDGY_PEOPLE_SIZE.w / 2,
      y: cy - NODE_SIZE.people.h / 2,
    },
    translateKey(std, nodeLabelKey('people'), NODE_LABEL.people)
  );
  const members: string[] = [];
  for (const { id: _local, ...props } of elements) {
    // The builder's group is for a host with no editor. Here the editor's own
    // group command makes it, because it writes what only an editor has: the
    // numbered "Group N" title from the host's catalogue and the user layer.
    if (props.type === 'group') continue;
    members.push(surface.addElement(props));
  }
  const nodeId = members[0];
  if (!nodeId) return;

  const [, result] = std.command.exec(createGroupCommand, {
    elements: members,
  });
  finish(gfx, result.groupId || nodeId);
}

/**
 * Activate the native connector tool for an EDGY RELATION: pre-styled like the
 * 24 links of the metamodel template, and stamped with the GENERIC role
 * `edgy:relation`.
 *
 * Generic on purpose, and this is the whole design (`./relation.ts`): the verb
 * of an EDGY relation is determined by the ordered pair of elements it runs
 * between — 24 rows, 24 distinct pairs — so there is nothing to ask the user
 * and nothing to pick from a list of twenty-two. The tool arms the parent role,
 * the user drags from the subject to the object, and `EdgyRelationResolver`
 * writes the verb the metamodel gives that pair, as a role and as the label.
 *
 * The style is the template's, to the pixel: straight, `NODE_STROKE`, two units
 * wide, and NO arrowhead at either end — EDGY's reference diagram draws its
 * relations as bare lines and lets the verb say which way the sentence runs.
 */
export function activateEdgyRelation(gfx: GfxController): void {
  gfx.tool.setTool(ConnectorTool, {
    mode: ConnectorMode.Straight,
    role: EDGY_ROLE.relation,
    // The look rides on the activation, never through the last-props store:
    // the plain connector tool must keep the user's own style (#144 M1).
    style: {
      stroke: NODE_STROKE,
      strokeStyle: StrokeStyle.Solid,
      strokeWidth: RELATION_STROKE_WIDTH,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.None,
    },
  });
  // Keep the palette open (native sub-menu behaviour): it only closes on
  // re-click of the senior button, another senior tool, or Escape.
}
