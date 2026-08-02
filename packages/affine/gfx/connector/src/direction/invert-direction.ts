import type { Connection, ConnectorElementModel } from '@labre/affine-model';
import { TelemetryProvider } from '@labre/affine-shared/services';
import type {
  AnyCommandDescriptor,
  BlockStdScope,
  CommandDescriptor,
} from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { z } from 'zod';

import { asTypedEdge, roleVocabularies, type TypedEdge } from './typed-edge.js';

/**
 * **M3 of `docs/adr/0010` — "let them fix it".**
 *
 * `edge.invert-direction` swaps `source` ↔ `target` on a selected typed edge,
 * and swaps `frontEndpointStyle` ↔ `rearEndpointStyle` with them, in ONE undo
 * step. It is the only supported inversion, and it is what makes the direction
 * a typed edge persists a statement the user can take back rather than a
 * by-product of which end their finger landed on first.
 *
 * ## What it deliberately does NOT touch
 *
 * `curveControlPoint` is an ABSOLUTE pass-through point at t = 0.5, and the
 * tangent formulas are symmetric under a `P0` ↔ `P3` exchange
 * (`connector-manager.ts`), so swapping the ends leaves exactly the same curve
 * on screen. "Mirroring" it would visibly move the curve — that would be a bug,
 * not a fix, and a unit test pins the rendered path against the day somebody
 * tidies this up.
 *
 * ## Why it writes through the surface and not through `EdgelessCRUDIdentifier`
 *
 * `crud.updateElement` calls `recordLastProps`, which would make the swapped
 * endpoint styles the DEFAULT for every connector drawn afterwards — the exact
 * defect `b.flip-direction` has today. An inversion is a statement about one
 * relation, never a style preference.
 */

export const invertEdgeDirectionParams = z.object({
  /**
   * Explicit targets, for a host or an agent acting on something other than the
   * live selection. **Omitted** — the key absent — the command acts on the
   * current canvas selection. An EMPTY array means "these zero elements": the
   * command does nothing and does not fall back to the selection.
   */
  elementIds: z.array(z.string()).optional(),
});

export type InvertEdgeDirectionParams = z.infer<
  typeof invertEdgeDirectionParams
>;

/** Whether this document may be written to at all. */
const isInvertible = (std: BlockStdScope) => !std.store.readonly;

/**
 * The typed edges this gesture would rewrite.
 *
 * Typed edges and nothing else: on a generalist connector `source` and `target`
 * carry no claim, so there is no relation to invert and the two ends are
 * already interchangeable labels. Reversing one would be a gesture with no
 * meaning attached.
 */
export function invertibleEdges(
  std: BlockStdScope,
  elementIds?: string[]
): TypedEdge[] {
  const gfx = std.get(GfxControllerIdentifier);
  const vocabularies = roleVocabularies(std);
  if (vocabularies.length === 0) return [];

  const models = elementIds
    ? elementIds.map(id => gfx.surface?.getElementById(id))
    : gfx.selection.selectedElements;

  const edges: TypedEdge[] = [];
  for (const model of models) {
    const edge = asTypedEdge(vocabularies, model);
    if (edge && !edge.model.isLocked()) edges.push(edge);
  }
  return edges;
}

/**
 * A plain copy of one endpoint. The stored value comes out of a `Y.Map` and is
 * about to be written into the OTHER slot of the same element, so it is copied
 * key by key rather than moved: the two accessors must never end up sharing one
 * object, and an absent key must stay absent instead of becoming `undefined`.
 */
function copyConnection(connection: Connection | undefined): Connection {
  const copy: Connection = {};
  if (connection?.id !== undefined) copy.id = connection.id;
  if (connection?.position !== undefined) {
    copy.position = [connection.position[0], connection.position[1]];
  }
  return copy;
}

/**
 * Swap the two ends of one typed edge. Pure model write, no capture, no
 * telemetry — exported so a unit test can assert the involution without an
 * editor around it.
 */
