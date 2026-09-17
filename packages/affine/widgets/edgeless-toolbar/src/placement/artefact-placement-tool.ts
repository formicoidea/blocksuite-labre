import {
  DefaultTool,
  EXCLUDING_MOUSE_OUT_CLASS_LIST,
  recordAction,
  sortIndex,
  type SurfaceBlockComponent,
} from '@labre/affine-block-surface';
import { translateKey } from '@labre/affine-shared/services';
import { hasClassNameInList } from '@labre/affine-shared/utils';
import { Bound } from '@labre/global/gfx';
import {
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandOwner,
  type PointerEventState,
  runCommand,
} from '@labre/std';
import {
  BaseTool,
  type GfxController,
  GfxGroupLikeElementModel,
  type GfxPrimitiveElementModel,
} from '@labre/std/gfx';

import { seniorMenuSelection } from '../menu/senior-menu-selection.js';
import { ArtefactGhostOverlay } from './artefact-ghost-overlay.js';
import { collectCreated, translateCreated } from './translate-created.js';

/** The ghost of an artefact nobody could measure. */
const FALLBACK_FOOTPRINT = new Bound(-60, -30, 120, 60);

export type ArtefactPlacementOption = {
  /** Whose senior menu armed this, and therefore whose row Shift+S walks. */
  owner: CommandOwner;
  command: AnyCommandDescriptor;
};

/**
 * ONE tool for every framework's artefacts: pick one from a senior menu and it
 * is not created, it is ARMED — a ghost follows the cursor and the click says
 * where (PO decision, 2026-09-16).
 *
 * The shape tool has always worked this way, and a framework artefact is a
 * shape the framework named. Before this, an artefact landed at the viewport
 * centre whatever the author was looking at, and putting it where they meant it
 * to go was a second gesture with a mouse held down.
 *
 * It is generic on purpose. Nothing here knows what a Wardley component or a
 * BPMN gateway is: the armed {@link CommandDescriptor} carries its own label,
 * its own creation body and its own telemetry, and the footprint is MEASURED by
 * running that body against the recording fake (`recordAction`) rather than
 * declared a second time. A ninth framework arms this tool by existing.
 *
 * What it deliberately does not do:
 *
 * - **Telemetry.** Arming and cycling emit nothing and record no usage, exactly
 *   as choosing a shape variant does. The one emission still happens where it
 *   always did — inside {@link runCommand}, at placement — so the numbers a
 *   framework already reports are unchanged, and a user who arms an artefact
 *   and changes their mind has not "used" it.
 * - **Drag to size.** A framework artefact has a size its framework chose; the
 *   click places that size. Out of scope, deliberately.
 */
export class ArtefactPlacementTool extends BaseTool<ArtefactPlacementOption> {
  static override toolName: string = 'artefact-placement';

  private _ghost: ArtefactGhostOverlay | null = null;

  private get _surfaceComponent() {
    return this.gfx.surfaceComponent as SurfaceBlockComponent | null;
  }

  override activate() {
    this.createOverlay();
  }

  override deactivate() {
    this.clearOverlay();
  }

  clearOverlay() {
    if (!this._ghost) return;
    this._ghost.dispose();
    this._surfaceComponent?.renderer.removeOverlay(this._ghost);
    this._ghost = null;
    this._surfaceComponent?.renderer.refresh();
  }

  /**
   * Record the armed command once, and hang its ghost off the cursor.
   *
   * Once per arming and per cycle, never per pointer move: the recording runs
   * the command's whole creation body against a fake and the preview builds a
   * model per element, which is cheap but not free — and neither can change
   * between two mouse positions.
   *
   * An artefact made of connectors only gets no ghost at all: a connector is
   * not previewed (PO decision, 2026-09-16), and the crosshair alone says the
   * next click places something.
   */
  createOverlay() {
    this.clearOverlay();
    const { command } = this.activatedOption;
    if (!command) return;

    const preview = previewOf(this.gfx, command);
    if (!preview) return;

    this._ghost = new ArtefactGhostOverlay(
      this.gfx,
      preview.bound,
      translateKey(this.std, command.labelKey, command.labelFallback),
      preview.models
    );
    this._surfaceComponent?.renderer.addOverlay(this._ghost);
  }

