import { cssVarV2 } from '@toeverything/theme/v2';
import { html } from 'lit';

/**
 * The library's spinner. Rotated by SMIL, not by a `<style>` inside the
 * SVG: that sheet was global in light DOM (any `.spinner` of the page
 * spun), and a binding after it fails to render under happy-dom, so no
 * unit spec could mount a view that draws it.
 */
export const LoadingIcon = ({
  size = '1em',
  progress = 0.2,
  ringColor = cssVarV2('loading/background'),
  strokeColor = cssVarV2('loading/foreground'),
}: {
  size?: string;
  progress?: number;
  ringColor?: string;
  strokeColor?: string;
} = {}) =>
  html`<svg
    width="${size}"
    height="${size}"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
  >
    <circle cx="12" cy="12" r="8" stroke="${ringColor}" stroke-width="4" />
    <circle
      class="spinner"
      cx="12"
      cy="12"
      r="8"
      stroke="${strokeColor}"
      stroke-width="4"
      stroke-linecap="round"
      stroke-dasharray="${2 * Math.PI * 8 * progress} ${2 *
      Math.PI *
      8 *
      (1 - progress)}"
    >
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 12 12"
        to="360 12 12"
        dur="0.75s"
        repeatCount="indefinite"
      />
    </circle>
  </svg>`;
