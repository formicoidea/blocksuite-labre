import {
  makeTemplateSnapshot,
  type SurfaceElementsJSON,
  surfaceText,
  surfaceYMap,
  type Template,
  type TemplateCategory,
  templateFromCommand,
} from '@labre/affine-gfx-template';
import {
  ConnectorMode,
  type EdgyNodeKind,
  FontFamily,
  PointStyle,
  ShapeStyle,
  StrokeStyle,
  TextAlign,
} from '@labre/affine-model';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
import {
  type ChromeWording,
  translateKey,
} from '@labre/affine-shared/services';
import type { BlockStdScope, CommandDescriptor } from '@labre/std';

import { edgyCommands } from '../commands';
import {
  edgyElementLabel,
  edgyElementLabelKey,
  edgyVerbSeedKey,
} from '../metamodel';
import { NODE_FILL, NODE_STROKE, NODE_STROKE_WIDTH } from '../node/consts';
import { edgyNodeProps, edgyNodeTextProps } from '../presets';
import { edgyDynamicTemplate } from './dynamic';

/**
 * The seeds that belong to these four scenes only — a case name, a lane
 * title, a step counter — and nowhere else in the framework. Declared once so
 * the builders below and the manifest (`../translations.ts`) read the very
 * same fallback. The twelve element/zone names and the two verbs these scenes
 * REUSE (`Organisation`, `Task`, `traverses`…) go through
 * `edgyElementLabelKey` / `edgyVerbSeedKey` instead — the same key the
 * metamodel and `templates/dynamic.ts` already write, per "un mot partagé =
 * une clé".
 */
const S = (slug: string, fallback: string) => ({
  key: `com.labre.edgy.seed.${slug}`,
  fallback,
});

/**
 * The four hand-composed scenes' own tile names — chrome, not seeds: a
 * `Template.nameKey`, re-resolved every time the panel opens, never written
 * into a document. None of the four derives from a command.
 */
export const EDGY_TEMPLATE_NAME_FACETS_OVERVIEW: ChromeWording = [
  'com.labre.edgy.template.facets-overview',
  'Facets overview',
];
export const EDGY_TEMPLATE_NAME_CUSTOMER_JOURNEY: ChromeWording = [
  'com.labre.edgy.template.customer-journey',
  'Customer journey',
];
export const EDGY_TEMPLATE_NAME_SERVICE_BLUEPRINT: ChromeWording = [
  'com.labre.edgy.template.service-blueprint',
  'Service blueprint',
];
export const EDGY_TEMPLATE_NAME_ORGANISATION_CHART: ChromeWording = [
  'com.labre.edgy.template.organisation-chart',
  'Organisation chart',
];

export const EDGY_TEMPLATE_SEED = {
  facetsTitle: S('facets-title', 'Facets'),
  intersectionsTitle: S('intersections-title', 'Intersections'),
  journeyStep: S('journey-step', 'Journey step {{n}}'),
  channel: S('channel-n', 'Channel {{n}}'),
  taskN: S('task-n', 'Task {{n}}'),
  customer: S('customer', 'Customer'),
  laneEvidence: S('lane-physical-evidence', 'Physical Evidence'),
  laneCustomerActions: S('lane-customer-actions', 'Customer Actions'),
  laneOnstage: S('lane-onstage-actions', 'On-stage Actions'),
  laneBackstage: S('lane-backstage-actions', 'Back-stage Actions'),
  laneSupportProcesses: S('lane-support-processes', 'Support Processes'),
  laneSupportSystems: S('lane-support-systems', 'Support Systems'),
  admissionForm: S('admission-form', 'Admission Form'),
  confirmation: S('confirmation', 'Confirmation'),
  sendForm: S('send-form', 'Send Form'),
  followStatus: S('follow-status', 'Follow status'),
  receiveDecision: S('receive-decision', 'Receive decision'),
  formHandling: S('form-handling', 'Form handling'),
  customerSupport: S('customer-support', 'Customer support'),
  contact: S('contact', 'Contact'),
  customerService: S('customer-service', 'Customer service'),
  customerFollowUp: S('customer-follow-up', 'Customer follow-up'),
  processForm: S('process-form', 'Process Form'),
  decisionAcceptReject: S('decision-accept-reject', 'Decision [Accept|Reject]'),
  crmApplication: S('crm-application', 'CRM Application'),
  caseManagement: S('case-management', 'Case Management'),
  paymentsSystem: S('payments-system', 'Payments System'),
  businessUnit: S('business-unit', 'Business Unit {{unit}}'),
  group: S('group', 'Group {{code}}'),
} as const;

