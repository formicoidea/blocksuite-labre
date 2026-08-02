/**
 * `element.read` — the CLICK that asks the tool what it reads of a component
 * (MF3, "reversed reading").
 *
 * The PO's arbitration of 01/08/2026, verbatim: the reversed reading is
 * triggered **on a click, never by automatic validation**, and **writes nothing
 * without confirmation**. This command is the click. It opens a proposal and
 * that is the whole of its effect — no tag, no binding, no property, nothing
 * touched in the document, on any path, ever.
 *
 * Which is also why it is NOT read-only gated: reading a board one cannot edit
 * is exactly as legitimate as reading one you can. The gate lives on the
 * CONFIRMATIONS, which are `tag.set` and `pivot.bind` — two commands that
 * already refuse a read-only store.
 */
import { ReadingManager } from '@labre/affine-block-surface';
import {
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandDescriptor,
} from '@labre/std';
import {
  GfxControllerIdentifier,
  GfxPrimitiveElementModel,
} from '@labre/std/gfx';
import { z } from 'zod';

/**
 * `elementId` omitted, the command reads the current canvas selection. Passing
 * it explicitly is what lets the element's own toolbar name the element that
 * CARRIES the role rather than the group the user clicked (the same reason
 * `tags-toolbar.ts` passes `elementIds` to `tag.set`), and what makes the
 * command usable by the agent with no selection at all.
 */
export const readElementParams = z.object({
  elementId: z.string().min(1).optional(),
});

export type ReadElementParams = z.infer<typeof readElementParams>;

/**
 * The element this reading is about: the one named, or the single selected
 * surface element.
 *
 * ONE element, never a multi-selection: a proposal is one fiche about one
 * thing, and two components have two readings that no single panel could
 * honestly show at once.
 */
function readTarget(
  std: BlockStdScope,
  elementId?: string
): GfxPrimitiveElementModel | null {
  const gfx = std.get(GfxControllerIdentifier);

  if (elementId) {
    const model = gfx.surface?.getElementById(elementId);
    return model instanceof GfxPrimitiveElementModel ? model : null;
  }

  const selected = gfx.selection.selectedElements.filter(
    (model): model is GfxPrimitiveElementModel =>
      model instanceof GfxPrimitiveElementModel
  );
  return selected.length === 1 ? selected[0] : null;
}

/**
 * Whether anything registered can read this element.
 *
 * Asked through the manager rather than re-implemented here: the profiles are
 * registered by a framework's FLAG-GATED view extension, so a board whose
 * framework is off has no reading and the command stands down — in the palette,
 * on the toolbar and for the agent alike, from one answer.
 */
function readable(std: BlockStdScope, elementId?: string): boolean {
  const manager = std.getOptional(ReadingManager);
  if (!manager) return false;
  const target = readTarget(std, elementId);
  return target !== null && manager.profileOf(target.id) !== null;
}

const readElementCommand: CommandDescriptor<ReadElementParams> = {
  id: 'element.read',
  owner: 'core',
  kind: 'action',
  // Not under `com.labre.keyboardShortcuts.*`: keyless by intent, like
  // `pivot.bind` and `tag.set`, and filing it there would mislead a translator.
  labelKey: 'com.labre.command.element.read',
  labelFallback: 'Read this component',
  descriptionKey: 'com.labre.command.element.read.description',
  // `'contextual-toolbar'` is deliberately absent: that surface joins the union
  // with the typed-edge direction slice (#97 / ADR 0010 M3). The click
  // affordance ships anyway — the element's toolbar entry drives the manager
  // through this same command id — and the surface is one word to add the day
  // the union carries it.
  surfaces: ['palette', 'agent'],
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'selection',
  // Narrows `'selection'`, never contradicts it. Note what is NOT here: a
  // read-only guard. Reading writes nothing, so there is nothing to refuse.
  when: std => readable(std),
  params: readElementParams,
  run: (std, _invocation, params) => {
    const parsed = readElementParams.safeParse(params);
    if (!parsed.success) {
      console.error('element.read: invalid params', parsed.error.issues);
      return;
    }

    const manager = std.getOptional(ReadingManager);
    if (!manager) return;

    const target = readTarget(std, parsed.data.elementId);
    if (!target) return;
    // A neutral element, or one whose framework is flagged off, has no reading
    // and must not open an empty panel.
    if (!manager.profileOf(target.id)) return;

    manager.open(target.id);
  },
};

/**
 * The registry's element type erases the parameter contract; `run` re-validates
 * with {@link readElementParams} rather than trusting the static type, which is
 * what an agent-invocable command has to do anyway.
 */
export const readingCommands: AnyCommandDescriptor[] = [readElementCommand];
