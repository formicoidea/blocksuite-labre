import {
  type HeadingLevel,
  HEADING_SCALE,
  headingLineBox,
} from '@labre/affine-shared/consts';
import {
  BLOCK_NAME_BULLETED_LIST,
  BLOCK_NAME_CODE_BLOCK,
  BLOCK_NAME_DIVIDER,
  BLOCK_NAME_NUMBERED_LIST,
  BLOCK_NAME_QUOTE,
  BLOCK_NAME_TEXT,
  BLOCK_NAME_TODO_LIST,
} from '@labre/affine-shared/services';
import type { SlashMenuTooltip } from '@labre/affine-widget-slash-menu';
import { html, svg } from 'lit';

import {
  NOTE_TOOLTIP_BOLD_TEXT,
  NOTE_TOOLTIP_HEADING_1,
  NOTE_TOOLTIP_HEADING_2,
  NOTE_TOOLTIP_HEADING_3,
  NOTE_TOOLTIP_HEADING_4,
  NOTE_TOOLTIP_HEADING_5,
  NOTE_TOOLTIP_HEADING_6,
  NOTE_TOOLTIP_ITALIC,
  NOTE_TOOLTIP_STRIKETHROUGH,
  NOTE_TOOLTIP_UNDERLINE,
} from '../translations.js';
// prettier-ignore
const TextTooltip = html`<svg width="170" height="68" viewBox="0 0 170 68" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="170" height="68" rx="2" fill="white"/>
<mask id="mask0_16460_868" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="170" height="68">
<rect width="170" height="68" rx="2" fill="white"/>
</mask>
<g mask="url(#mask0_16460_868)">
<rect x="8" y="8.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="20.1364" width="126.5" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="36.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="48.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="64.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="76.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="88.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="100.136" width="66" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="116.136" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="128.136" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/>
</g>
</svg>
`;

/** The preview frame: every slash-menu figure is a 170×68 card. */
const PREVIEW_HEIGHT = 68;
/** Space above the first line of a preview, px. */
const PREVIEW_PADDING_TOP = 6;
/**
 * Space a preview keeps free under its last line, px. A body line is drawn only
 * if its whole line box ends above it, so no line is ever cut by the frame.
 */
const PREVIEW_PADDING_BOTTOM = 2;

/** The body text under a heading preview, shrunk to 10px on a 12px line. */
const BODY_FONT_SIZE = 10;
const BODY_LINE_HEIGHT = 12;
/** Extra space between two paragraphs of the body, px. */
const BODY_PARAGRAPH_GAP = 4;
/**
 * The body, as the lines it is set in (the `text` preview's own wording). A
 * paragraph ends with a newline, as the Figma export wrote it.
 */
const BODY_PARAGRAPHS: readonly (readonly string[])[] = [
  [
    'In a decentralized system, we can have a kaleidoscopic ',
    'complexity to our data.\n',
  ],
  [
    'Any user may have a different perspective on what data they ',
    'either have, choose to share, or accept.\n',
  ],
  [
    'For example, one user\u2019s edits to a document might be on ',
    'their laptop on an airplane; when the plane lands and the ',
    'computer reconnects, those changes are distributed to ',
    'other users.\n',
  ],
  [
    'Other users might choose to accept all, some, or none of ',
    'those changes to their version of the document.',
  ],
];

/**
 * Where Figma sets an Inter baseline in a line box: 4/11 em below the box's
 * centre (half of Inter's ascent minus descent).
 */
function interBaseline(top: number, lineHeight: number, fontSize: number) {
  return Number((top + lineHeight / 2 + (fontSize * 4) / 11).toFixed(4));
}

/**
 * The body lines of a heading preview that fit ENTIRELY in the frame, with the
 * baseline each is set on.
 *
 * The body starts right under the heading's line box, so how many of its lines
 * the card can show depends on the level: derived here from the geometry (line
 * boxes, frame height, bottom padding) rather than tuned per level. At 10px on
 * a 12px line, Inter's descenders end within a twentieth of a pixel of the line
 * box's bottom edge, which the bottom padding covers: a line whose box fits is
 * never clipped.
 */