export function invertEdge(model: ConnectorElementModel): void {
  const source = copyConnection(model.source);
  const target = copyConnection(model.target);
  model.surface.updateElement(model.id, {
    source: target,
    target: source,
    // The mark follows the relation. Leaving the styles behind would move the
    // only visible sign of the direction away from the end that now carries it
    // — the picture and the data would disagree, which is precisely what
    // `b.flip-direction` does on a typed edge.
    frontEndpointStyle: model.rearEndpointStyle,
    rearEndpointStyle: model.frontEndpointStyle,
  });
}

/** The registered id, so a toolbar entry can invoke it rather than copy it. */
export const INVERT_EDGE_DIRECTION = 'edge.invert-direction';

const invertEdgeDirection: CommandDescriptor<InvertEdgeDirectionParams> = {
  id: INVERT_EDGE_DIRECTION,
  owner: 'core',
  kind: 'action',
  // NOT under `com.labre.keyboardShortcuts.*`: like `pivot.bind`, this one is
  // keyless by intent and lives on the contextual toolbar, in the palette and
  // in the agent — filing it under "keyboard shortcuts" would mislead a
  // translator.
  labelKey: 'com.labre.command.edge.invert-direction',
  labelFallback: 'Reverse direction',
  descriptionKey: 'com.labre.command.edge.invert-direction.description',
  descriptionFallback:
    'Swap the two ends of this relation: what was the subject becomes the object.',
  surfaces: ['contextual-toolbar', 'palette', 'agent'],
  scope: 'edgeless',
  // Keyless by intent — still bindable from Settings › Shortcuts, which is what
  // `toShortcutDescriptor` being total buys.
  defaultKeys: { mac: [], other: [] },
  availability: 'selection',
  // Narrows `'selection'`, never contradicts it: a read-only document and a
  // selection holding no typed edge both have nothing to invert. Read-only
  // rides here rather than on `availability` for the reason `pivot.bind`
  // documents — the union does not compose, and `'selection'` is the
  // precondition a catalogue has to show.
  when: std => isInvertible(std) && invertibleEdges(std).length > 0,
  params: invertEdgeDirectionParams,
  run: (std, invocation, params) => {
    const parsed = invertEdgeDirectionParams.safeParse(params);
    if (!parsed.success) {
      console.error('edge.invert-direction: invalid params', parsed.error.issues);
      return;
    }

    // The load-bearing half of the read-only gate: `when` is consulted by the
    // SURFACES, and `runCommand` consults neither it nor `availability` — the
    // palette and the agent reach `run` directly.
    if (!isInvertible(std)) return;

    const edges = invertibleEdges(std, parsed.data.elementIds);
    if (edges.length === 0) return;

    // BEFORE the writes, not after: `Store.transact` is not an undo boundary,
    // and without this an inversion issued within 500 ms of a drag would be
    // undone TOGETHER with the drag. One capture for the whole gesture is also
    // what makes several selected edges reverse in a single undo step.
    std.store.captureSync();
    for (const { model } of edges) invertEdge(model);

    // The ONE emission for this gesture, and not through `runCommand`'s
    // bottleneck: that emitter maps a static `{ framework, element }` onto the
    // three CREATION events, and an inversion creates nothing.
    const roles = new Set(edges.map(edge => edge.role.id));
    const role = roles.size === 1 ? [...roles][0] : undefined;
    std.getOptional(TelemetryProvider)?.track('EdgeDirectionInverted', {
      page: 'whiteboard editor',
      ...(role !== undefined ? { role } : {}),
      ...(role !== undefined
        ? { framework: role.split(':')[0] }
        : {}),
      elementCount: edges.length,
      control: invocation.source,
      module: invocation.surface,
    });
  },
};

/**
 * The registry's element type erases the parameter contract, and `run`
 * re-validates with the zod schema rather than trusting the static type — what
 * an agent-invocable command has to do anyway.
 */
export const edgeDirectionCommands: AnyCommandDescriptor[] = [
  invertEdgeDirection,
];
