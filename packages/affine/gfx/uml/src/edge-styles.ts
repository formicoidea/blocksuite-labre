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

/**
 * The edges the toolbox arms, by their role's local name.
 *
 * APPEND-ONLY, and the three at the bottom are phase 2's: a deployment diagram
 * is drawn with lines of its own (§19.2.4, §19.3.4, §19.4.4) and they are added
 * after the nine rather than filed among them, so a union somebody reads top to
 * bottom still tells the story of how the pack grew.
 */
export type UmlEdgeRole =
  | 'association'
  | 'aggregation'
  | 'composition'
  | 'generalization'
  | 'realization'
  | 'dependency'
  | 'anchor'
  | 'include'
  | 'extend'
  // Phase 2 — components and deployment.
  | 'deploy'
  | 'manifest'
  | 'communication-path'
  // Phase 2 — behaviour: the two edges an ACTIVITY is wired with (§15.2.4) and
  // the one a STATE MACHINE is (§14.2.4.8).
  | 'control-flow'
  | 'object-flow'
  | 'transition';

/** The three style props an edge kind actually differs on. */
export interface UmlEdgeStyle {
  strokeStyle: StrokeStyle;
  frontEndpointStyle: PointStyle;
  rearEndpointStyle: PointStyle;
}

/**
 * The whole UML line notation, in one table — §11.5.4 (association, aggregation
 * and composition), §9.2.4 (generalization), §10.4.4 (interface realization),
 * §7.8.4 (dependency and anchor), §18.1.4 (include, extend) and, since phase 2,
 * §19.2.4 (deployment), §19.3.4 (manifestation) and §19.4.4 (communication
 * path).
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
 * ## The five that share a look
 *
 * A dependency, an include, an extend, a deployment and a manifestation are all
 * a dashed line with an open arrowhead, and the specification is explicit that
 * they are told apart by the KEYWORD written on them («use», «include»,
 * «extend», «deploy», «manifest» — §7.8.4, §18.1.4, §19.2.4, §19.3.4), not by
 * their drawing: all five ARE Dependencies. So they share a row here and differ
 * only by the ROLE, which is what the export writes the keyword from. Nothing on
 * the canvas is lost: the role is what the audit, the reading profile and the
 * exporter all read.
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
  // A Deployment is a Dependency (§19.2.4): the artifact is the client, the node
  // the supplier, and the picture is the dashed open arrow every dependency
  // wears — told apart, as always, by the keyword the export writes from the
  // role rather than by a drawing of its own.
  deploy: {
    strokeStyle: StrokeStyle.Dash,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Arrow,
  },
  // A Manifestation is an Abstraction, and therefore a Dependency too (§19.3.4)
  // — same line, from the artifact to the component it is the physical form of.
  manifest: {
    strokeStyle: StrokeStyle.Dash,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Arrow,
  },
  // A CommunicationPath is an Association between two nodes (§19.4.4), so it is
  // drawn exactly as one: a plain solid line, and nothing on either end. The
  // absence of arrowheads is the statement — a network link between two servers
  // has no client and no supplier, and a head would invent one.
  'communication-path': {
    strokeStyle: StrokeStyle.Solid,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.None,
  },
  // ── Behaviour: the third drawing this table has ever needed ────────────────
  //
  // §15.2.4 draws an ActivityEdge as a SOLID line with an OPEN ARROWHEAD, and
  // §14.2.4.8 draws a Transition as exactly the same line. That is a look no
  // structural relationship wears: an association is solid with nothing on it,
  // a dependency is the arrowhead on a DASHED line. The distinction matters and
  // is the specification's own — a behaviour diagram states an ORDER of things
  // and therefore always points, where a class diagram states a relationship
  // and mostly does not.
  //
  // Control flow and object flow share the row, as the five dependencies above
  // share theirs and for the same reason: §15.2.4 tells them apart by what sits
  // at the ENDS of the line — an object node at one end makes it an object flow
  // — not by a decoration on the line, and the ROLE is what the audit and the
  // exporter read that from. (An object flow drawn between two pins can be
  // shown with the pins collapsed into a rectangle on the line; that is a
  // §15.4.4 shorthand for the NODES, not a second line style, so it does not
  // belong here.)
  'control-flow': {
    strokeStyle: StrokeStyle.Solid,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Arrow,
  },
  'object-flow': {
    strokeStyle: StrokeStyle.Solid,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Arrow,
  },
  // A Transition (§14.2.4.8) is the same arrow, and the `trigger [guard] /
  // effect` it carries is written on the line as its centre label rather than
  // drawn into it — which is why this row is a copy of the two above and the
  // grammar, not the style table, is where that syntax lives.
  transition: {
    strokeStyle: StrokeStyle.Solid,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Arrow,
  },
};