export function headingPreviewBodyLines(
  level: HeadingLevel
): { y: number; text: string }[] {
  const limit = PREVIEW_HEIGHT - PREVIEW_PADDING_BOTTOM;
  const lines: { y: number; text: string }[] = [];
  let top = PREVIEW_PADDING_TOP + headingLineBox(level);
  for (const [index, paragraph] of BODY_PARAGRAPHS.entries()) {
    if (index > 0) top += BODY_PARAGRAPH_GAP;
    for (const text of paragraph) {
      if (top + BODY_LINE_HEIGHT > limit) return lines;
      lines.push({
        y: interBaseline(top, BODY_LINE_HEIGHT, BODY_FONT_SIZE),
        text,
      });
      top += BODY_LINE_HEIGHT;
    }
  }
  return lines;
}

/**
 * A heading preview drawn at the heading's real size and line box (from
 * `HEADING_SCALE`), above as many lines of body text as the card shows whole
 * (`headingPreviewBodyLines`). No preview carries text: every line — the
 * heading title and each body line — is a skeleton bar, so no illustration
 * ever needs a translation. The heading bar keeps deriving its width and
 * height from `fontSize`, so H1's bar stays visibly larger than H2's, and so
 * on down the scale (i18n lot L4).
 */
// prettier-ignore
function headingTooltip(level: HeadingLevel) {
  const { fontSize } = HEADING_SCALE[level];
  const lineBox = headingLineBox(level);
  const maskId = `mask_heading_tooltip_${level}`;
  /** Same convention as the rest of this lot's redrawn previews. */
  const barWidth = (text: string, size: number) =>
    Math.min(text.replace(/\n/g, '').length * 0.55 * size, 170 - 8);
  const headingLabel = `Heading ${level.slice(1)}`;
  const headingY = interBaseline(PREVIEW_PADDING_TOP, lineBox, fontSize);
  const body = headingPreviewBodyLines(level).map(
    line => svg`<rect x="8" y=${line.y - 0.75 * BODY_FONT_SIZE} width=${barWidth(line.text, BODY_FONT_SIZE)} height=${0.8 * BODY_FONT_SIZE} rx=${0.4 * BODY_FONT_SIZE} fill="#121212" fill-opacity="0.3"/>`
  );
  return html`<svg width="170" height="68" viewBox="0 0 170 68" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="170" height="68" rx="2" fill="white"/>
<mask id=${maskId} style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="170" height="68">
<rect width="170" height="68" rx="2" fill="white"/>
</mask>
<g mask="url(#${maskId})">
<rect x="8" y=${headingY - 0.75 * fontSize} width=${barWidth(headingLabel, fontSize)} height=${0.8 * fontSize} rx=${0.4 * fontSize} fill="#121212" fill-opacity="0.3"/>
${body}
</g>
</svg>
`;
}

const Heading1Tooltip = headingTooltip('h1');
const Heading2Tooltip = headingTooltip('h2');
const Heading3Tooltip = headingTooltip('h3');
const Heading4Tooltip = headingTooltip('h4');
const Heading5Tooltip = headingTooltip('h5');
const Heading6Tooltip = headingTooltip('h6');

