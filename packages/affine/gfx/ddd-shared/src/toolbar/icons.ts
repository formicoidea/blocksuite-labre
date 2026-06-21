import { svg } from 'lit';

/** Senior-button glyph — Event Storming (overlapping stickies). */
export const eventStormingToolbarIcon = svg`<svg width="100%" height="100%" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="14" width="22" height="22" rx="2" transform="rotate(-6 21 25)" fill="#F5963B"/>
  <rect x="24" y="18" width="22" height="22" rx="2" transform="rotate(5 35 29)" fill="#5BA3DB"/>
  <rect x="17" y="26" width="22" height="22" rx="2" transform="rotate(-3 28 37)" fill="#FFD84D"/>
</svg>`;

/** Senior-button glyph — Core Domain Chart (axes + bands). */
export const coreDomainToolbarIcon = svg`<svg width="100%" height="100%" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="8" width="38" height="38" fill="#4d9900" fill-opacity="0.55"/>
  <rect x="10" y="8" width="14" height="38" fill="#9933ff" fill-opacity="0.55"/>
  <path d="M10 46 V8 M10 46 H48" stroke="#1f2328" stroke-width="2.4" stroke-linecap="round"/>
  <circle cx="38" cy="18" r="4" fill="#9933ff"/>
</svg>`;

/** Senior-button glyph — Context Map (two bubbles + relation). */
export const contextMapToolbarIcon = svg`<svg width="100%" height="100%" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="10" width="22" height="14" rx="7" fill="#e6f0fa" stroke="#2f6fb0" stroke-width="1.6"/>
  <rect x="28" y="32" width="22" height="14" rx="7" fill="#e6f0fa" stroke="#2f6fb0" stroke-width="1.6"/>
  <path d="M20 24 L34 32" stroke="#1f2328" stroke-width="1.8"/>
</svg>`;
