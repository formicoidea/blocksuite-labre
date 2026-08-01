/**
 * The promotion rung "role → component": bind a surface element to a host-owned
 * **pivot record** (MF1, ADR 0005 § 3, ladder in ADR 0007 § 6).
 *
 * The library cannot choose a document — it does not know what a pivot record
 * is. So the record id is a PARAMETER: the host's picker (labreapp, MF2) runs
 * the selection UI and invokes the command with the answer. That is also what
 * makes the command usable by the agent surface with no UI at all.
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
} from '@labre/std/gfx';
import { z } from 'zod';

const PIVOT_DOC_ID = 'pivotDocId';

/**
 * `pivotDocId: null` unbinds. The key is REQUIRED on purpose: an optional one
 * would make a forgotten argument silently destroy a binding, which is exactly
 * the failure mode an agent-invocable command must not have.
 */
export const bindPivotParams = z.object({
  pivotDocId: z.string().min(1).nullable(),
  /**
   * Explicit targets, for a host or an agent acting on something other than the
   * live selection. **Omitted** — the key absent — the command acts on the
   * current canvas selection.
   *
   * An EMPTY array is not the same thing: it means "these zero elements", so
   * the command does nothing and does not fall back to the selection. That is
   * the safe reading — an agent that computed a target list and came up empty
   * must not have the gesture redirected onto whatever the user happened to
   * have selected — but it is silent, so callers filtering a list should check
   * it before invoking.
   */
  elementIds: z.array(z.string()).optional(),
});

export type BindPivotParams = z.infer<typeof bindPivotParams>;

/**
 * The elements this gesture would write to. Surface elements only: canvas
 * BLOCKS carry a versioned schema, so binding them would be a `version` bump in
 * `packages/affine/model` and is out of scope (ADR 0005 § 6).
 */
function pivotTargets(
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
 * Checked in `run` and not only in `when`, because `when` is consulted by the
 * SURFACES and `runCommand` consults neither it nor `availability` — the
 * palette and the agent reach `run` directly. Without this guard, unbinding
 * succeeds in a read-only document: `clearField` goes through `Store.transact`,
 * which (unlike `addBlock` / `updateBlock` / `deleteBlock`) carries no
 * read-only guard, so the key is deleted and the promotion event is emitted for
 * a document the user cannot edit. Binding merely throws out of `runCommand`,
 * which is bad in a different way.
 */
const isBindable = (std: BlockStdScope) => !std.store.readonly;

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

const bindPivot: CommandDescriptor<BindPivotParams> = {
  id: 'pivot.bind',
    owner: 'core',
    kind: 'action',
    // NOT `com.labre.keyboardShortcuts.*` like every labelKey before it: those
    // all belong to commands that ship a default chord. This one is keyless by
    // intent and lives in the palette and the agent, so filing it under
    // "keyboard shortcuts" would mislead a translator.
    labelKey: 'com.labre.command.pivot.bind',
    labelFallback: 'Link to record',
    descriptionKey: 'com.labre.command.pivot.bind.description',
    surfaces: ['palette', 'agent'],
    scope: 'edgeless',
    // Keyless by intent — still bindable from Settings › Shortcuts, which is
    // what `toShortcutDescriptor` being total buys.
    defaultKeys: { mac: [], other: [] },
    availability: 'selection',
    // Narrows `'selection'`, never contradicts it: a read-only document, and a
    // selection of nothing but canvas blocks, both have no bindable target.
    //
    // Read-only rides on `when` rather than on `availability` because the union
    // does not COMPOSE: it is one value per command (`command-registry.ts`
    // `isCommandAvailable`), so declaring `'editable'` would buy the read-only
    // gate by dropping the selection gate a host panel needs far more often.
    // `'selection'` stays the serializable answer — it is the precondition a
    // catalogue must show — and the state precondition is enforced below.
    // The missing composition is recorded as an amendment trigger in ADR 0008.
    when: std => isBindable(std) && pivotTargets(std).length > 0,
    params: bindPivotParams,
    run: (std, invocation, params) => {
      const parsed = bindPivotParams.safeParse(params);
      if (!parsed.success) {
        console.error('pivot.bind: invalid params', parsed.error.issues);
        return;
      }
      const { pivotDocId, elementIds } = parsed.data;

      // The load-bearing half of the read-only gate: see `isBindable`.
      if (!isBindable(std)) return;

      const targets = pivotTargets(std, elementIds);
      if (!targets.length) return;

      // A gesture that changes nothing emits nothing and costs no undo step.
      const changing = targets.filter(el => el.pivotDocId !== (pivotDocId ?? undefined));
      if (!changing.length) return;

      // BEFORE the write, not after. `store.transact()` is not an undo
      // boundary: the `Y.UndoManager` is built with no `captureTimeout`, so
      // Yjs's 500 ms default merges consecutive transactions — and a bind
      // issued within 500 ms of a drag would be undone TOGETHER with the drag,
      // making the promotion look like it moved geometry. `stopCapturing()`
      // opens a new stack item for what comes NEXT, so it has to precede the
      // write (`Store.captureSync` docstring; same order as `applyLastStyle`).
      //
      // The ADRs' snippets (0005 § 3, 0007 § 6) show it after the write; that
      // contradicts their own stated rationale and is treated as an editorial
      // slip — see the PR description.
      std.store.captureSync();

      for (const element of changing) {
        if (pivotDocId === null) {
          // Not `updateElement(id, { pivotDocId: undefined })`: the `@field()`
          // setter is unconditional, so that would leave the key behind as a
          // tombstone. `clearField` removes it, and accepts this field because
          // it is a declared, non-structural `@field()`.
          element.clearField(PIVOT_DOC_ID);
        } else {
          element.surface.updateElement(element.id, { pivotDocId });
        }
      }

      // The ONE emission for this gesture. Not routed through `runCommand`'s
      // bottleneck: that emitter maps `CommandKind` onto the three creation
      // events from a STATIC `{ framework, element }` on the descriptor, and a
      // promotion is neither a creation nor static — `rung`, `direction` and
      // `role` are facts of the invocation. See ADR 0007 § 7.
      const roles = changing.map(el => el.role);
      const role = unanimous(roles);
      std.getOptional(TelemetryProvider)?.track('FrameworkElementPromoted', {
        page: 'whiteboard editor',
        framework: frameworkOfRole(role),
        rung: 'pivot',
        direction: pivotDocId === null ? 'demote' : 'promote',
        role,
        elementCount: changing.length,
        control: invocation.source,
        module: invocation.surface,
      });
  },
};

/**
 * The registry's element type erases the parameter contract
 * ({@link AnyCommandDescriptor}) — this is the first command to have one, and
 * `run` re-validates with {@link bindPivotParams} rather than trusting the
 * static type, which is what an agent-invocable command has to do anyway.
 */
export const pivotCommands: AnyCommandDescriptor[] = [bindPivot];
