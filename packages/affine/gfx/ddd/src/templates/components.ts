import {
  makeTemplateSnapshot,
  type SurfaceElementsJSON,
  surfaceText,
  type Template,
} from '@labre/affine-gfx-template';
import {
  ConnectorMode,
  FontFamily,
  PointStyle,
  ShapeStyle,
  StrokeStyle,
  TextAlign,
} from '@labre/affine-model';

import {
  CD_SUBDOMAINS,
  CLOUD,
  CLOUD_VERTICES,
  CM_BUBBLE,
  CM_RELATIONSHIPS,
  ES_HOTSPOT,
  ES_STICKIES,
  MOVEMENT_COLOR,
  TEAM_TOPOLOGIES,
} from '../shared/consts';

/**
 * Every DDD component (the things the three senior menus create) re-expressed as
 * an insertable Template, so the whole toolbox is also available from the
 * Templates panel. Authored as static surface-element JSON from the SAME consts
 * the live prefabs use, so colours/labels stay in sync.
 */

const ATTRS =
  'width="100%" height="100%" viewBox="0 0 135 80" xmlns="http://www.w3.org/2000/svg"';
const NO_STROKE = '#00000000';

function tpl(name: string, preview: string, elements: SurfaceElementsJSON): Template {
  return { name, type: 'template', preview, content: makeTemplateSnapshot(elements, name) };
}

function stickyEl(fill: string, text: string, label: string, shapeType: 'rect' | 'diamond') {
  return {
    type: 'shape',
    shapeType,
    filled: true,
    fillColor: fill,
    strokeColor: NO_STROKE,
    strokeWidth: 0,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    radius: shapeType === 'rect' ? 6 : 0,
    text: surfaceText(label),
    color: text,
    fontFamily: FontFamily.Kalam,
    fontSize: 20,
    textAlign: TextAlign.Center,
    xywh: '[0,0,120,120]',
  };
}

const sq = (c: string) =>
  `<svg ${ATTRS}><rect x="38" y="13" width="60" height="54" rx="5" fill="${c}"/></svg>`;
const dia = (c: string) =>
  `<svg ${ATTRS}><rect x="48" y="20" width="40" height="40" transform="rotate(45 68 40)" fill="${c}"/></svg>`;
const circ = (c: string) =>
  `<svg ${ATTRS}><circle cx="68" cy="40" r="22" fill="${c}" stroke="#1f2328" stroke-width="1.5"/></svg>`;
const mk = (c: string, l: string) =>
  `<svg ${ATTRS}><rect x="48" y="20" width="40" height="40" rx="5" fill="${c}" stroke="#1f2328" stroke-width="1.5"/><text x="68" y="47" text-anchor="middle" font-size="20" fill="#1f2328">${l}</text></svg>`;
const line = (dashed: boolean, arrow: boolean) =>
  `<svg ${ATTRS} fill="none"><path d="M20 40 H${arrow ? 100 : 115}" stroke="#1f2328" stroke-width="2" stroke-dasharray="${dashed ? '5 4' : '0'}"/>${arrow ? '<path d="M98 32 L114 40 L98 48" stroke="#1f2328" stroke-width="2"/>' : ''}</svg>`;

/** Event Storming: one template per sticky kind + the hotspot. */
export const ES_TEMPLATES: Template[] = [
  ...ES_STICKIES.map(p =>
    tpl(`Event Storming — ${p.label}`, sq(p.fill), { s: stickyEl(p.fill, p.text, p.label, 'rect') })
  ),
  tpl('Event Storming — Hotspot', dia(ES_HOTSPOT.fill), {
    s: stickyEl(ES_HOTSPOT.fill, ES_HOTSPOT.text, ES_HOTSPOT.label, 'diamond'),
  }),
];

