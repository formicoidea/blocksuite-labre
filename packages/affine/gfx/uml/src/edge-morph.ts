import {
  type MorphLabel,
  morphLabel,
  type MorphSpec,
} from '@labre/affine-block-surface';
import { ConnectorElementModel } from '@labre/affine-model';
import type { GfxPrimitiveElementModel, RoleId } from '@labre/std/gfx';
import type { TemplateResult } from 'lit';

import { umlCommandIcons, umlCommands } from './commands.js';
import { UML_EDGE_WIDTH, UML_INK } from './consts.js';
import { UML_EDGE_STYLE, type UmlEdgeRole } from './edge-styles.js';
import { UML_ROLE } from './roles.js';

/**
 * What a UML RELATIONSHIP may become — the same dropdown as the node morph, on a
 * selected connector.
 *
 * ## Why an edge needs this more than a node does
 *
 * Because an edge is the thing a modeller gets wrong most often, and redrawing
 * it is the most expensive to undo. A node morph saves a box and three lines of
 * words; an edge morph saves the two ENDPOINTS — which element each end is
 * attached to, and where on its perimeter — and those are precisely what a
 * delete-and-redraw destroys. "This is really a composition, not an
 * association", discovered halfway through a class diagram, is modelling
 * (§11.5.3 is a whole clause about when it is which), and today the only way
 * through it is to delete the line, re-drag it between the same two boxes and
 * hope both ends reattach where they were.
 *
 * ## The four families, and why they are four
 *
 * Grouped by what the relationship IS, which is also what the specification
 * groups them by:
 *
 *  - **association, aggregation, composition, communication path** — §11.5 and
 *    §19.4.4: one metaclass (Association), and the difference between the first
 *    three is `aggregation` = none / shared / composite. These are literally the
 *    same model element with one property changed, which is as close to "the
 *    same thing said more precisely" as UML gets. A CommunicationPath joins them
 *    rather than standing alone because §19.4.4 defines it AS an Association
 *    between nodes and draws it as one — a plain solid line — so a line an
 *    author drew between two servers and one they drew between two classes are
 *    the same drawing, and the swap is the correction a reader of a deployment
 *    diagram actually needs;
 *  - **generalization, realization** — §9.9.7 and §10.4.3: both say "this one
 *    conforms to that one", both are drawn with the hollow triangle, and the
 *    dashed line is the whole visual difference. A designer who drew a
 *    generalization to an interface meant a realization often enough that the
 *    swap is the point;
 *  - **dependency, include, extend** — §7.8 and §18.1.4: all three are
 *    dependencies drawn identically and told apart by their keyword alone, which
 *    is exactly the case where a picture cannot show a mistake and a dropdown
 *    can fix one;
 *  - **deploy, manifest** — §19.2.4 and §19.3.4: both are dependencies FROM an
 *    artifact drawn as that same dashed arrow, and what separates them is which
 *    end it lands on — a node (this artifact runs there) or a component (this
 *    artifact IS that component, in the flesh). They are their own family rather
 *    than three more members of the one above precisely because the confusion is
 *    between the two of them: an author who dropped a `.war` on a diagram and
 *    arrowed it at the wrong neighbour has made the one mistake this dropdown
 *    fixes, and offering them `«include»` alongside would be offering a use-case
 *    relationship on a deployment diagram.
 *
 *  - **control flow, object flow** — §15.2.4: one drawing (a solid open arrow),
 *    told apart by what the line runs BETWEEN rather than by anything on it.
 *
 *  - **synchronous, asynchronous and reply messages** — §17.4.4: one line, told
 *    apart by a filled head, an open head and a dash. See the declaration.
 *
 * ## The anchor, the transition and the two placed messages are in no family
 *
 * Deliberately, and the anchor is the edge equivalent of C4's `component`: an
 * anchor joins a note to what it comments on (Annex A). It is not a
 * relationship between classifiers at all, it carries no semantics, and
 * offering to turn one into a composition would invite a diagram claiming that
 * a comment owns a class. A kind in no family never offers the menu, so an
 * anchor's toolbar is the plain connector's.
 *
 * A TRANSITION is alone for the opposite reason: it is drawn exactly like the
 * two activity edges beside it (§14.2.4.8 and §15.2.4 are the same solid open
 * arrow), and it is still not one of them, because it lives on the other
 * diagram. A state machine's arrow joins two STATES and carries
 * `trigger [guard] / effect`; an activity's joins two ACTIONS and carries a
 * guard. Offering the swap would put an activity edge on a state machine, which
 * is what the per-frame admissibility lists exist to refuse — a dropdown must
 * not hand a user the error the audit is about to report.
 *
 * A CREATE and a DELETE message are alone for a third reason, and it is about
 * WHERE THE LINE LANDS rather than about what it looks like. §17.4.4 draws a
 * create message exactly like a reply and a delete message exactly like a
 * synchronous call, and what makes each of them what it is, is its far end: a
 * create arrives on the HEAD of the lifeline it brings into existence, and a
 * delete arrives at a destruction cross. Offering them in the family above
 * would let one click retype an ordinary call as a creation whose target is a
 * spine — a line the drawing cannot show as wrong and `uml.message-endpoints`
 * is about to report. The swap a modeller actually wants there is to move the
 * end, which the canvas already does.
 */
