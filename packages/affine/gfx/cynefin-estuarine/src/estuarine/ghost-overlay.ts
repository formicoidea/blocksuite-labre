import {
  type CanvasRenderer,
  Overlay,
  OverlayIdentifier,
  type RoughCanvas,
} from '@labre/affine-block-surface';
import { EstuarineElementModel } from '@labre/affine-model';
import type { SurfaceBlockModel } from '@labre/std/gfx';
import { InteractivityExtension } from '@labre/std/gfx';
import { effect } from '@preact/signals-core';

import {
  applyEstuarineTransform,
  estuarineCurves,
  GHOST_DASH,
} from './element-renderer';

/**
 * The REVEAL — the ~600 ms animation that plays when an Estuarine curve is
 * switched back on (WS4, PO arbitration of 26/08/2026).
 *
 * The permanent look of a curve is now a discreet ghost (`GHOST_ALPHA`, dashed:
 * see `./element-renderer.ts`). That is the right resting state and the wrong
 * ARRIVAL: a user who clicks "show the Volatile line" and gets a 45 %-opacity
 * dashed curve on a busy map can reasonably fail to notice anything happened,
 * and conclude the toggle is broken. So the flip is animated — the dashes march
 * along the path while a second, brighter stroke rides above the ghost, then
 * decays away and leaves the ghost alone.
 *
 * An OVERLAY rather than a renderer change, for the same reasons the validation
 * bracket is one: it touches no element model, writes nothing to the document,
 * creates no undo entry, and holds nothing that could survive a reload. "When
 * did I last flip this toggle" is session state and must never reach the
 * document.
 */

/** How long the reveal stroke takes to march across the curve. */
export const GHOST_REVEAL_MS = 600;

/** How long it then takes to fade back into the permanent ghost. */
export const GHOST_DECAY_MS = 200;

/** Total life of one reveal. */
export const GHOST_TOTAL_MS = GHOST_REVEAL_MS + GHOST_DECAY_MS;

/**
 * Reference-space units the dash pattern travels during the reveal — four
 * periods of {@link GHOST_DASH}, so the march reads as motion rather than as a
 * jitter.
 */
export const GHOST_DASH_TRAVEL = 4 * (GHOST_DASH[0] + GHOST_DASH[1]);

/**
 * Peak opacity of the reveal stroke, ON TOP of the ghost the renderer already
 * painted. Chosen so the two together reach a full-strength line at the crest
 * and never exceed it.
 */
export const GHOST_PEAK_ALPHA = 0.55;

/** One frame of the reveal. */
export interface GhostRevealFrame {
  /** Opacity of the reveal stroke; `0` means "paint nothing". */
  alpha: number;
  /** `lineDashOffset` for this frame, negative so the dashes march forward. */
  dashOffset: number;
  /** Whether this reveal is over and can be forgotten. */
  done: boolean;
}

/**
 * The whole animation, as a pure function of elapsed milliseconds.
 *
 * Pure and exported on purpose: it is the only part of this file that has an
 * opinion, and a function taking a number is testable without a canvas, a
 * surface, a DI container or a clock. The overlay below is then reduced to
 * "ask this, then stroke" — which is the part that cannot go wrong quietly.
 *
 * Out-of-range input is answered rather than trusted: a negative or non-finite
 * elapsed (a clock that went backwards, a `performance.now()` mock) paints
 * nothing instead of throwing or flashing.
 */
export function ghostRevealFrame(elapsed: number): GhostRevealFrame {
  if (!Number.isFinite(elapsed) || elapsed <= 0) {
    return { alpha: 0, dashOffset: 0, done: false };
  }
  if (elapsed >= GHOST_TOTAL_MS) {
    return { alpha: 0, dashOffset: 0, done: true };
  }

  // The march stops when the reveal does; the decay fades a still line.
  const marched = Math.min(elapsed, GHOST_REVEAL_MS) / GHOST_REVEAL_MS;
  const dashOffset = -GHOST_DASH_TRAVEL * marched;

  const alpha =
    elapsed <= GHOST_REVEAL_MS
      ? GHOST_PEAK_ALPHA * marched
      : GHOST_PEAK_ALPHA * (1 - (elapsed - GHOST_REVEAL_MS) / GHOST_DECAY_MS);

  return { alpha, dashOffset, done: false };
}

/**
 * Whether the user has asked their system for less motion.
 *
 * Read at every reveal rather than cached: the setting can change mid-session
 * (an OS toggle, a devtools emulation), and the answer costs one media query.
 * `globalThis.matchMedia` is optional-chained because this module is imported
 * by unit specs running under Node.
 */