/** Core Domain: the chart background, the sub-domain dots, the team-topology markers, the movement arrow. */
export const CD_TEMPLATES: Template[] = [
  tpl(
    'Core Domain Chart',
    `<svg ${ATTRS} fill="none"><rect x="10" y="6" width="115" height="62" fill="#4d9900" fill-opacity="0.5"/><rect x="10" y="6" width="22" height="62" fill="#9933ff" fill-opacity="0.5"/><path d="M10 68 V6 M10 68 H125" stroke="#1f2328" stroke-width="1.6"/></svg>`,
    { bg: { type: 'coreDomain', xywh: '[0,0,900,820]' } }
  ),
  ...CD_SUBDOMAINS.map(d =>
    tpl(`Core Domain — ${d.label}`, circ(d.fill), {
      dot: {
        type: 'shape',
        shapeType: 'ellipse',
        filled: true,
        fillColor: d.fill,
        strokeColor: '#1f2328',
        strokeWidth: 1.5,
        shapeStyle: ShapeStyle.General,
        roughness: 0,
        xywh: '[0,0,26,26]',
      },
    })
  ),
  ...TEAM_TOPOLOGIES.map(t =>
    tpl(`Team topology — ${t.label}`, mk(t.fill, t.letter), {
      m: {
        type: 'shape',
        shapeType: 'rect',
        filled: true,
        fillColor: t.fill,
        strokeColor: '#1f2328',
        strokeWidth: 1.5,
        shapeStyle: ShapeStyle.General,
        roughness: 0,
        radius: 4,
        text: surfaceText(t.letter),
        color: '#1f2328',
        fontFamily: FontFamily.Inter,
        fontSize: 15,
        textAlign: TextAlign.Center,
        xywh: '[0,0,30,30]',
      },
    })
  ),
  tpl('Core Domain — Movement over time', line(true, true), {
    c: {
      type: 'connector',
      mode: ConnectorMode.Straight,
      stroke: MOVEMENT_COLOR,
      strokeWidth: 2,
      strokeStyle: StrokeStyle.Dash,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.Arrow,
      source: { position: [0, 80] },
      target: { position: [160, 0] },
    },
  }),
];

/** Context Map: the bounded-context bubble, the cloud, the nine relationship patterns. */
export const CM_TEMPLATES: Template[] = [
  tpl(
    'Context Map — Bounded Context',
    `<svg ${ATTRS} fill="none"><rect x="20" y="25" width="95" height="30" rx="15" fill="${CM_BUBBLE.fill}" stroke="${CM_BUBBLE.stroke}" stroke-width="1.6"/></svg>`,
    {
      b: {
        type: 'shape',
        shapeType: 'rect',
        filled: true,
        fillColor: CM_BUBBLE.fill,
        strokeColor: CM_BUBBLE.stroke,
        strokeWidth: 1.5,
        shapeStyle: ShapeStyle.General,
        roughness: 0,
        radius: CM_BUBBLE.radius,
        text: surfaceText('Bounded Context'),
        color: CM_BUBBLE.text,
        fontFamily: FontFamily.Inter,
        fontSize: 14,
        textAlign: TextAlign.Center,
        xywh: `[0,0,${CM_BUBBLE.w},${CM_BUBBLE.h}]`,
      },
    }
  ),
  tpl(
    'Context Map — Cloud / System',
    `<svg ${ATTRS} fill="none"><path d="M30 52 C18 52 16 40 26 37 C24 25 42 24 46 32 C50 22 70 24 70 35 C84 32 90 46 78 50 Z" fill="${CLOUD.fill}" stroke="${CLOUD.stroke}" stroke-width="1.4"/></svg>`,
    {
      c: {
        type: 'shape',
        shapeType: 'polygon',
        vertices: CLOUD_VERTICES,
        isClosed: true,
        filled: true,
        fillColor: CLOUD.fill,
        strokeColor: CLOUD.stroke,
        strokeWidth: 1.5,
        shapeStyle: ShapeStyle.General,
        roughness: 0,
        text: surfaceText('System'),
        color: '#3d3d3d',
        fontFamily: FontFamily.Inter,
        fontSize: 14,
        textAlign: TextAlign.Center,
        xywh: `[0,0,${CLOUD.w},${CLOUD.h}]`,
      },
    }
  ),
  ...CM_RELATIONSHIPS.map(r =>
    tpl(`Context Map — ${r.label}`, line(r.dashed, r.upDown), {
      c: {
        type: 'connector',
        mode: ConnectorMode.Straight,
        stroke: '#1f2328',
        strokeWidth: 2,
        strokeStyle: r.dashed ? StrokeStyle.Dash : StrokeStyle.Solid,
        frontEndpointStyle: PointStyle.None,
        rearEndpointStyle: r.upDown ? PointStyle.Arrow : PointStyle.None,
        source: { position: [0, 0] },
        target: { position: [240, 0] },
      },
      t: {
        type: 'text',
        text: surfaceText(r.abbrev),
        color: '#1f2328',
        fontFamily: FontFamily.Inter,
        fontSize: 13,
        textAlign: TextAlign.Center,
        xywh: '[94,-30,52,22]',
      },
    })
  ),
];