/**
 * One seed's resolved text — the host's catalogue when `std` is a real
 * inserting editor, the English fallback when building the module's own
 * `content` (no editor exists yet at that point).
 */
function seedText(
  std: BlockStdScope | undefined,
  def: { key: string; fallback: string },
  params?: Record<string, string | number>
): string {
  return std
    ? translateKey(std, def.key, def.fallback, params)
    : // No interpolation library at module load: every fallback with a
      // placeholder is filled by hand here, the same way `translateKey`
      // fills it internally when a host has no entry for the key.
      Object.entries(params ?? {}).reduce(
        (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
        def.fallback
      );
}

/** One of the twelve element/zone names, shared with the rest of the framework. */
function elementLabel(
  std: BlockStdScope | undefined,
  name: Parameters<typeof edgyElementLabel>[0]
): string {
  return seedText(std, {
    key: edgyElementLabelKey(name),
    fallback: edgyElementLabel(name),
  });
}

/** One of the metamodel's verbs, shared with `templates/dynamic.ts`. */
function verbLabel(std: BlockStdScope | undefined, verb: string): string {
  return seedText(std, { key: edgyVerbSeedKey(verb), fallback: verb });
}

/**
 * The EDGY palette — DERIVED from the toolbox, one template per command.
 *
 * Every single-artefact entry below is what its command actually draws, run
 * once against a recording surface. They used to be hand-written restatements
 * and had drifted exactly as far as a copy drifts (audit of 2026-09-09): the
 * four base elements carried no `role` at all, so `edgy.overlapping-artefacts`
 * never saw them, the auto legend never legended them and the info panel would
 * not open on them; "People" arrived as two loose elements where the button
 * groups the glyph with its name; the texts were English literals outside the
 * translation seam; the label box was 16/24/+70 against the toolbox's
 * 18/26/+72; and `1.5` was spelled out a second time instead of
 * `FACETS_SCALE`. Derived, none of that can happen again — and
 * `templates-parity.unit.spec.ts` re-runs each command and compares.
 *
 * The five COMPOSITIONS stay hand-written: a customer journey or an org chart
 * is an arrangement of a dozen artefacts, which no single command draws. They
 * are built on the same presets, and the same test checks their composition.
 */

/** The command a derived template is the picture of. Throws rather than skips. */
function byId(id: string): CommandDescriptor {
  const command = edgyCommands.find(entry => entry.id === id);
  if (!command) throw new Error(`[edgy] templates: no command "${id}"`);
  return command;
}

// EDGY facet palette (header / pale sub-card).
//
// NOT `EDGY_ZONE_FILL`: the metamodel's palette is ONE pastel per zone — the
// colour an official element is drawn with — where the overview needs a
// saturated header AND the pale card that sits on it. Two colours per facet is
// a different table, not a drifted copy of that one.
const C = {
  identity: ['#1ec873', '#9fe6c2'],
  organisation: ['#4fd0ea', '#c2eef8'],
  architecture: ['#2f6ff0', '#b3c8f7'],
  product: ['#cf8cff', '#e7ccff'],
  experience: ['#f5246e', '#ffc0d4'],
  brand: ['#eeba51', '#f7e1ad'],
} as const;
const JOURNEY_PINK = '#f3a3c0';

// ── element helpers ───────────────────────────────────────────────────
function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: {
    fill?: string;
    stroke?: string;
    sw?: number;
    radius?: number;
    text?: string;
    textColor?: string;
    fontSize?: number;
  } = {}
) {
  const el: Record<string, unknown> = {
    type: 'shape',
    shapeType: 'rect',
    filled: true,
    fillColor: opts.fill ?? NODE_FILL,
    strokeColor: opts.stroke ?? NODE_STROKE,
    strokeWidth: opts.sw ?? NODE_STROKE_WIDTH,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    radius: opts.radius ?? 0,
    xywh: `[${x},${y},${w},${h}]`,
  };
  if (opts.text != null) {
    el.text = surfaceText(opts.text);
    el.color = opts.textColor ?? NODE_STROKE;
    el.fontFamily = FontFamily.Inter;
    el.fontSize = opts.fontSize ?? 16;
    el.textAlign = TextAlign.Center;
  }
  return el;
}

