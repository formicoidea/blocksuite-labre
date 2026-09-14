import { html } from 'lit';

/**
 * The four toolbar icons for the hollow UML endpoint heads.
 *
 * Hand-authored because `@blocksuite/icons` has no hollow variant of its
 * `StartPoint*` / `EndPoint*` set. They mirror that set deliberately: the same
 * `0 0 24 24` viewBox and the same `1em` box, so a hollow entry lines up
 * pixel-for-pixel with the filled neighbour it sits next to in the endpoint
 * menus. The difference is only the paint — the shipped icons merge stub and
 * head into one `fill='currentColor'` path, these draw the stub as a stroked
 * line and leave the head `fill="none"` so the reader sees the hollow head the
 * canvas will actually draw.
 *
 * Each is a function returning a `TemplateResult`, matching how the
 * `@blocksuite/icons` lit icons are called at the use site
 * (`StartPointDiamondIcon()`).
 */

const ICON_STYLE = 'user-select:none;flex-shrink:0;';

/** Front (start) hollow diamond — the head sits at the left end of the stub. */
export const StartPointDiamondHollowIcon = () => html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    style=${ICON_STYLE}
  >
    <path
      d="M21 12H11"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
    <path
      d="M11 12L7 8L3 12L7 16Z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
    />
  </svg>
`;

/** Rear (end) hollow diamond — the head sits at the right end of the stub. */
export const EndPointDiamondHollowIcon = () => html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    style=${ICON_STYLE}
  >
    <path
      d="M3 12H13"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
    <path
      d="M13 12L17 8L21 12L17 16Z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
    />
  </svg>
`;

/** Front (start) hollow closed triangle. */
export const StartPointTriangleHollowIcon = () => html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    style=${ICON_STYLE}
  >
    <path
      d="M21 12H10.5"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
    <path
      d="M10.5 7.5L3 12L10.5 16.5Z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
    />
  </svg>
`;

/** Rear (end) hollow closed triangle. */
export const EndPointTriangleHollowIcon = () => html`
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    style=${ICON_STYLE}
  >
    <path
      d="M3 12H13.5"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
    <path
      d="M13.5 7.5L21 12L13.5 16.5Z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
    />
  </svg>
`;