export type UmlEdgeKind = UmlEdgeRole;

/**
 * Every edge kind the pack draws — derived from the style table, which is the
 * one place they are enumerated.
 */
export const UML_EDGE_KINDS = Object.keys(UML_EDGE_STYLE) as UmlEdgeKind[];

/** See the module docblock: four families, and the anchor in none of them. */
export const UML_EDGE_FAMILIES: readonly (readonly UmlEdgeKind[])[] = [
  // Declaration order is menu order, and each family opens on its PLAIN member:
  // the undecorated relationship is the honest first draft and the decorated one
  // is the refinement — the same call the node morph and the sub-menu make.
  // `communication-path` sits here because it is DRAWN as an association
  // (§19.4.4) — while `roles.ts` files `uml:communication-path` flat, outside
  // `uml:association`, so that association rules and readings never reach a
  // deployment sheet. Two answers, two questions (drawing vs rule reach).
  ['association', 'aggregation', 'composition', 'communication-path'],
  ['generalization', 'realization'],
  ['dependency', 'include', 'extend'],
  // APPENDED, never inserted: the three families above keep their index, which
  // is what lets the suite go on naming the dependency family by position.
  ['deploy', 'manifest'],
  // §15.2.4 — the two ACTIVITY edges, and the fifth family. Both are the same
  // solid open arrow and the specification tells them apart by what the line
  // runs BETWEEN: a flow that touches an object node is an object flow, every
  // other one is a control flow. That is precisely the mistake a modeller makes
  // — drawing the arrow through a data object and leaving it typed as control —
  // and it is invisible on the canvas, which is the case a dropdown exists for.
  ['control-flow', 'object-flow'],
  // §17.4.4 — the three MESSAGES an interaction is mostly made of, and the
  // sixth family. This is the case the edge morph exists for, more clearly than
  // any family above it: the three are one line told apart by a FILLED head, an
  // open head and a dash, the distinction is the whole semantics of a sequence
  // diagram — does the caller wait, or not — and it is exactly what a modeller
  // gets backwards while laying out a conversation. Redrawing the line would
  // cost both ends, which on a sequence diagram is the HEIGHT the message
  // happens at as well as which participants it runs between.
  //
  // `message-sync` opens it, as every family above opens on its plain member:
  // a call whose caller waits is what `a -> b` means everywhere, and the other
  // two are the refinements.
  ['message-sync', 'message-async', 'message-reply'],
];

/**
 * Which UML edge a connector's ROLE says it is — `undefined` for every connector
 * that is not one of ours.
 *
 * `Partial` is the honest type rather than a defensive one: this question is
 * asked of EVERY connector a user selects, and most of them are plain lines, a
 * BPMN sequence flow or a C4 relationship. A total `Record<RoleId, …>` would
 * type that answer away and leave `kindOf` promising a kind for a role it has
 * never heard of.
 *
 * Derived from {@link UML_ROLE}, so a relationship renamed in the vocabulary is
 * renamed here in the same edit.
 */
export const UML_EDGE_KIND_OF_ROLE: Readonly<
  Partial<Record<RoleId, UmlEdgeKind>>
> = Object.fromEntries(
  UML_EDGE_KINDS.map(kind => [UML_ROLE[kind], kind] as const)
);