/**
 * An EDGY node of a COMPOSITION — {@link edgyNodeProps} says what that is, and
 * this adds the two things an illustration decides for itself.
 *
 * `role: undefined` writes nothing, and it is the point: the journey, the
 * blueprint, the org chart and the facets overview are DRAWINGS the engine
 * never looks at, a decision `edgy-dynamic.unit.spec.ts` pins. Only the EDGY
 * dynamic template — the one that IS the metamodel — stamps its elements, and
 * it does so through the same preset.
 */
function enode(
  kind: EdgyNodeKind,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: {
    fill?: string;
    text?: string;
    textColor?: string;
    fontSize?: number;
  } = {}
) {
  const el: Record<string, unknown> = {
    ...edgyNodeProps(kind, { xywh: `[${x},${y},${w},${h}]` }),
    role: undefined,
    ...(opts.fill === undefined ? {} : { fillColor: opts.fill }),
  };
  if (opts.text != null) {
    Object.assign(el, edgyNodeTextProps(opts.text, opts.fontSize));
    // A snapshot stores the words as a serialized `Y.Text`, where
    // `addElement` takes a plain string.
    el.text = surfaceText(opts.text);
    if (opts.textColor !== undefined) el.color = opts.textColor;
  }
  return el;
}

function label(
  x: number,
  y: number,
  w: number,
  h: number,
  str: string,
  opts: { color?: string; fontSize?: number; align?: TextAlign } = {}
) {
  return {
    type: 'text',
    text: surfaceText(str),
    color: opts.color ?? NODE_STROKE,
    fontFamily: FontFamily.Inter,
    fontSize: opts.fontSize ?? 16,
    textAlign: opts.align ?? TextAlign.Center,
    xywh: `[${x},${y},${w},${h}]`,
  };
}

/**
 * The group a node and its name travel as — what `createEdgyPeople` writes and
 * what these compositions had never carried, so dragging the person out of a
 * journey left the word "Customer" behind.
 */
const pair = (node: string, name: string) => ({
  type: 'group',
  children: surfaceYMap({ [node]: true, [name]: true }),
});

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: { arrow?: boolean; dash?: boolean; sw?: number } = {}
) {
  return {
    type: 'connector',
    mode: ConnectorMode.Orthogonal,
    stroke: NODE_STROKE,
    strokeWidth: opts.sw ?? 2,
    strokeStyle: opts.dash ? StrokeStyle.Dash : StrokeStyle.Solid,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: opts.arrow ? PointStyle.Triangle : PointStyle.None,
    source: { position: [x1, y1] },
    target: { position: [x2, y2] },
  };
}

/**
 * Connector ATTACHED to two template elements (by key): endpoints clip to the
 * element edges and follow moves — unlike `line()`, whose free positions are
 * only right until the user drags something.
 */
function attach(
  src: string,
  dst: string,
  opts: { arrow?: boolean; mode?: ConnectorMode } = {}
) {
  return {
    type: 'connector',
    mode: opts.mode ?? ConnectorMode.Straight,
    stroke: NODE_STROKE,
    strokeWidth: 2,
    strokeStyle: StrokeStyle.Solid,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: opts.arrow ? PointStyle.Triangle : PointStyle.None,
    source: { id: src },
    target: { id: dst },
  };
}