// prettier-ignore
const CodeBlockTooltip = html`<svg width="170" height="68" viewBox="0 0 170 68" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="170" height="68" rx="2" fill="white"/>
<mask id="mask0_16460_915" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="170" height="68">
<rect width="170" height="68" rx="2" fill="white"/>
</mask>
<g mask="url(#mask0_16460_915)">
<text fill="#121212" xml:space="preserve" style="white-space: pre" font-family="var(--affine-font-code-family)" font-size="11" letter-spacing="0em"><tspan x="47.5742" y="17.46"> </tspan><tspan x="126.723" y="17.46">: </tspan><tspan x="166.297" y="17.46"> {&#10;</tspan><tspan x="8" y="32.46">    </tspan><tspan x="8" y="47.46">    </tspan><tspan x="126.723" y="47.46"> </tspan><tspan x="159.701" y="47.46"> {&#10;</tspan><tspan x="8" y="62.46">        </tspan><tspan x="87.1484" y="62.46">(</tspan><tspan x="219.062" y="62.46">)&#10;</tspan><tspan x="8" y="77.46">}&#10;</tspan><tspan x="8" y="92.46">}</tspan></text><rect x="100.34" y="24.21" width="54.45" height="8.8" rx="4.4" fill="#121212" fill-opacity="0.3"/><rect x="166.297" y="24.21" width="3.703" height="8.8" rx="4.4" fill="#121212" fill-opacity="0.3"/><rect x="54.1699" y="39.21" width="42.35" height="8.8" rx="4.4" fill="#121212" fill-opacity="0.3"/>
<text fill="#0782A0" xml:space="preserve" style="white-space: pre" font-family="var(--affine-font-code-family)" font-size="11" letter-spacing="0em"><tspan x="159.701" y="32.46">=</tspan><tspan x="139.914" y="62.46">\(</tspan></text><rect x="8" y="9.21" width="36.3" height="8.8" rx="4.4" fill="#0782A0" fill-opacity="0.3"/><rect x="73.957" y="24.21" width="24.2" height="8.8" rx="4.4" fill="#0782A0" fill-opacity="0.3"/><rect x="34.3828" y="39.21" width="18.15" height="8.8" rx="4.4" fill="#0782A0" fill-opacity="0.3"/><rect x="100.34" y="39.21" width="24.2" height="8.8" rx="4.4" fill="#0782A0" fill-opacity="0.3"/>
<rect x="54.1699" y="9.21" width="66.55" height="8.8" rx="4.4" fill="#842ED3" fill-opacity="0.3"/>
<rect x="139.914" y="9.21" width="24.2" height="8.8" rx="4.4" fill="#C62222" fill-opacity="0.3"/><rect x="34.3828" y="24.21" width="36.3" height="8.8" rx="4.4" fill="#C62222" fill-opacity="0.3"/><rect x="133.318" y="39.21" width="24.2" height="8.8" rx="4.4" fill="#C62222" fill-opacity="0.3"/>
<rect x="60.7656" y="54.21" width="24.2" height="8.8" rx="4.4" fill="#2159D3" fill-opacity="0.3"/>
<rect x="93.7441" y="54.21" width="42.35" height="8.8" rx="4.4" fill="#D34F0B" fill-opacity="0.3"/><rect x="153.105" y="54.21" width="16.895" height="8.8" rx="4.4" fill="#D34F0B" fill-opacity="0.3"/>
</g>
</svg>
`;

// prettier-ignore
const QuoteTooltip = html`<svg width="170" height="68" viewBox="0 0 170 68" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="170" height="68" rx="2" fill="white"/>
<mask id="mask0_16460_920" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="170" height="68">
<rect width="170" height="68" rx="2" fill="white"/>
</mask>
<g mask="url(#mask0_16460_920)">
<rect x="12" y="14" width="2" height="33" rx="1" fill="#C2C1C5"/>
<rect x="24" y="19.1364" width="146" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="24" y="33.1364" width="146" height="8" rx="4" fill="#121212" fill-opacity="0.3"/>
</g>
</svg>
`;

