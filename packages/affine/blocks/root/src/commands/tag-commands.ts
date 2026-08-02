/**
 * The promotion rung "component → materialities": qualify a surface element
 * with a namespaced type-3 tag (MF3, ADR 0007 §§ 4 and 6).
 *
 * Same shape as `pivot.bind`, and for the same reason: the library fixes the
 * format of tag definitions but does not own them — the host seeds them — so
 * WHICH tag and WHICH values are parameters, never a lib-side enumeration. That
 * is also what makes the command usable by the agent surface with no UI at all.
 *
 * Promotion is never a conversion: the element's `type` never changes, nothing
 * is created, destroyed or swapped, and `xywh` / `rotate` / `index` / `seed` and
 * every style field are untouched. The gesture is reversible — an empty `values`
 * removes the tag — and no rung requires the previous one: an element may carry
 * tags with no `pivotDocId`, and a `pivotDocId` with no `role`.
 */
import { TelemetryProvider } from '@labre/affine-shared/services';
import {
  FRAMEWORK_IDS,
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandDescriptor,
  type FrameworkId,
} from '@labre/std';
import {
  GfxControllerIdentifier,
  GfxPrimitiveElementModel,
  setElementTag,
} from '@labre/std/gfx';
import { z } from 'zod';

/**
 * `values: []` removes the tag. Both keys are REQUIRED on purpose: an optional
 * `values` would make a forgotten argument silently destroy a qualification,
 * which is exactly the failure mode an agent-invocable command must not have.
 */
export const setTagParams = z.object({
  /** Namespaced tag def id, e.g. `'wardley:nature'`. */
  tag: z.string().min(1),
  /**
   * The value ids selected for that tag, e.g. `['wardley:nature/data']`.
   * `[]` clears it.
   *
   * NOT validated against the registered defs. A document may legitimately
   * carry an id whose def was removed, renamed or never seeded in this
   * deployment, and the persisted value must accept any string — narrowing it
   * here would push that case toward a load-time failure. The picker offers
   * only defined values; the command does not police them.
   */
  values: z.array(z.string()),
  /**
   * Explicit targets, for a host or an agent acting on something other than the
   * live selection. **Omitted** — the key absent — the command acts on the
   * current canvas selection.
   *
   * An EMPTY array is not the same thing: it means "these zero elements", so
   * the command does nothing and does not fall back to the selection.
   */
  elementIds: z.array(z.string()).optional(),
});

export type SetTagParams = z.infer<typeof setTagParams>;

/**
 * The elements this gesture would write to. Surface elements only: canvas
 * BLOCKS carry a versioned schema, so qualifying them would be a `version` bump
 * in `packages/affine/model` and is out of scope (ADR 0005 § 6).
 */
function tagTargets(
  std: BlockStdScope,
  elementIds?: string[]
): GfxPrimitiveElementModel[] {
  const gfx = std.get(GfxControllerIdentifier);

  const models = elementIds
    ? elementIds.map(id => gfx.surface?.getElementById(id))
    : gfx.selection.selectedElements;

  return models.filter(
    (model): model is GfxPrimitiveElementModel =>
      model instanceof GfxPrimitiveElementModel
  );
}

/**
 * Whether this document may be written to at all.
 *
 * Checked in `run` and not only in `when`, for the reason `pivot.bind`
 * documents: `when` is consulted by the SURFACES, and `runCommand` consults
 * neither it nor `availability` — the palette and the agent reach `run`
 * directly. Without this guard, removing a tag succeeds in a read-only
 * document, because both `Store.transact` and `clearField` carry no read-only
 * guard of their own.
 */
const isQualifiable = (std: BlockStdScope) => !std.store.readonly;

/** `'wardley:component'` → `'wardley'`, when that names a real framework. */
function frameworkOfRole(role: string | undefined): FrameworkId | undefined {
  const namespace = role?.split(':')[0];
  return (FRAMEWORK_IDS as readonly string[]).includes(namespace ?? '')
    ? (namespace as FrameworkId)
    : undefined;
}

/** The single value shared by every target, or `undefined` if they disagree. */
function unanimous<T>(values: T[]): T | undefined {
  const distinct = new Set(values);
  return distinct.size === 1 ? values[0] : undefined;
}

const setTag: CommandDescriptor<SetTagParams> = {
  id: 'tag.set',
  owner: 'core',
  kind: 'action',
  // Not filed under `com.labre.keyboardShortcuts.*`: like `pivot.bind`, this
  // one is keyless by intent and lives in the palette, the element toolbar and
  // the agent, so that namespace would mislead a translator.
  labelKey: 'com.labre.command.tag.set',
  labelFallback: 'Qualify',
  descriptionKey: 'com.labre.command.tag.set.description',
  surfaces: ['palette', 'agent'],
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'selection',
  // Narrows `'selection'`, never contradicts it: a read-only document, and a
  // selection of nothing but canvas blocks, both have no qualifiable target.
  // Read-only rides on `when` rather than on `availability` because that union
  // is one value per command and does not compose — the same arbitration
  // `pivot.bind` records.
  when: std => isQualifiable(std) && tagTargets(std).length > 0,
  params: setTagParams,
  run: (std, invocation, params) => {
    const parsed = setTagParams.safeParse(params);
    if (!parsed.success) {
      console.error('tag.set: invalid params', parsed.error.issues);
      return;
    }
    const { tag, values, elementIds } = parsed.data;

    // The load-bearing half of the read-only gate: see `isQualifiable`.
    if (!isQualifiable(std)) return;

    const targets = tagTargets(std, elementIds);
    if (!targets.length) return;

    // BEFORE the write, not after. `store.transact()` is not an undo boundary:
    // the `Y.UndoManager` is built with no `captureTimeout`, so Yjs's 500 ms
    // default merges consecutive transactions — and a qualification issued
    // within 500 ms of a drag would be undone TOGETHER with the drag, making
    // the promotion look like it moved geometry (ADR 0007 § 6, as amended).
    // `stopCapturing()` opens a new stack item for what comes NEXT, so it has
    // to precede the write.
    //
    // Issued before knowing whether anything will change: `setElementTag`
    // answers that per element, and an undo boundary with no write after it is
    // inert, whereas a boundary opened too late is the defect this rule exists
    // to prevent.
    std.store.captureSync();

    const changed = targets.filter(element =>
      setElementTag(element, tag, values)
    );
    // A gesture that changes nothing emits nothing.
    if (!changed.length) return;

    // The ONE emission for this gesture, self-emitted rather than routed
    // through `runCommand`'s bottleneck: that emitter maps `CommandKind` onto
    // the three CREATION events from a STATIC `{ framework, element }` on the
    // descriptor, and a promotion is neither a creation nor static — `rung`,
    // `direction` and `role` are facts of the invocation (ADR 0007 § 7).
    const role = unanimous(changed.map(element => element.role));
    std.getOptional(TelemetryProvider)?.track('FrameworkElementPromoted', {
      page: 'whiteboard editor',
      framework: frameworkOfRole(role),
      rung: 'tag',
      direction: values.length ? 'promote' : 'demote',
      role,
      elementCount: changed.length,
      control: invocation.source,
      module: invocation.surface,
    });
  },
};

/**
 * The registry's element type erases the parameter contract
 * ({@link AnyCommandDescriptor}); `run` re-validates with {@link setTagParams}
 * rather than trusting the static type, which is what an agent-invocable
 * command has to do anyway.
 */
export const tagCommands: AnyCommandDescriptor[] = [setTag];