// ── Facets overview (six facets, sub-cards, facets/intersections) ─────
function facetsOverview(std?: BlockStdScope): SurfaceElementsJSON {
  const out: SurfaceElementsJSON = {};
  const el = (name: Parameters<typeof edgyElementLabel>[0]) =>
    elementLabel(std, name);
  const tall = (
    key: keyof typeof C,
    x: number,
    name: string,
    cards: [string, string, string]
  ) => {
    const [hdr, sub] = C[key];
    out[`${key}F`] = rect(x, 140, 192, 460, {
      fill: hdr,
      stroke: hdr,
      radius: 16,
    });
    out[`${key}N`] = label(x, 168, 192, 28, name, {
      color: '#ffffff',
      fontSize: 18,
    });
    out[`${key}1`] = rect(x + 16, 208, 160, 80, {
      fill: sub,
      stroke: sub,
      radius: 6,
      text: cards[0],
      fontSize: 16,
    });
    out[`${key}2`] = rect(x + 16, 300, 160, 80, {
      fill: sub,
      stroke: sub,
      radius: 6,
      text: cards[1],
      fontSize: 16,
    });
    out[`${key}3`] = enode('activity', x + 16, 392, 160, 84, {
      fill: sub,
      text: cards[2],
      fontSize: 16,
    });
  };
  const low = (key: keyof typeof C, x: number, name: string) => {
    const [hdr, sub] = C[key];
    out[`${key}F`] = rect(x, 300, 192, 424, {
      fill: hdr,
      stroke: hdr,
      radius: 16,
    });
    out[`${key}1`] = rect(x + 16, 360, 160, 92, {
      fill: sub,
      stroke: sub,
      radius: 6,
      text: name,
      fontSize: 16,
    });
    out[`${key}N`] = label(x, 686, 192, 28, name, {
      color: '#ffffff',
      fontSize: 18,
    });
  };
  // lower facets first (drawn behind the tall ones at the overlaps)
  low('organisation', 240, el('organisation'));
  low('product', 664, el('product'));
  low('brand', 1088, el('brand'));
  tall('identity', 40, el('identity'), [
    el('purpose'),
    el('content'),
    el('story'),
  ]);
  tall('architecture', 464, el('architecture'), [
    el('capability'),
    el('asset'),
    el('process'),
  ]);
  tall('experience', 888, el('experience'), [
    el('task'),
    el('channel'),
    el('journey'),
  ]);
  out.fLabel = label(
    464,
    80,
    192,
    28,
    seedText(std, EDGY_TEMPLATE_SEED.facetsTitle),
    { fontSize: 18 }
  );
  out.fBar = line(136, 120, 984, 120);
  out.iLabel = label(
    664,
    740,
    192,
    28,
    seedText(std, EDGY_TEMPLATE_SEED.intersectionsTitle),
    { fontSize: 18 }
  );
  out.iBar = line(336, 728, 1184, 728);
  return out;
}