  /**
   * Place the artefact under the cursor.
   *
   * The command is not asked WHERE to create — every one of them creates around
   * the viewport centre, and teaching eight frameworks' worth of actions to take
   * a point would be the per-framework code this tool exists to avoid. So the
   * command runs as it always has, and what it created is moved by the offset
   * between the centre it aimed at and the point the user clicked. That offset
   * is read BEFORE the run, because a command may move the viewport.
   */
  override click(e: PointerEventState): void {
    const { command } = this.activatedOption;
    this.clearOverlay();
    if (!command) return;

    const { viewport } = this.gfx;
    const [x, y] = viewport.toModelCoord(e.point.x, e.point.y);
    const dx = x - viewport.centerX;
    const dy = y - viewport.centerY;

    this.doc.captureSync();

    // THE bottleneck, not a shortcut past it: the placement is an invocation
    // like any other, so `FrameworkElementAdded` and the usage measure are
    // emitted exactly where they were before the tool existed.
    const created = collectCreated(this.gfx, () => {
      runCommand(this.std, command, {
        surface: 'senior-menu',
        source: 'toolbar:general',
      });
    });

    const placed = translateCreated(this.gfx, created, dx, dy);

    // `setTool` clears the selection, so the selection goes after it.
    this.gfx.tool.setTool(DefaultTool);
    if (placed.length) {
      this.gfx.selection.set({ elements: placed, editing: false });
    }
  }

  override pointerMove(e: PointerEventState) {
    if (!this._ghost) return;
    if (this._ghost.globalAlpha === 0) this._ghost.globalAlpha = 1;
    const [x, y] = this.gfx.viewport.toModelCoord(e.x, e.y);
    this._ghost.x = x;
    this._ghost.y = y;
    this._surfaceComponent?.refresh();
  }

  override pointerOut(e: PointerEventState) {
    if (
      e.raw.relatedTarget &&
      hasClassNameInList(
        e.raw.relatedTarget as Element,
        EXCLUDING_MOUSE_OUT_CLASS_LIST
      )
    )
      return;
    if (!this._ghost) return;
    this._ghost.globalAlpha = 0;
    this._surfaceComponent?.refresh();
  }

  /** A framework artefact keeps the size its framework chose; a drag is a click. */
  override dragStart(_e: PointerEventState) {}

  override dragMove(_e: PointerEventState) {}

  override dragEnd(_e: PointerEventState) {}
}

/**
 * What the command would draw, recorded and BUILT by running it against
 * nothing: its footprint, and a detached model per drawable element, in paint
 * order. `null` when there is nothing to show but the crosshair.
 *
 * The recording's viewport centre is the origin, so every recorded box is
 * already the offset around a real centre — and therefore around the cursor.
 * The records go to `createDetachedElement` as they were handed to the CRUD,
 * so a seed string becomes its `Y.Text` through the element's own `propsToY`,
 * exactly as it will at insertion; the host's `TranslationProvider` makes the
 * seeds come out in the author's language, as they will once placed.
 *
 * Skipped: connectors (never previewed) and group-likes, whose renderers draw
 * selection chrome and look their children up in the document — the children
 * are drawn on their own. A record the surface cannot build is skipped too.
 *
 * A command the fake cannot serve throws by design (it answers only the
 * members creation actions touch); that is not an error worth a console line
 * here, it just means the ghost falls back to a plain box rather than the tool
 * refusing to arm. So does a recording in which nothing could be built.
 */