// prettier-ignore
const DividerTooltip = html`<svg width="170" height="68" viewBox="0 0 170 68" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="170" height="68" rx="2" fill="white"/>
<mask id="mask0_16460_928" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="170" height="68">
<rect width="170" height="68" rx="2" fill="white"/>
</mask>
<g mask="url(#mask0_16460_928)">
<rect x="8" y="9.1364" width="162" height="8" rx="4" fill="black" fill-opacity="0.3"/><rect x="8" y="23.1364" width="162" height="8" rx="4" fill="black" fill-opacity="0.3"/><rect x="8" y="47.1364" width="162" height="8" rx="4" fill="black" fill-opacity="0.3"/><rect x="8" y="61.1364" width="162" height="8" rx="4" fill="black" fill-opacity="0.3"/><rect x="8" y="75.1364" width="93.5" height="8" rx="4" fill="black" fill-opacity="0.3"/><rect x="8" y="99.136" width="162" height="8" rx="4" fill="black" fill-opacity="0.3"/><rect x="8" y="113.136" width="162" height="8" rx="4" fill="black" fill-opacity="0.3"/><rect x="8" y="127.136" width="162" height="8" rx="4" fill="black" fill-opacity="0.3"/><rect x="8" y="141.136" width="162" height="8" rx="4" fill="black" fill-opacity="0.3"/><rect x="8" y="155.136" width="148.5" height="8" rx="4" fill="black" fill-opacity="0.3"/><rect x="8" y="179.136" width="162" height="8" rx="4" fill="black" fill-opacity="0.3"/><rect x="8" y="193.136" width="162" height="8" rx="4" fill="black" fill-opacity="0.3"/><rect x="8" y="207.136" width="132" height="8" rx="4" fill="black" fill-opacity="0.3"/>
<line x1="8.25" y1="40.75" x2="169.75" y2="40.75" stroke="#E3E2E4" stroke-width="0.5" stroke-linecap="round"/>
</g>
</svg>
`;

// prettier-ignore
const BulletedListTooltip = html`<svg width="170" height="68" viewBox="0 0 170 68" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="170" height="68" rx="2" fill="white"/>
<mask id="mask0_16460_934" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="170" height="68">
<rect width="170" height="68" rx="2" fill="white"/>
</mask>
<g mask="url(#mask0_16460_934)">
<circle cx="14" cy="26" r="1.5" fill="#1C81D9"/>
<rect x="22" y="22.1364" width="148" height="8" rx="4" fill="#121212" fill-opacity="0.3"/>
<circle cx="14" cy="42" r="1.5" fill="#1C81D9"/>
<rect x="22" y="38.1364" width="148" height="8" rx="4" fill="#121212" fill-opacity="0.3"/>
</g>
</svg>
`;

// prettier-ignore
const NumberedListTooltip = html`<svg width="170" height="68" viewBox="0 0 170 68" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="170" height="68" rx="2" fill="white"/>
<mask id="mask0_16460_947" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="170" height="68">
<rect width="170" height="68" rx="2" fill="white"/>
</mask>
<g mask="url(#mask0_16460_947)">
<g clip-path="url(#clip0_16460_947)">
<text fill="#1C81D9" xml:space="preserve" style="white-space: pre" font-family="Inter" font-size="10" letter-spacing="0px"><tspan x="10" y="29.6364">1.</tspan></text>
</g>
<rect x="24" y="22.1364" width="146" height="8" rx="4" fill="#121212" fill-opacity="0.3"/>
<g clip-path="url(#clip1_16460_947)">
<text fill="#1C81D9" xml:space="preserve" style="white-space: pre" font-family="Inter" font-size="10" letter-spacing="0px"><tspan x="10" y="45.6364">2.</tspan></text>
</g>
<rect x="24" y="38.1364" width="146" height="8" rx="4" fill="#121212" fill-opacity="0.3"/>
</g>
<defs>
<clipPath id="clip0_16460_947">
<rect width="16" height="16" fill="white" transform="translate(10 18)"/>
</clipPath>
<clipPath id="clip1_16460_947">
<rect width="16" height="16" fill="white" transform="translate(10 34)"/>
</clipPath>
</defs>
</svg>
`;

// prettier-ignore
export const BoldTextTooltip = html`<svg width="170" height="68" viewBox="0 0 170 68" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="170" height="68" rx="2" fill="white"/>
<mask id="mask0_16460_971" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="170" height="68">
<rect width="170" height="68" rx="2" fill="white"/>
</mask>
<g mask="url(#mask0_16460_971)">
<rect x="8" y="36.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="48.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="64.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="76.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="88.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="100.136" width="66" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="116.136" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="128.136" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/>
<rect x="8" y="7.5364" width="162" height="9.2" rx="4.6" fill="#121212" fill-opacity="0.65"/><rect x="8" y="19.5364" width="126.5" height="9.2" rx="4.6" fill="#121212" fill-opacity="0.65"/>
</g>
</svg>
`;