// ── Customer journey ──────────────────────────────────────────────────
function journey(std?: BlockStdScope): SurfaceElementsJSON {
  const step = (i: number, x: number) =>
    enode('activity', x, 132, 224, 116, {
      fill: JOURNEY_PINK,
      text: seedText(std, EDGY_TEMPLATE_SEED.journeyStep, { n: i }),
      textColor: '#ffffff',
      fontSize: 18,
    });
  const ch = (x: number, n: string) =>
    enode('object', x, 392, 184, 96, {
      fill: JOURNEY_PINK,
      text: seedText(std, EDGY_TEMPLATE_SEED.channel, { n }),
      fontSize: 16,
    });
  const tk = (x: number, n: string) =>
    enode('object', x, 540, 168, 92, {
      fill: JOURNEY_PINK,
      text: seedText(std, EDGY_TEMPLATE_SEED.taskN, { n }),
      fontSize: 16,
    });
  const traverses = verbLabel(std, 'traverses');
  const uses = verbLabel(std, 'uses');
  return {
    cust: enode('people', 40, 120, 64, 64, { fill: NODE_FILL }),
    custL: label(20, 192, 104, 24, seedText(std, EDGY_TEMPLATE_SEED.customer), {
      fontSize: 14,
    }),
    // The person and its name travel together, as `createEdgyPeople` writes
    // them. A group is placed AFTER its members: the id middleware remaps
    // `children` against elements it has already seen.
    custG: pair('cust', 'custL'),
    band: {
      type: 'shape',
      shapeType: 'polygon',
      vertices: [
        [0, 0],
        [0.86, 0],
        [1, 0.5],
        [0.86, 1],
        [0, 1],
      ],
      filled: true,
      fillColor: JOURNEY_PINK,
      strokeColor: JOURNEY_PINK,
      strokeWidth: 1,
      shapeStyle: ShapeStyle.General,
      roughness: 0,
      xywh: '[150,108,860,164]',
    },
    bandL: label(170, 116, 120, 24, elementLabel(std, 'journey'), {
      color: '#ffffff',
      fontSize: 16,
      align: TextAlign.Left,
    }),
    s1: step(1, 240),
    s2: step(2, 500),
    s3: step(3, 760),
    rightTask: enode('object', 1060, 132, 168, 92, {
      text: elementLabel(std, 'task'),
      fontSize: 16,
    }),
    c1: ch(258, 'X'),
    c2: ch(518, 'Y'),
    c3: ch(778, 'Z'),
    t1: tk(266, 'A'),
    t2: tk(526, 'B'),
    t3: tk(786, 'C'),
    trav1: label(258, 350, 184, 20, traverses, {
      fontSize: 13,
      color: NOTATION_NEUTRALS.label,
    }),
    trav2: label(518, 350, 184, 20, traverses, {
      fontSize: 13,
      color: NOTATION_NEUTRALS.label,
    }),
    trav3: label(778, 350, 184, 20, traverses, {
      fontSize: 13,
      color: NOTATION_NEUTRALS.label,
    }),
    use1: label(258, 504, 184, 20, uses, {
      fontSize: 13,
      color: NOTATION_NEUTRALS.label,
    }),
    use2: label(518, 504, 184, 20, uses, {
      fontSize: 13,
      color: NOTATION_NEUTRALS.label,
    }),
    use3: label(778, 504, 184, 20, uses, {
      fontSize: 13,
      color: NOTATION_NEUTRALS.label,
    }),
    l1: attach('s1', 'c1'),
    l2: attach('s2', 'c2'),
    l3: attach('s3', 'c3'),
    l4: attach('c1', 't1'),
    l5: attach('c2', 't2'),
    l6: attach('c3', 't3'),
  };
}

