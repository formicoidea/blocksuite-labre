import type { ConnectorElementModel } from '@labre/affine-model';
import { createIdentifier } from '@labre/global/di';
import type { Bound } from '@labre/global/gfx';
import type { GfxModel } from '@labre/std/gfx';
import {
  GfxPrimitiveElementModel,
  InteractivityExtension,
} from '@labre/std/gfx';
import type { ExtensionType } from '@labre/store';

import type { SurfaceBlockModel } from '../surface-model.js';

/**
 * Spotlight-on-hover: a framework background element ("host") grants the
 * elements laid inside its bounds a dependency-reading behavior — hovering a
 * node (or a connector) spotlights it together with its connected elements and
 * fades everything else inside the host.
 *
 * Any framework can opt in by registering its background element type:
 *
 * ```ts
 * context.register(SpotlightHostExtension('edgy'));
 * ```
 *
 * The fading uses `element.opacity`, a `@local()` field — no CRDT write, no
 * undo entry, no sync.
 */
export const SpotlightHostIdentifier =
  createIdentifier<string>('SpotlightHost');

export function SpotlightHostExtension(elementType: string): ExtensionType {
  return {
    setup: di => {
      di.addImpl(SpotlightHostIdentifier(elementType), () => elementType);
    },
  };
}

const isConnector = (
  el: GfxModel | GfxPrimitiveElementModel
): el is ConnectorElementModel => 'type' in el && el.type === 'connector';

/**
 * The ids to keep at full opacity when `target` is hovered: the target, its
 * connectors and their opposite endpoints (or, for a hovered connector, its
 * two endpoints). Pure — exported for unit tests.
 */
export function spotlightSet(
  target: GfxModel,
  getConnectors: (id: string) => ConnectorElementModel[]
): Set<string> {
  const keep = new Set<string>([target.id]);
  if (isConnector(target)) {
    if (target.source?.id) keep.add(target.source.id);
    if (target.target?.id) keep.add(target.target.id);
    return keep;
  }
  for (const connector of getConnectors(target.id)) {
    keep.add(connector.id);
    if (connector.source?.id) keep.add(connector.source.id);
    if (connector.target?.id) keep.add(connector.target.id);
  }
  return keep;
}

/** The shape {@link findSpotlightHost} needs of a candidate host. */
export type SpotlightHostCandidate = {
  type: string;
  elementBound: Bound;
  spotlightEnabled?: boolean;
};

/**
 * The host that grants `target` the spotlight, or `null` when none does.
 *
 * A host qualifies when its type was REGISTERED as a spotlight host
 * (`SpotlightHostExtension`), when it did not opt out (`spotlightEnabled:
 * false`, its toolbar toggle) and when its bounds contain the target. A
 * background whose type is not registered grants nothing, whatever fields it
 * carries — that is how the EDGY facets Venn stopped spotlighting (#195).
 *
 * Pure — exported for unit tests.
 */
export function findSpotlightHost<T extends SpotlightHostCandidate>(
  target: { elementBound: Bound },
  elements: readonly T[],
  hostTypes: readonly string[]
): T | null {
  return (
    elements.find(
      el =>
        hostTypes.includes(el.type) &&
        el.spotlightEnabled !== false &&
        el.elementBound.contains(target.elementBound)
    ) ?? null
  );
}

/** Delay before a new spotlight is applied / cleared, so brushing across
 * elements doesn't flash the fade on and off. */
const SPOTLIGHT_DELAY_MS = 140;

export class SpotlightManager extends InteractivityExtension {
  static override key = 'spotlight-manager';

  /** Elements currently faded, restored on leave. */
  private _dimmed: GfxPrimitiveElementModel[] = [];

  private _lastTargetId: string | null = null;

  /** Pending debounced transition (apply or restore). */
  private _pending: ReturnType<typeof setTimeout> | null = null;

  private _schedule(action: () => void) {
    if (this._pending) clearTimeout(this._pending);
    this._pending = setTimeout(() => {
      this._pending = null;
      action();
    }, SPOTLIGHT_DELAY_MS);
  }

  private _cancelPending() {
    if (this._pending) {
      clearTimeout(this._pending);
      this._pending = null;
    }
  }

  private get _hostTypes(): string[] {
    return Array.from(
      this.std.provider.getAll(SpotlightHostIdentifier).values()
    );
  }

  private get _surface(): SurfaceBlockModel | null {
    return this.gfx.surface as SurfaceBlockModel | null;
  }

  override mounted() {
    this.event.on('pointermove', context => {
      this._update(context.event.x, context.event.y);
    });
    this.event.on('pointerleave', () => this._restoreNow());
    this.event.on('dragstart', () => this._restoreNow());
  }

  override unmounted() {
    this._restoreNow();
    super.unmounted();
  }

  private _update(vx: number, vy: number) {
    const hostTypes = this._hostTypes;
    const surface = this._surface;
    if (!hostTypes.length || !surface) return;

    if (this.gfx.tool.currentToolName$.peek() !== 'default') {
      this._restoreNow();
      return;
    }

    const [x, y] = this.gfx.viewport.toModelCoord(vx, vy);
    // Connectors sit above the nodes they link (inserted later): when both are
    // under the pointer, the user is aiming at the node — prefer it.
    const hits = this.gfx
      .getElementByPoint(x, y, { all: true })
      .filter(
        (el): el is GfxPrimitiveElementModel =>
          el instanceof GfxPrimitiveElementModel &&
          !hostTypes.includes(el.type) &&
          (el.connectable || isConnector(el))
      );
    let target: GfxPrimitiveElementModel | null = null;
    for (let i = hits.length - 1; i >= 0; i--) {
      if (!isConnector(hits[i])) {
        target = hits[i];
        break;
      }
    }
    if (!target && hits.length) target = hits[hits.length - 1];

    // The behavior is granted by a host whose bounds contain the target —
    // unless that host opted out (`spotlightEnabled: false`, toolbar toggle).
    const host = target
      ? findSpotlightHost(target, surface.elementModels, hostTypes)
      : null;

    if (!target || !host) {
      // Debounced restore: brushing across the gaps between elements must not
      // flash the fade off and on.
      if (this._lastTargetId !== null) this._schedule(() => this._apply(null));
      else this._cancelPending();
      return;
    }

    if (target.id === this._lastTargetId) {
      // Still on the applied target: keep the spotlight steady.
      this._cancelPending();
      return;
    }

    const finalTarget = target;
    const finalHost = host;
    this._schedule(() => this._apply(finalTarget, finalHost));
  }

  private _apply(
    target: GfxPrimitiveElementModel | null,
    host?: GfxPrimitiveElementModel
  ) {
    const surface = this._surface;
    this._restoreDim();
    if (!target || !host || !surface) {
      this._lastTargetId = null;
      return;
    }
    this._lastTargetId = target.id;
    const hostTypes = this._hostTypes;
    const keep = spotlightSet(target, id => surface.getConnectors(id));
    for (const el of surface.elementModels) {
      if (el === host || hostTypes.includes(el.type) || keep.has(el.id)) {
        continue;
      }
      if (host.elementBound.contains(el.elementBound)) {
        el.opacity = 0.2;
        this._dimmed.push(el);
      }
    }
  }

  private _restoreDim() {
    if (!this._dimmed.length) return;
    for (const el of this._dimmed) el.opacity = 1;
    this._dimmed = [];
  }

  private _restoreNow() {
    this._cancelPending();
    this._lastTargetId = null;
    this._restoreDim();
  }
}