// prettier-ignore
export const ItalicTooltip = html`<svg width="170" height="68" viewBox="0 0 170 68" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="170" height="68" rx="2" fill="white"/>
<mask id="mask0_16460_976" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="170" height="68">
<rect width="170" height="68" rx="2" fill="white"/>
</mask>
<g mask="url(#mask0_16460_976)">
<rect x="8" y="36.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="48.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="64.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="76.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="88.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="100.136" width="66" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="116.136" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="128.136" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/>
<g transform="translate(89 12.1364) skewX(-28) translate(-89 -12.1364)"><rect x="8" y="8.1364" width="162" height="8" rx="1" fill="#121212" fill-opacity="0.3"/></g><g transform="translate(71.25 24.1364) skewX(-28) translate(-71.25 -24.1364)"><rect x="8" y="20.1364" width="126.5" height="8" rx="1" fill="#121212" fill-opacity="0.3"/></g>
</g>
</svg>
`;

// prettier-ignore
export const StrikethroughTooltip = html`<svg width="170" height="68" viewBox="0 0 170 68" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="170" height="68" rx="2" fill="white"/>
<mask id="mask0_16460_986" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="170" height="68">
<rect width="170" height="68" rx="2" fill="white"/>
</mask>
<g mask="url(#mask0_16460_986)">
<rect x="8" y="36.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="48.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="64.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="76.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="88.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="100.136" width="66" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="116.136" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="128.136" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/>
<rect x="8" y="8.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="20.1364" width="126.5" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="11.5364" width="162" height="1.2" fill="#121212"/><rect x="8" y="23.5364" width="126.5" height="1.2" fill="#121212"/>
</g>
</svg>
`;

// prettier-ignore
export const UnderlineTooltip = html`<svg width="170" height="68" viewBox="0 0 170 68" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="170" height="68" rx="2" fill="white"/>
<mask id="mask0_16460_981" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="170" height="68">
<rect width="170" height="68" rx="2" fill="white"/>
</mask>
<g mask="url(#mask0_16460_981)">
<rect x="8" y="36.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="48.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="64.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="76.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="88.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="100.136" width="66" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="116.136" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="128.136" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/>
<rect x="8" y="8.1364" width="162" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="20.1364" width="126.5" height="8" rx="4" fill="#121212" fill-opacity="0.3"/><rect x="8" y="18.1364" width="162" height="1.2" fill="#121212"/><rect x="8" y="30.1364" width="126.5" height="1.2" fill="#121212"/>
</g>
</svg>
`;