// ── Service blueprint (six swimlanes) ─────────────────────────────────
function blueprint(std?: BlockStdScope): SurfaceElementsJSON {
  const lanes = [
    seedText(std, EDGY_TEMPLATE_SEED.laneEvidence),
    seedText(std, EDGY_TEMPLATE_SEED.laneCustomerActions),
    seedText(std, EDGY_TEMPLATE_SEED.laneOnstage),
    seedText(std, EDGY_TEMPLATE_SEED.laneBackstage),
    seedText(std, EDGY_TEMPLATE_SEED.laneSupportProcesses),
    seedText(std, EDGY_TEMPLATE_SEED.laneSupportSystems),
  ];
  const laneFill = [
    '#fdeef2',
    '#fbd5e0',
    '#dff0fb',
    '#d4e9f8',
    '#d4e9f8',
    '#d4e9f8',
  ];
  const out: SurfaceElementsJSON = {};
  lanes.forEach((name, i) => {
    const y = 40 + i * 150;
    out[`lane${i}`] = rect(36, y, 1280, 150, {
      fill: laneFill[i],
      stroke: laneFill[i],
      sw: 0,
    });
    out[`laneL${i}`] = label(52, y + 12, 260, 22, name, {
      fontSize: 15,
      align: TextAlign.Left,
    });
  });
  const chev = (x: number, y: number, fill: string, t: string) =>
    enode('activity', x, y, 200, 60, { fill, text: t, fontSize: 14 });
  const box = (x: number, y: number, fill: string, t: string) =>
    enode('object', x, y, 200, 60, { fill, text: t, fontSize: 14 });
  const P = C.experience[1],
    B = C.architecture[1];
  Object.assign(out, {
    af: rect(280, 64, 220, 70, {
      text: seedText(std, EDGY_TEMPLATE_SEED.admissionForm),
    }),
    cf: rect(1010, 64, 220, 70, {
      text: seedText(std, EDGY_TEMPLATE_SEED.confirmation),
    }),
    sf: chev(280, 214, P, seedText(std, EDGY_TEMPLATE_SEED.sendForm)),
    fs: chev(600, 214, P, seedText(std, EDGY_TEMPLATE_SEED.followStatus)),
    rd: chev(1010, 214, P, seedText(std, EDGY_TEMPLATE_SEED.receiveDecision)),
    fh: chev(280, 364, B, seedText(std, EDGY_TEMPLATE_SEED.formHandling)),
    cs: chev(600, 364, B, seedText(std, EDGY_TEMPLATE_SEED.customerSupport)),
    ct: chev(1010, 364, B, seedText(std, EDGY_TEMPLATE_SEED.contact)),
    csv: chev(280, 514, B, seedText(std, EDGY_TEMPLATE_SEED.customerService)),
    cfu: box(1010, 514, B, seedText(std, EDGY_TEMPLATE_SEED.customerFollowUp)),
    pf: chev(600, 664, B, seedText(std, EDGY_TEMPLATE_SEED.processForm)),
    dec: chev(
      900,
      664,
      B,
      seedText(std, EDGY_TEMPLATE_SEED.decisionAcceptReject)
    ),
    crm: box(280, 814, B, seedText(std, EDGY_TEMPLATE_SEED.crmApplication)),
    cms: box(600, 814, B, seedText(std, EDGY_TEMPLATE_SEED.caseManagement)),
    pay: box(900, 814, B, seedText(std, EDGY_TEMPLATE_SEED.paymentsSystem)),
    a1: attach('af', 'sf', { arrow: true }),
    a2: attach('sf', 'fs', { arrow: true }),
    a3: attach('fs', 'rd', { arrow: true }),
    a4: attach('sf', 'fh', { arrow: true }),
    a5: attach('fh', 'csv', { arrow: true }),
    a6: attach('pf', 'dec', { arrow: true }),
    a7: attach('crm', 'cms', { arrow: true }),
    a8: attach('cms', 'pay', { arrow: true }),
  });
  return out;
}

// ── Organisation chart ────────────────────────────────────────────────
function orgChart(std?: BlockStdScope): SurfaceElementsJSON {
  const cyan = C.organisation[0];
  const u = (x: number, y: number, w: number, t: string) =>
    enode('object', x, y, w, 64, { fill: cyan, text: t, fontSize: 16 });
  const businessUnit = (unit: string) =>
    seedText(std, EDGY_TEMPLATE_SEED.businessUnit, { unit });
  const group = (code: string) =>
    seedText(std, EDGY_TEMPLATE_SEED.group, { code });
  return {
    org: u(420, 40, 180, elementLabel(std, 'organisation')),
    a: u(120, 200, 200, businessUnit('A')),
    b: u(410, 200, 200, businessUnit('B')),
    c: u(700, 200, 200, businessUnit('C')),
    a1: u(60, 360, 170, group('A-1')),
    a2: u(260, 360, 170, group('A-2')),
    c1: u(715, 360, 170, group('C-1')),
    // Attached orthogonal connectors: the router draws the org-chart elbows
    // and the links follow when units are moved around.
    e1: attach('org', 'a', { mode: ConnectorMode.Orthogonal }),
    e2: attach('org', 'b', { mode: ConnectorMode.Orthogonal }),
    e3: attach('org', 'c', { mode: ConnectorMode.Orthogonal }),
    e4: attach('a', 'a1', { mode: ConnectorMode.Orthogonal }),
    e5: attach('a', 'a2', { mode: ConnectorMode.Orthogonal }),
    e6: attach('c', 'c1', { mode: ConnectorMode.Orthogonal }),
  };
}