export function prefersReducedMotion(): boolean {
  return (
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
}

/**
 * Paints the reveal stroke over whatever curves are currently on.
 *
 * The rAF loop is copied from `ValidationOverlay`, deliberately and including
 * its two guards: the clock is never armed when nothing is animating, and a
 * detached renderer stops it dead. An overlay that keeps requesting frames for
 * a surface that no longer exists is sixty repaints a second of nothing.
 */
export class EstuarineGhostOverlay extends Overlay {
  static override overlayName = 'estuarine-ghost';

  /** Element id → `performance.now()` at the moment its toggle flipped. */
  private readonly _reveals = new Map<string, number>();

  /** Armed only while something is still revealing. */
  private _frame: number | null = null;

  /**
   * Whether the renderer this overlay paints into is gone. The manager below
   * lives on the gfx scope and keeps its subscriptions on the surface MODEL,
   * which outlives the surface COMPONENT — so a toggle can perfectly well be
   * flipped after this overlay was torn down.
   */
  private _detached = false;

  private readonly _onFrame = () => {
    this._frame = null;
    this._schedule();
  };

  /** Whether any reveal is still inside its window at `now`. */
  isAnimating(now: number): boolean {
    for (const start of this._reveals.values()) {
      if (!ghostRevealFrame(now - start).done) return true;
    }
    return false;
  }

  /**
   * Start (or restart) the reveal on `elementId`.
   *
   * Reduced motion is honoured HERE rather than at the call site, so every
   * future trigger inherits it: the permanent ghost the renderer paints is
   * already the end state, so declining to animate is a complete no-op and not
   * a degraded mode.
   */
  reveal(elementId: string): void {
    if (this._detached) return;
    if (prefersReducedMotion()) return;
    this._reveals.set(elementId, performance.now());
    this._schedule();
  }

  /**
   * Repaint, and keep repainting while a reveal is inside its window. Stops on
   * its own: an idle board requests no animation frame at all.
   */
  private _schedule() {
    if (this._detached) return;
    this.refresh();
    if (this._frame !== null) return;
    if (!this.isAnimating(performance.now())) return;
    this._frame = requestAnimationFrame(this._onFrame);
  }

  private _cancelFrame() {
    if (this._frame === null) return;
    cancelAnimationFrame(this._frame);
    this._frame = null;
  }

  private _forget() {
    this._cancelFrame();
    this._reveals.clear();
  }

  override setRenderer(renderer: CanvasRenderer | null) {
    this._detached = renderer === null;
    super.setRenderer(renderer);
  }

  override clear() {
    this._forget();
    super.clear();
  }

  override dispose() {
    this._detached = true;
    this._forget();
    super.dispose();
  }

  override render(ctx: CanvasRenderingContext2D, _rc: RoughCanvas): void {
    if (this._reveals.size === 0) return;
    const surface = this.gfx.surface;
    if (!surface) return;
    const now = performance.now();

    for (const [id, start] of [...this._reveals]) {
      const frame = ghostRevealFrame(now - start);
      if (frame.done) {
        this._reveals.delete(id);
        continue;
      }
      if (frame.alpha <= 0) continue;

      const model = surface.getElementById(id);
      // Deleted, or replaced by something else entirely: the reveal is about
      // an element that no longer exists.
      if (!(model instanceof EstuarineElementModel)) {
        this._reveals.delete(id);
        continue;
      }

      const [x, y, w, h] = model.deserializedXYWH;
      ctx.save();
      // Model space, exactly like the element renderer: translate to the
      // element, rotate about its centre, then enter the STRETCHED reference
      // frame through the shared transform — the reveal stroke has to sit on
      // the ghost to the pixel, so the two go through one function, never two
      // copies of the same arithmetic. Recomputed at PAINT time rather than
      // captured at reveal time, so the stroke follows a map the user drags,
      // rotates or resizes mid-animation.
      ctx.translate(x, y);
      ctx.translate(w / 2, h / 2);
      ctx.rotate((model.rotate * Math.PI) / 180);
      ctx.translate(-w / 2, -h / 2);
      const fit = applyEstuarineTransform(ctx, w, h);

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = frame.alpha;
      ctx.setLineDash([...GHOST_DASH]);
      ctx.lineDashOffset = frame.dashOffset;

      for (const curve of estuarineCurves()) {
        if (!model[curve.visibleProp]) continue;
        ctx.strokeStyle = curve.color;
        ctx.lineWidth = curve.width * fit.curveLineScale;
        ctx.stroke(curve.path);
      }

      ctx.restore();
    }
  }
}

/** The three toggles a reveal can be triggered by. */
const SHOW_PROPS = [
  'showLiminal',
  'showVolatile',
  'showCounterfactual',
] as const;

/**
 * Turns "a curve toggle just went from off to on" into a reveal.
 *
 * The transition is read from the `elementUpdated` payload — `props` carries
 * the new value, `oldValues` the previous one — and BOTH halves are required:
 * `props.showVolatile === true` alone also fires when the map is created, when
 * a remote peer syncs an unrelated change, or when the value is rewritten
 * identically. Only a genuine `false → true` flip is a user asking to see a
 * line appear.
 */
export class EstuarineGhostManager extends InteractivityExtension {
  static override key = 'estuarine-ghost';

  private _subscriptions: { unsubscribe(): void }[] = [];

  private _disposeSurfaceEffect: (() => void) | null = null;

  private get _overlay(): EstuarineGhostOverlay | null {
    return this.std.getOptional(
      OverlayIdentifier(EstuarineGhostOverlay.overlayName)
    ) as EstuarineGhostOverlay | null;
  }

  override mounted() {
    // The surface is a SIGNAL, not a fact: it can be null at mount and arrive
    // later, and it is replaced if the surface block is.
    this._disposeSurfaceEffect = effect(() => {
      this._resubscribe(this.gfx.surface$.value);
    });
  }

  override unmounted() {
    this._disposeSurfaceEffect?.();
    this._disposeSurfaceEffect = null;
    this._unsubscribe();
    super.unmounted();
  }

  private _unsubscribe() {
    for (const subscription of this._subscriptions) subscription.unsubscribe();
    this._subscriptions = [];
  }

  private _resubscribe(surface: SurfaceBlockModel | null) {
    this._unsubscribe();
    if (!surface) return;
    this._subscriptions.push(
      surface.elementUpdated.subscribe(({ id, props, oldValues }) => {
        if (!props || !oldValues) return;
        const flipped = SHOW_PROPS.some(
          prop => props[prop] === true && oldValues[prop] === false
        );
        if (flipped) this._overlay?.reveal(id);
      })
    );
  }
}
