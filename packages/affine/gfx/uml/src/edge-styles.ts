import { PointStyle, StrokeStyle } from '@labre/affine-model';

/**
 * The UML line notation, as data — read by the TOOL that arms a fresh connector
 * (`actions.ts`) and by the MORPH that retypes one already drawn
 * (`edge-morph.ts`).
 *
 * It lives in a module of its own for exactly that reason. A relationship drawn
 * from the toolbox and one an author changed his mind about must be the same
 * element down to the last endpoint, and the only way to guarantee that is for
 * the two sites to read one table rather than to agree about two. The file also
 * keeps the morph — pure data, no editor — free of `actions.ts`, which pulls in
 * the std scope, the gfx controller and the surface.
 */

/** The nine edges the phase-1 toolbox arms, by their role's local name. */
export type UmlEdgeRole =
  | 'association'
  | 'aggregation'
  | 'composition'
  | 'generalization'
  | 'realization'
  | 'dependency'
  | 'anchor'
  | 'include'
  | 'extend';

/** The three style props an edge kind actually differs on. */
export interface UmlEdgeStyle {
  strokeStyle: StrokeStyle;
  frontEndpointStyle: PointStyle;
  rearEndpointStyle: PointStyle;
}

/**
 * The whole UML line notation, in one table — §11.5.4 (association, aggregation
 * and composition), §9.2.4 (generalization), §10.4.4 (interface realization),
 * §7.8.4 (dependency and anchor) and §18.1.4 (include, extend).
 *
 * ## Three props, and never a fourth
 *
 * UML tells its relationships apart by TWO things and only two: whether the line
 * is solid or dashed, and what is drawn on its ends. Never by colour — the
 * specification has none — and never by thickness, which is why `UML_EDGE_WIDTH`
 * is one constant rather than a column here. A pack that distinguished an
 * association from a dependency by making one heavier would be inventing a
 * notation on top of the one it claims to implement.
 *
 * ## Which end carries the mark
 *
 * `front` is the SOURCE end, `rear` the target end, and the difference is the
 * whole semantics of four of these nine:
 *
 *  - **aggregation / composition** put their diamond on the FRONT, because the
 *    source of these roles is the WHOLE (`roles.ts`: "is composed of"). Hollow
 *    for shared aggregation, filled for composite — §11.5.4's one visual
 *    difference, and the one everybody misdraws;
 *  - **generalization / realization** put a hollow triangle on the REAR, because
 *    their source is the SPECIFIC one ("is a", "realizes") and the triangle
 *    points at the general. Solid for generalization, dashed for realization:
 *    §10.4.4 draws a realization as the generalization arrow on a broken line,
 *    and that is the only thing that separates them.
 *
 * ## The three that share a look
 *
 * A dependency, an include and an extend are all a dashed line with an open
 * arrowhead, and the specification is explicit that they are told apart by the
 * KEYWORD written on them («use», «include», «extend» — §7.8.4, §18.1.4), not by
 * their drawing. So they share a row here and differ only by the ROLE, which is
 * what the export writes the keyword from. Nothing on the canvas is lost: the
 * role is what the audit, the reading profile and the exporter all read.
 *
 * ## The anchor
 *
 * Dashed with nothing on either end (Annex A): an anchor joins a note to what it
 * comments on and claims no direction, so an arrowhead would be the picture
 * making a statement the role explicitly refuses to make — the same argument
 * BPMN's association makes for the same absence.
 */
export const UML_EDGE_STYLE: Record<UmlEdgeRole, UmlEdgeStyle> = {
  association: {
    strokeStyle: StrokeStyle.Solid,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.None,
  },
  aggregation: {
    strokeStyle: StrokeStyle.Solid,
    frontEndpointStyle: PointStyle.DiamondHollow,
    rearEndpointStyle: PointStyle.None,
  },
  composition: {
    strokeStyle: StrokeStyle.Solid,
    frontEndpointStyle: PointStyle.Diamond,
    rearEndpointStyle: PointStyle.None,
  },
  generalization: {
    strokeStyle: StrokeStyle.Solid,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.TriangleHollow,
  },
  realization: {
    strokeStyle: StrokeStyle.Dash,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.TriangleHollow,
  },
  dependency: {
    strokeStyle: StrokeStyle.Dash,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Arrow,
  },
  include: {
    strokeStyle: StrokeStyle.Dash,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Arrow,
  },
  extend: {
    strokeStyle: StrokeStyle.Dash,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Arrow,
  },
  anchor: {
    strokeStyle: StrokeStyle.Dash,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.None,
  },
};