/**
 * The metamodel itself — the 12 elements and the 24 relations — lives in
 * `../metamodel.ts`, and the template that draws it in `./dynamic.ts`.
 * Re-exported here under the names they have always had: nothing that reads
 * them had to change.
 */
export {
  EDGY_DYNAMIC_NODES,
  EDGY_DYNAMIC_RELATIONS,
  type EdgyElementName,
} from '../metamodel';
export { DYN_SCALE, dynToModel, edgyDynamicTemplate } from './dynamic';

const ATTRS =
  'width="100%" height="100%" viewBox="0 0 135 80" xmlns="http://www.w3.org/2000/svg"';

/**
 * A hand-composed template — what is left once the artefacts are derived.
 *
 * `build` takes the OPTIONAL inserting editor: called with none, at module
 * load, for the English `content`; called again with the real `std` as
 * {@link Template.localize}, so the two builds read the very same layout and
 * differ only in the words a seed resolves to (`docs/adr/0016`).
 */
function tpl(
  name: string,
  preview: string,
  build: (std?: BlockStdScope) => SurfaceElementsJSON,
  nameKey?: string
): Template {
  return {
    name,
    type: 'template',
    preview,
    nameKey,
    content: makeTemplateSnapshot(build(), name),
    localize: std => makeTemplateSnapshot(build(std), name),
  };
}

