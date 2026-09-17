/**
 * The chrome's motion tokens — the first of them, and deliberately only the
 * values the library had already converged on by hand.
 *
 * The edgeless chrome has been animating at ~0.23-0.24s since upstream
 * (`edgeless-toolbar.ts`, `create-popper.ts`, `date-picker/style.ts`, `toast`),
 * and the fork's one overshoot curve is the senior toolbar's "pop upright"
 * (`gfx/mindmap/src/toolbar/senior-tool.ts`): `cubic-bezier(0.34, 1.56, 0.64, 1)`,
 * the standard easeOutBack. Nothing exported it, so the second component that
 * wanted a springy settle would have invented a third easing. This module is
 * where it stops being a literal.
 *
 * `springEasing` overshoots by design — only use it on a transform that has
 * room to overshoot (a slide, a scale, a rotation), never on a colour or on
 * anything whose end value must never be passed.
 */
import { css, unsafeCSS } from 'lit';

/** easeOutBack: travel, overshoot a little, settle. */
export const SPRING_EASING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

/** The house tempo of the edgeless chrome, in milliseconds. */
export const SPRING_DURATION_MS = 240;

/** {@link SPRING_EASING} for a `css` template. */
export const springEasing = unsafeCSS(SPRING_EASING);

/** {@link SPRING_DURATION_MS} for a `css` template. */
export const springDuration = unsafeCSS(`${SPRING_DURATION_MS}ms`);

/**
 * Every animation and transition inside `container` off when the reader asked
 * the OS for less motion. The end state is the resting state in each case, so
 * dropping the animation loses nothing but the travel.
 */
export const reducedMotionStyle = (container: string) => css`
  @media (prefers-reduced-motion: reduce) {
    ${unsafeCSS(container)}, ${unsafeCSS(container)} * {
      animation: none !important;
      transition: none !important;
    }
  }
`;