/**
 * The creation command that arms each edge, keyed BY its kind.
 *
 * Derived from `telemetry.element` (`connector:composition`) exactly as the node
 * morph derives its own from `node:interface`: the kind is already written down
 * there, and a second table of labels and icons would drift from the sub-menu's.
 */
const EDGE_COMMANDS = new Map(
  umlCommands.flatMap(command => {
    const element = command.telemetry?.element;
    return element?.startsWith('connector:')
      ? [[element.slice('connector:'.length), command] as const]
      : [];
  })
);

/** A kind's wording: the tool command's own key and English. */
function labelOf(kind: UmlEdgeKind): MorphLabel {
  const command = EDGE_COMMANDS.get(kind);
  return {
    key: command?.labelKey,
    fallback: command?.labelFallback ?? kind,
  };
}

/** A kind's icon: the tool command's own, reused rather than redrawn. */
function iconOf(kind: UmlEdgeKind): TemplateResult {
  const iconKey = EDGE_COMMANDS.get(kind)?.iconKey;
  return (
    (iconKey && umlCommandIcons[iconKey]) || umlCommandIcons['uml.association']
  );
}

/**
 * The WHOLE patch one relationship kind is worth — the same six props
 * `activateUmlEdge` arms a fresh connector with, read off the same table.
 *
 * ## Why all six and not just the role
 *
 * Because on this table it is visibly not enough: a composition and an
 * association differ ONLY in the filled diamond on the front end, a realization
 * and a generalization ONLY in the dashes. A `{role}` patch would write the
 * meaning and leave the picture stating the previous one — a line the exporter
 * calls a composition and a reader calls an association, which is the single
 * worst outcome a notation pack can produce.
 *
 * The ink and the weight ride along for the reason the node morph's whole preset
 * does: a morphed edge and one freshly drawn from the toolbox must be the same
 * element, and an edge somebody restyled by hand is an edge whose style this
 * gesture is explicitly resetting.
 *
 * ## The one prop that is NOT here
 *
 * `mode`. The router is a LAYOUT decision — straight, orthogonal, curved — and a
 * user who dragged a line into an elbow to get it round a box did that to the
 * drawing, not to the relationship. It is the geometry of the edge in the sense
 * `xywh` is the geometry of a node, and the morph's contract is that geometry is
 * the user's. The omission is inert on today's table anyway, since all nine are
 * armed straight; it is stated so that it stays inert on purpose.
 */
export function umlEdgeProps(kind: UmlEdgeKind): Record<string, unknown> {
  return {
    role: UML_ROLE[kind],
    stroke: UML_INK,
    strokeWidth: UML_EDGE_WIDTH,
    ...UML_EDGE_STYLE[kind],
  };
}

/**
 * UML's edge morph declaration, handed to the generic `morphToolbarConfig`.
 *
 * `modelType` is `ConnectorElementModel` and there is NO `resolveTarget`: unlike
 * a classifier, a relationship is one element — what the user selects, what
 * carries the role and what the patch lands on are the same object. The gate is
 * therefore entirely in {@link kindOf}: a plain connector, a BPMN sequence flow
 * and a C4 relationship all carry a role this table does not know (or none at
 * all), so they answer `undefined` and are never offered the menu.
 *
 * `clearOf` is empty, and hard-coded rather than derived: every kind writes the
 * same six keys, because they all come from one table with no conditional
 * spread in it. The day a row grows a key the others lack, this is where the
 * deletion goes.
 */
export const UML_EDGE_MORPH_SPEC: MorphSpec<UmlEdgeKind> = {
  framework: 'uml',
  families: UML_EDGE_FAMILIES,
  modelType: ConnectorElementModel,
  kindOf: (model: GfxPrimitiveElementModel) =>
    model.role === undefined ? undefined : UML_EDGE_KIND_OF_ROLE[model.role],
  // A relationship's kind IS its role, one for one — there is no collapsing to
  // do here, unlike the node table where two C4 kinds share one role.
  roleOf: kind => UML_ROLE[kind],
  propsOf: umlEdgeProps,
  clearOf: () => [],
  labelOf,
  iconOf,
  // The same wording as the node dropdown, and the same key: a user meets one
  // affordance called one thing, whether what they selected is a box or a line.
  label: morphLabel('com.labre.morph.toolbar.label', 'Change type'),
};