// prettier-ignore
export const TodoTooltip = html`<svg width="170" height="68" viewBox="0 0 170 68" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="170" height="68" rx="2" fill="white"/>
<mask id="mask0_5604_203551" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="170" height="68">
<rect width="170" height="68" rx="2" fill="white"/>
</mask>
<g mask="url(#mask0_5604_203551)">
<path fill-rule="evenodd" clip-rule="evenodd" d="M13.6667 19C12.7462 19 12 19.7462 12 20.6667V27.3333C12 28.2538 12.7462 29 13.6667 29H20.3333C21.2538 29 22 28.2538 22 27.3333V20.6667C22 19.7462 21.2538 19 20.3333 19H13.6667ZM12.9091 20.6667C12.9091 20.2483 13.2483 19.9091 13.6667 19.9091H20.3333C20.7517 19.9091 21.0909 20.2483 21.0909 20.6667V27.3333C21.0909 27.7517 20.7517 28.0909 20.3333 28.0909H13.6667C13.2483 28.0909 12.9091 27.7517 12.9091 27.3333V20.6667Z" fill="#77757D"/>
<rect x="28" y="20.1364" width="142" height="8" rx="4" fill="#121212" fill-opacity="0.3"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M12 40.6667C12 39.7462 12.7462 39 13.6667 39H20.3333C21.2538 39 22 39.7462 22 40.6667V47.3333C22 48.2538 21.2538 49 20.3333 49H13.6667C12.7462 49 12 48.2538 12 47.3333V40.6667ZM19.7457 42.5032C19.9232 42.3257 19.9232 42.0379 19.7457 41.8604C19.5681 41.6829 19.2803 41.6829 19.1028 41.8604L16.0909 44.8723L15.2002 43.9816C15.0227 43.8041 14.7349 43.8041 14.5574 43.9816C14.3799 44.1591 14.3799 44.4469 14.5574 44.6244L15.7695 45.8366C15.947 46.0141 16.2348 46.0141 16.4123 45.8366L19.7457 42.5032Z" fill="#1E96EB"/>
<rect x="28" y="40.1364" width="142" height="8" rx="4" fill="#8E8D91" fill-opacity="0.55"/>
</g>
</svg>
`

export const tooltips: Record<string, SlashMenuTooltip> = {
  Text: {
    figure: TextTooltip,
    caption: 'Text',
    captionWording: BLOCK_NAME_TEXT,
  },

  'Heading 1': {
    figure: Heading1Tooltip,
    caption: 'Heading #1',
    captionWording: NOTE_TOOLTIP_HEADING_1,
  },

  'Heading 2': {
    figure: Heading2Tooltip,
    caption: 'Heading #2',
    captionWording: NOTE_TOOLTIP_HEADING_2,
  },

  'Heading 3': {
    figure: Heading3Tooltip,
    caption: 'Heading #3',
    captionWording: NOTE_TOOLTIP_HEADING_3,
  },

  'Heading 4': {
    figure: Heading4Tooltip,
    caption: 'Heading #4',
    captionWording: NOTE_TOOLTIP_HEADING_4,
  },

  'Heading 5': {
    figure: Heading5Tooltip,
    caption: 'Heading #5',
    captionWording: NOTE_TOOLTIP_HEADING_5,
  },

  'Heading 6': {
    figure: Heading6Tooltip,
    caption: 'Heading #6',
    captionWording: NOTE_TOOLTIP_HEADING_6,
  },

  'Code Block': {
    figure: CodeBlockTooltip,
    caption: 'Code Block',
    captionWording: BLOCK_NAME_CODE_BLOCK,
  },

  Quote: {
    figure: QuoteTooltip,
    caption: 'Quote',
    captionWording: BLOCK_NAME_QUOTE,
  },

  Divider: {
    figure: DividerTooltip,
    caption: 'Divider',
    captionWording: BLOCK_NAME_DIVIDER,
  },

  'Bulleted List': {
    figure: BulletedListTooltip,
    caption: 'Bulleted List',
    captionWording: BLOCK_NAME_BULLETED_LIST,
  },

  'Numbered List': {
    figure: NumberedListTooltip,
    caption: 'Numbered List',
    captionWording: BLOCK_NAME_NUMBERED_LIST,
  },

  Bold: {
    figure: BoldTextTooltip,
    caption: 'Bold Text',
    captionWording: NOTE_TOOLTIP_BOLD_TEXT,
  },

  Italic: {
    figure: ItalicTooltip,
    caption: 'Italic',
    captionWording: NOTE_TOOLTIP_ITALIC,
  },

  Underline: {
    figure: UnderlineTooltip,
    caption: 'Underline',
    captionWording: NOTE_TOOLTIP_UNDERLINE,
  },

  Strikethrough: {
    figure: StrikethroughTooltip,
    caption: 'Strikethrough',
    captionWording: NOTE_TOOLTIP_STRIKETHROUGH,
  },

  'To-do List': {
    figure: TodoTooltip,
    caption: 'To-do List',
    captionWording: BLOCK_NAME_TODO_LIST,
  },
};