function previewOf(
  gfx: GfxController,
  command: AnyCommandDescriptor
): { bound: Bound; models: GfxPrimitiveElementModel[] } | null {
  let recorded: ReturnType<typeof recordAction>;
  try {
    recorded = recordAction(
      (std: BlockStdScope) => {
        // An async body records nothing it does after its first `await`, and
        // then fails on the fake: that late failure is the same "cannot
        // preview", not an unhandled rejection in the console.
        Promise.resolve(
          command.run(std, { surface: 'senior-menu', source: 'internal' })
        ).catch(() => {});
      },
      { host: gfx.std }
    );
  } catch {
    return { bound: FALLBACK_FOOTPRINT, models: [] };
  }

  const { records } = recorded;
  if (records.length > 0 && records.every(r => r['type'] === 'connector')) {
    return null;
  }

  // Paint order as the surface derives it: a group's children sort under the
  // group's own index, even though the group itself is not drawn.
  const groupIndexMap = new Map<string, { id: string; index: string }>();
  for (const record of records) {
    const children = record['children'];
    if (record['type'] !== 'group' || typeof children !== 'object') continue;
    const group = { id: String(record['id']), index: String(record['index']) };
    for (const childId of Object.keys(children ?? {})) {
      groupIndexMap.set(childId, group);
    }
  }
  const ordered = records
    .map(record => ({
      record,
      id: String(record['id']),
      index: String(record['index']),
    }))
    .sort((a, b) => sortIndex(a, b, groupIndexMap));

  const { surface } = gfx;
  const models: GfxPrimitiveElementModel[] = [];
  for (const { record, id } of ordered) {
    const type = String(record['type']);
    const Ctor = surface?.getConstructor(type);
    if (
      !surface ||
      !Ctor ||
      type === 'connector' ||
      Ctor.prototype instanceof GfxGroupLikeElementModel
    ) {
      continue;
    }
    try {
      models.push(surface.createDetachedElement({ ...record, type, id }));
    } catch {
      // Unbuildable here means unpaintable here; the rest still draws.
    }
  }

  return { bound: recorded.bound ?? FALLBACK_FOOTPRINT, models };
}

/** The armed artefact, or `null` when the editor is on any other tool. */
export function armedArtefact(
  gfx: GfxController
): ArtefactPlacementOption | null {
  const { toolType, options } = gfx.tool.currentToolOption$.value ?? {};
  if (toolType?.toolName !== ArtefactPlacementTool.toolName) return null;
  const armed = options as ArtefactPlacementOption | undefined;
  return armed?.command ? armed : null;
}

/** Arm `command`; the ghost appears with the next pointer move. */
export function armArtefact(
  gfx: GfxController,
  owner: CommandOwner,
  command: AnyCommandDescriptor
) {
  gfx.tool.setTool(ArtefactPlacementTool, { owner, command });
}

/**
 * The artefacts of one owner, in the order its senior menu shows them.
 *
 * The MENU's row and not the whole catalogue: cycling is a keyboard walk along
 * a row of buttons the user is looking at, and a Shift+S that stepped onto an
 * artefact filed away in the sidepanel would move the ghost with nothing on
 * screen to explain it. An owner past the fourteen-slot cap therefore cycles
 * through its thirteen ranked artefacts; the rest stay one catalogue away.
 *
 * `kind` is what decides, not the owner: an entry of kind `'tool'` — a link
 * tool, the evolution arrow, the Wardley area polygon — arms a gesture of its
 * own and has no footprint to ghost, so it is never armed here and never
 * stepped onto.
 */
export function artefactCommandsFor(
  std: BlockStdScope,
  owner: CommandOwner
): AnyCommandDescriptor[] {
  return seniorMenuSelection(std, owner).commands.filter(
    command => command.kind === 'artefact'
  );
}

/**
 * Arm the artefact `dir` steps along the owner's row, wrapping at both ends.
 * Returns false when nothing is armed, so a caller can fall through to whatever
 * the keystroke means otherwise.
 *
 * An artefact armed from the catalogue is not in the row: a backwards step then
 * enters on the row's last entry, a forwards one on its first — the same "enter
 * from nothing" the open menu's highlight gives.
 */
export function cycleArmedArtefact(gfx: GfxController, dir: 1 | -1): boolean {
  const armed = armedArtefact(gfx);
  if (!armed) return false;

  const commands = artefactCommandsFor(gfx.std, armed.owner);
  if (commands.length === 0) return false;

  const current = commands.findIndex(
    command => command.id === armed.command.id
  );
  const next =
    current < 0
      ? dir === 1
        ? 0
        : commands.length - 1
      : (current + dir + commands.length) % commands.length;

  armArtefact(gfx, armed.owner, commands[next]);
  return true;
}
