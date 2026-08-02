import { createIdentifier } from '@labre/global/di';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import type { ExtensionType } from '@labre/store';

/**
 * Map quality — the NUDGES half (PF7.10).
 *
 * A nudge is an expectation a framework holds and the tool cannot judge: "the
 * map has a title that frames the study", "the map is legended". The content can
 * exist without being good, so there is nothing to compute — and a rule that
 * pretended to compute it would be the worst kind of validation, one that says
 * "valid" about something it never looked at.
 *
 * So a nudge is declarative DATA, exactly like a rule, a role or a profile, and
 * it is never evaluated by anything. It is presented as a CHECKLIST the user
 * ticks, and ticking is the same gesture as granting an exception (PF8):
 * **ticking is assuming**. The tool records that the user took responsibility;
 * it never claims to have checked.
 *
 * ## Where the state lives
 *
 * On the framework's BACKGROUND element — `GfxPrimitiveElementModel.qualityChecklist`
 * — for the same reason the validation profile does: two maps on one canvas are
 * two independent pieces of work. It is one flat array of ids in a declared
 * `@field()`, so it syncs, it undoes, it survives a copy and an export, and it
 * needs no block schema change and no migration.
 *
 * It also survives the framework's flag going off and coming back, which is the
 * whole point of storing it as document data rather than as tooling state: the
 * flag takes the CHECKLIST away, never the decisions somebody recorded on it.
 *
 * ## Gating
 *
 * A framework registers its nudges from its FLAG-GATED view extension, beside
 * its rules and its profiles: a checklist is tooling. Flag off, nothing is
 * registered, the panel offers nothing, and the ids already written go unread
 * until the flag comes back.
 */

/**
 * One expectation, as data. Deliberately three fields: an id to persist, a key
 * to translate, and the framework's own wording for a host that ships no
 * catalogue for it — the same `labelKey` + `fallback` pair a profile and a
 * background label already carry. The library never invents the wording of
 * somebody else's expectation.
 */
export interface QualityNudge {
  /** Stable id, namespaced by framework: `wardley.q1-title`. This is what is persisted. */
  id: string;
  /** Owning framework, `wardley`. A nudge never applies across frameworks. */
  framework: string;
  /** i18n key of the expectation, resolved by the host. */
  labelKey: string;
  /** The framework's own wording, when the host ships no catalogue for the key. */
  fallback?: string;
  /** Ascending rank in the checklist. Ties keep declaration order. */
  order?: number;
}

/** A framework registers its nudges here; nothing else registers nudges. */
export const QualityNudgeIdentifier =
  createIdentifier<QualityNudge>('QualityNudge');

/**
 * Register a framework's nudges. Call it from the FLAG-GATED view extension,
 * beside {@link ValidationRuleExtension}.
 *
 * ```ts
 * context.register(QualityNudgeExtension(WARDLEY_NUDGES));
 * ```
 */
export function QualityNudgeExtension(
  nudges: readonly QualityNudge[]
): ExtensionType {
  return {
    setup: di => {
      for (const nudge of nudges) {
        di.addImpl(QualityNudgeIdentifier(nudge.id), () => nudge);
      }
    },
  };
}

/**
 * The nudge ids ticked on `element` — always an array, never a copy to keep.
 *
 * The value comes out of a Y.Map, so it is whatever a peer wrote: a client that
 * got it wrong must not break the panel on this one. Non-string members are
 * dropped rather than shown, for the same reason.
 */
export function checkedNudges(
  element: GfxPrimitiveElementModel
): readonly string[] {
  const stored = element.qualityChecklist;
  if (!Array.isArray(stored)) return [];
  return stored.filter((id): id is string => typeof id === 'string');
}

/** Whether `nudgeId` is ticked on `element`. */
export function isNudgeChecked(
  element: GfxPrimitiveElementModel,
  nudgeId: string
): boolean {
  return checkedNudges(element).includes(nudgeId);
}

/**
 * Tick or untick `nudgeId` on `element`.
 *
 * The write goes through the declared `@field()` accessor, so it lands in the
 * Y.Map, syncs to every peer, joins the undo stack and survives a copy — see the
 * note on `GfxPrimitiveElementModel.qualityChecklist`.
 *
 * Unticking the LAST one removes the key rather than leaving an empty array
 * behind: assigning `[]` through the accessor would keep a key in the Y.Map,
 * invisible in the panel but synced to every peer and shipped in every snapshot.
 * `clearField` removes it, so an element whose checklist was emptied really is
 * indistinguishable from one that never had a nudge ticked — in the document,
 * and not just in this tab. Exactly what `revokeException` does with the last
 * exception (PF8).
 *
 * ## Read-only is enforced HERE, not only in the panel
 *
 * The house convention for these writes: the seam guards itself
 * (`setProfile`, `setException`, `revokeExceptionsOn` all do). A `disabled`
 * checkbox is a UI promise and covers exactly one caller; an agent, a host or a
 * future surface reaching this function directly would have no net at all. And
 * the failure is not a no-op: `clearField` goes through `Store.transact`, which
 * — unlike `addBlock` / `updateBlock` / `deleteBlock` — carries no read-only
 * guard of its own, so unticking would genuinely delete the key from a document
 * the user cannot edit.
 *
 * The store is reached through the element's own surface. An element not yet
 * attached to one carries no document to protect and is written normally, which
 * is what a unit fixture is.
 *
 * @returns whether the document actually changed.
 */
export function setNudgeChecked(
  element: GfxPrimitiveElementModel,
  nudgeId: string,
  checked: boolean
): boolean {
  if (element.surface?.store?.readonly) return false;

  const current = checkedNudges(element);
  if (current.includes(nudgeId) === checked) return false;

  const next = checked
    ? [...current, nudgeId]
    : current.filter(id => id !== nudgeId);

  if (next.length === 0) element.clearField('qualityChecklist');
  else element.qualityChecklist = next;
  return true;
}