export const edgyTemplateCategory: TemplateCategory = {
  name: 'EDGY',
  // Reuses the senior button's own key — see `TemplateCategory.nameKey`.
  nameKey: 'com.labre.framework.edgy',
  templates: [
    tpl(
      'Facets overview',
      `<svg ${ATTRS} fill="none"><rect x="6" y="20" width="18" height="46" rx="3" fill="#1ec873"/><rect x="46" y="20" width="18" height="46" rx="3" fill="#2f6ff0"/><rect x="86" y="20" width="18" height="46" rx="3" fill="#f5246e"/><rect x="26" y="30" width="18" height="40" rx="3" fill="#4fd0ea"/><rect x="66" y="30" width="18" height="40" rx="3" fill="#cf8cff"/><rect x="106" y="30" width="18" height="40" rx="3" fill="#eeba51"/></svg>`,
      facetsOverview,
      EDGY_TEMPLATE_NAME_FACETS_OVERVIEW[0]
    ),
    tpl(
      'Customer journey',
      `<svg ${ATTRS} fill="none"><path d="M20 24 H110 L122 40 L110 56 H20 Z" fill="#f3a3c0"/><rect x="26" y="30" width="22" height="20" fill="none" stroke="#fff"/><rect x="54" y="30" width="22" height="20" fill="none" stroke="#fff"/><rect x="82" y="30" width="22" height="20" fill="none" stroke="#fff"/></svg>`,
      journey,
      EDGY_TEMPLATE_NAME_CUSTOMER_JOURNEY[0]
    ),
    tpl(
      'Service blueprint',
      `<svg ${ATTRS} fill="none"><rect x="8" y="14" width="119" height="16" fill="#fbd5e0"/><rect x="8" y="32" width="119" height="34" fill="#d4e9f8"/><rect x="20" y="18" width="22" height="9" fill="#f5246e" opacity="0.5"/><rect x="20" y="40" width="22" height="9" fill="#2f6ff0" opacity="0.4"/><rect x="60" y="40" width="22" height="9" fill="#2f6ff0" opacity="0.4"/></svg>`,
      blueprint,
      EDGY_TEMPLATE_NAME_SERVICE_BLUEPRINT[0]
    ),
    tpl(
      'Organisation chart',
      `<svg ${ATTRS} fill="none"><rect x="52" y="12" width="32" height="14" rx="2" fill="#4fd0ea"/><rect x="14" y="38" width="32" height="14" rx="2" fill="#4fd0ea"/><rect x="52" y="38" width="32" height="14" rx="2" fill="#4fd0ea"/><rect x="90" y="38" width="32" height="14" rx="2" fill="#4fd0ea"/><path d="M68 26 V32 M30 32 H106 M30 32 V38 M68 32 V38 M106 32 V38" stroke="${NODE_STROKE}"/></svg>`,
      orgChart,
      EDGY_TEMPLATE_NAME_ORGANISATION_CHART[0]
    ),
    // Kept: `addFacets`'s own label is "Enterprise Design facets" (the senior
    // sub-menu's wording), and this tile's tooltip has always said the
    // shorter "Facets diagram". `resolveTemplateName` still resolves it
    // through the command's `labelKey`, with THIS literal (not the command's)
    // as the fallback, so the tile keeps its own English wording with no
    // catalogue.
    templateFromCommand(
      byId('edgy.addFacets'),
      `<svg ${ATTRS}><circle cx="55" cy="34" r="18" fill="#00ea4e" opacity="0.9"/><circle cx="80" cy="34" r="18" fill="#034cee" opacity="0.9"/><circle cx="67" cy="54" r="18" fill="#ff0056" opacity="0.9"/></svg>`,
      'Facets diagram'
    ),
    edgyDynamicTemplate,
    // The blank board had no template at all until the palette was derived —
    // the coverage test is what said so.
    //
    // Kept, same reason as `addFacets` above: `addBoard`'s own label spells
    // out "(hover spotlight)", which this tile's tooltip never has.
    templateFromCommand(
      byId('edgy.addBoard'),
      `<svg ${ATTRS} fill="none"><rect x="8" y="9" width="119" height="62" rx="8" fill="${NOTATION_NEUTRALS.cardFill}" stroke="${NOTATION_NEUTRALS.cardBorder}" stroke-width="2"/><path d="M52 30 H84 M53 31 L66 58 M83 31 L70 58" stroke="${NODE_STROKE}" stroke-width="1.4"/><rect x="48" y="26" width="9" height="9" fill="#00ea4e"/><circle cx="84" cy="30" r="4.5" fill="#034cee"/><path d="M61 54 h8 l4 4 -4 4 h-8 z" fill="#ff0056"/></svg>`,
      'EDGY board'
    ),
    templateFromCommand(
      byId('edgy.addPeople'),
      `<svg ${ATTRS} fill="${NODE_STROKE}"><circle cx="67" cy="32" r="9" fill="none" stroke="${NODE_STROKE}" stroke-width="2.4"/><path d="M50 60 a17 17 0 0 1 34 0" fill="none" stroke="${NODE_STROKE}" stroke-width="2.4"/></svg>`
    ),
    templateFromCommand(
      byId('edgy.addOutcome'),
      `<svg ${ATTRS} fill="none"><rect x="20" y="24" width="95" height="34" rx="6" stroke="${NODE_STROKE}" stroke-width="2"/></svg>`
    ),
    templateFromCommand(
      byId('edgy.addObject'),
      `<svg ${ATTRS} fill="none"><rect x="20" y="24" width="95" height="34" stroke="${NODE_STROKE}" stroke-width="2"/></svg>`
    ),
    templateFromCommand(
      byId('edgy.addActivity'),
      `<svg ${ATTRS} fill="none"><path d="M20 24 H98 L116 41 H116 L98 58 H20 Z" stroke="${NODE_STROKE}" stroke-width="2" stroke-linejoin="round"/></svg>`
    ),
  ],
};
