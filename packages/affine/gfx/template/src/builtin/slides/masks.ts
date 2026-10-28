import type {
  ChromeWording,
  TranslationParams,
} from '@labre/affine-shared/services';

import {
  SLIDE_NAME_AGENDA,
  SLIDE_NAME_BENTO,
  SLIDE_NAME_CHART_TEXT,
  SLIDE_NAME_COLLAGE,
  SLIDE_NAME_CONTACT,
  SLIDE_NAME_COVER,
  SLIDE_NAME_COVER_IMAGE,
  SLIDE_NAME_FEATURE_BENTO,
  SLIDE_NAME_FULL_IMAGE,
  SLIDE_NAME_GANTT,
  SLIDE_NAME_IMAGE_CARDS,
  SLIDE_NAME_IMAGE_GRID,
  SLIDE_NAME_KEY_FIGURES,
  SLIDE_NAME_LOGO_WALL,
  SLIDE_NAME_MARKET_SIZE,
  SLIDE_NAME_MATRIX,
  SLIDE_NAME_ORG_CHART,
  SLIDE_NAME_PHONE,
  SLIDE_NAME_PRICING,
  SLIDE_NAME_PROCESS,
  SLIDE_NAME_QUOTE,
  SLIDE_NAME_ROADMAP,
  SLIDE_NAME_SECTION,
  SLIDE_NAME_SIX_POINTS,
  SLIDE_NAME_STATEMENT,
  SLIDE_NAME_TABLET,
  SLIDE_NAME_TEAM,
  SLIDE_NAME_TESTIMONIALS,
  SLIDE_NAME_TEXT_IMAGE,
  SLIDE_NAME_THREE_CHARTS,
  SLIDE_NAME_THREE_COLUMNS,
  SLIDE_NAME_TIMELINE,
  SLIDE_NAME_TWO_COLUMNS,
  SLIDE_NAME_VENN,
  SLIDE_SEED_AGENDA_ITEM,
  SLIDE_SEED_AGENDA_TITLE,
  SLIDE_SEED_AXIS_EFFORT,
  SLIDE_SEED_AXIS_VALUE,
  SLIDE_SEED_BODY,
  SLIDE_SEED_CAPTION,
  SLIDE_SEED_CHART,
  SLIDE_SEED_CONTACT_ADDRESS,
  SLIDE_SEED_CONTACT_EMAIL,
  SLIDE_SEED_CONTACT_PHONE,
  SLIDE_SEED_CONTACT_TITLE,
  SLIDE_SEED_CONTACT_VALUE,
  SLIDE_SEED_COVER_TITLE,
  SLIDE_SEED_DATE,
  SLIDE_SEED_DETAIL,
  SLIDE_SEED_EYEBROW,
  SLIDE_SEED_FEATURE,
  SLIDE_SEED_FIGURE,
  SLIDE_SEED_FIGURE_LABEL,
  SLIDE_SEED_HEADING,
  SLIDE_SEED_LOGO,
  SLIDE_SEED_MARKET_OBTAINABLE,
  SLIDE_SEED_MARKET_SERVICEABLE,
  SLIDE_SEED_MARKET_TOTAL,
  SLIDE_SEED_MILESTONE,
  SLIDE_SEED_MONTH,
  SLIDE_SEED_PERSON_NAME,
  SLIDE_SEED_PERSON_ROLE,
  SLIDE_SEED_PLAN,
  SLIDE_SEED_PRICE,
  SLIDE_SEED_QUADRANT,
  SLIDE_SEED_QUARTER,
  SLIDE_SEED_QUOTE,
  SLIDE_SEED_QUOTE_AUTHOR,
  SLIDE_SEED_SCREEN,
  SLIDE_SEED_SECTION_SUBTITLE,
  SLIDE_SEED_SECTION_TITLE,
  SLIDE_SEED_STATEMENT,
  SLIDE_SEED_STEP,
  SLIDE_SEED_SUBTITLE,
  SLIDE_SEED_TASK,
  SLIDE_SEED_TEAM_TITLE,
  SLIDE_SEED_TESTIMONIALS_TITLE,
  SLIDE_SEED_TITLE,
  SLIDE_SEED_VENN_IDEA,
  SLIDE_SEED_VENN_OTHER,
  SLIDE_SEED_VENN_OVERLAP,
} from '../../translations.js';
import {
  SLIDE_HEIGHT,
  SLIDE_MARGIN,
  SLIDE_WIDTH,
  type SlideTextRole,
} from './consts.js';

/**
 * The slide masks, as DATA: a mask is the list of its zones, and one builder
 * (`build.ts`) projects every mask into a frame, its elements and its preview.
 * Positions are model units inside the 1600 x 900 frame; sizes, weights and
 * colours are never written here, only a text ROLE and a TONE, which
 * `consts.ts` resolves once for the whole set.
 *
 * The families and the reference slides each mask stands for are in
 * `README.md` beside this file.
 */

export type SlideAlign = 'left' | 'center' | 'right';

/** A text box: a seed (or plain digits) set in one role of the type scale. */
export type SlideTextZone = {
  kind: 'text';
  role: SlideTextRole;
  /** The words, through the translation seam at placement (ADR 0023). */
  seed?: ChromeWording;
  params?: TranslationParams;
  /** Digits that are no wording (an agenda's "01"). */
  digits?: string;
  x: number;
  y: number;
  w: number;
  /** How many lines the box is sized for; the text wraps inside `w`. */
  lines?: number;
  align?: SlideAlign;
  tone?: 'ink' | 'muted';
};

/** A fill zone: a dashed placeholder the author replaces with a picture. */
export type SlideImageZone = {
  kind: 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  shape?: 'rect' | 'ellipse';
  /** Its caption, `Image` unless said otherwise (`Logo`). */
  label?: ChromeWording;
};

/** A structural outline: a card, a quadrant, a Venn circle, a step. */
export type SlideCardZone = {
  kind: 'card';
  x: number;
  y: number;
  w: number;
  h: number;
  shape?: 'rect' | 'ellipse';
  /** A word set inside the card itself (a step, a milestone). */
  label?: ChromeWording;
  params?: TranslationParams;
  /** `hairline` for a quiet card, `muted` for a line meant to be seen. */
  stroke?: 'hairline' | 'muted';
  /** A card filled with the hairline grey (a milestone bar). */
  filled?: boolean;
};

/** A straight rule or arrow. */
export type SlideLineZone = {
  kind: 'line';
  from: [number, number];
  to: [number, number];
  arrow?: boolean;
};

/** A filled ink dot (a timeline's milestone). */
export type SlideDotZone = {
  kind: 'dot';
  x: number;
  y: number;
  size: number;
};

export type SlideZone =
  | SlideTextZone
  | SlideImageZone
  | SlideCardZone
  | SlideLineZone
  | SlideDotZone;

export type SlideMask = {
  id: string;
  /** The tile's name, also the inserted frame's title. */
  name: ChromeWording;
  /** Plain English search words besides the name (`Template.keywords`). */
  keywords: string[];
  zones: SlideZone[];
};

/* ── Grid ─────────────────────────────────────────────────────────────── */

const M = SLIDE_MARGIN;
/** The content width between the two margins. */
const CONTENT = SLIDE_WIDTH - 2 * M;
const TITLE_Y = 72;
const GUTTER = 64;

/** `n` equal columns across the content width: their left edges and width. */
function columns(n: number, gap = GUTTER) {
  const w = Math.round((CONTENT - gap * (n - 1)) / n);
  return Array.from({ length: n }, (_, i) => ({
    x: Math.round(M + i * (w + gap)),
    w,
  }));
}

/* ── Zone constructors ────────────────────────────────────────────────── */

type TextOpts = Partial<
  Pick<SlideTextZone, 'lines' | 'align' | 'tone' | 'params'>
>;

function text(
  role: SlideTextRole,
  seed: ChromeWording,
  x: number,
  y: number,
  w: number,
  opts: TextOpts = {}
): SlideTextZone {
  return { kind: 'text', role, seed, x, y, w, ...opts };
}

function digits(value: string, x: number, y: number, w = 80): SlideTextZone {
  return {
    kind: 'text',
    role: 'caption',
    digits: value,
    x,
    y,
    w,
    tone: 'muted',
  };
}

function image(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: Pick<SlideImageZone, 'shape' | 'label'> = {}
): SlideImageZone {
  return { kind: 'image', x, y, w, h, ...opts };
}

function card(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: Omit<SlideCardZone, 'kind' | 'x' | 'y' | 'w' | 'h'> = {}
): SlideCardZone {
  return { kind: 'card', x, y, w, h, ...opts };
}

function line(
  from: [number, number],
  to: [number, number],
  arrow = false
): SlideLineZone {
  return { kind: 'line', from, to, arrow };
}

function dot(cx: number, cy: number, size = 24): SlideDotZone {
  return { kind: 'dot', x: cx - size / 2, y: cy - size / 2, size };
}

/** Every slide's own title, top left (or centred). */
function title(
  seed: ChromeWording = SLIDE_SEED_TITLE,
  opts: { w?: number; align?: SlideAlign } = {}
): SlideTextZone {
  return text('title', seed, M, TITLE_Y, opts.w ?? CONTENT, {
    align: opts.align,
  });
}

const centred = { align: 'center' } as const;
const muted = { tone: 'muted' } as const;

/* ── The masks ────────────────────────────────────────────────────────── */

const cover: SlideMask = {
  id: 'cover',
  name: SLIDE_NAME_COVER,
  keywords: ['cover', 'title', 'opening', 'first slide', 'pitch'],
  zones: [
    text('caption', SLIDE_SEED_EYEBROW, M, 330, CONTENT, {
      ...centred,
      ...muted,
    }),
    text('display', SLIDE_SEED_COVER_TITLE, M, 372, CONTENT, centred),
    text('caption', SLIDE_SEED_DATE, M, 500, CONTENT, { ...centred, ...muted }),
  ],
};

const coverImage: SlideMask = {
  id: 'cover-image',
  name: SLIDE_NAME_COVER_IMAGE,
  keywords: ['cover', 'title', 'tagline', 'picture', 'photo', 'hero'],
  zones: [
    text('display', SLIDE_SEED_COVER_TITLE, M, 330, 620, { lines: 2 }),
    text('body', SLIDE_SEED_SUBTITLE, M, 500, 620, { lines: 2, ...muted }),
    image(SLIDE_WIDTH / 2, 0, SLIDE_WIDTH / 2, SLIDE_HEIGHT),
  ],
};

const section: SlideMask = {
  id: 'section',
  name: SLIDE_NAME_SECTION,
  keywords: ['section', 'divider', 'chapter', 'break', 'part'],
  zones: [
    text('display', SLIDE_SEED_SECTION_TITLE, M, 600, CONTENT),
    text('body', SLIDE_SEED_SECTION_SUBTITLE, M, 690, CONTENT, muted),
  ],
};

const statement: SlideMask = {
  id: 'statement',
  name: SLIDE_NAME_STATEMENT,
  keywords: ['statement', 'big idea', 'headline', 'message', 'claim'],
  zones: [
    text('caption', SLIDE_SEED_SUBTITLE, M, 300, CONTENT, muted),
    text('display', SLIDE_SEED_STATEMENT, M, 340, 1100, { lines: 3 }),
  ],
};

const agenda: SlideMask = {
  id: 'agenda',
  name: SLIDE_NAME_AGENDA,
  keywords: ['agenda', 'contents', 'outline', 'summary', 'plan'],
  zones: [
    title(SLIDE_SEED_AGENDA_TITLE),
    ...[0, 1, 2, 3, 4].flatMap(i => {
      const y = 220 + i * 112;
      return [
        digits(`0${i + 1}`, M, y + 8),
        text('heading', SLIDE_SEED_AGENDA_ITEM, 216, y, CONTENT - 120),
        line([M, y + 72], [M + CONTENT, y + 72]),
      ];
    }),
  ],
};

const textImage: SlideMask = {
  id: 'text-image',
  name: SLIDE_NAME_TEXT_IMAGE,
  keywords: ['text', 'picture', 'photo', 'split', 'describe', 'half'],
  zones: [
    title(SLIDE_SEED_TITLE, { w: 720 }),
    text('heading', SLIDE_SEED_HEADING, M, 240, 720, muted),
    text('body', SLIDE_SEED_BODY, M, 290, 720, { lines: 3 }),
    text('heading', SLIDE_SEED_HEADING, M, 480, 720, muted),
    text('body', SLIDE_SEED_BODY, M, 530, 720, { lines: 3 }),
    image(880, 0, SLIDE_WIDTH - 880, SLIDE_HEIGHT),
  ],
};

const fullImage: SlideMask = {
  id: 'full-image',
  name: SLIDE_NAME_FULL_IMAGE,
  keywords: ['picture', 'photo', 'screenshot', 'visual', 'caption'],
  zones: [
    title(),
    image(M, 160, CONTENT, 600),
    text('caption', SLIDE_SEED_CAPTION, M, 780, CONTENT, {
      ...centred,
      ...muted,
    }),
  ],
};

const twoColumns: SlideMask = {
  id: 'two-columns',
  name: SLIDE_NAME_TWO_COLUMNS,
  keywords: ['columns', 'compare', 'versus', 'before after', 'pros cons'],
  zones: [
    title(),
    ...columns(2).flatMap(({ x, w }) => [
      text('heading', SLIDE_SEED_HEADING, x, 260, w, { lines: 2 }),
      text('body', SLIDE_SEED_BODY, x, 350, w, { lines: 4, ...muted }),
    ]),
  ],
};

const threeColumns: SlideMask = {
  id: 'three-columns',
  name: SLIDE_NAME_THREE_COLUMNS,
  keywords: ['columns', 'three points', 'pillars', 'ideas', 'list'],
  zones: [
    title(),
    ...columns(3).flatMap(({ x, w }, i) => [
      digits(`0${i + 1}`, x, 260),
      text('heading', SLIDE_SEED_HEADING, x, 300, w, { lines: 2 }),
      text('body', SLIDE_SEED_BODY, x, 390, w, { lines: 4, ...muted }),
    ]),
  ],
};

const sixPoints: SlideMask = {
  id: 'six-points',
  name: SLIDE_NAME_SIX_POINTS,
  keywords: ['grid', 'points', 'features', 'benefits', 'list'],
  zones: [
    title(),
    ...[240, 530].flatMap(y =>
      columns(3).flatMap(({ x, w }) => [
        text('heading', SLIDE_SEED_HEADING, x, y, w, { lines: 2 }),
        text('body', SLIDE_SEED_DETAIL, x, y + 90, w, { lines: 2, ...muted }),
      ])
    ),
  ],
};

const imageCards: SlideMask = {
  id: 'image-cards',
  name: SLIDE_NAME_IMAGE_CARDS,
  keywords: ['cards', 'pictures', 'gallery', 'products', 'features'],
  zones: [
    title(),
    ...columns(3).flatMap(({ x, w }) => [
      image(x, 200, w, 300),
      text('heading', SLIDE_SEED_HEADING, x, 528, w, { lines: 2 }),
      text('body', SLIDE_SEED_DETAIL, x, 616, w, { lines: 2, ...muted }),
    ]),
  ],
};

const keyFigures: SlideMask = {
  id: 'key-figures',
  name: SLIDE_NAME_KEY_FIGURES,
  keywords: ['metrics', 'kpi', 'numbers', 'statistics', 'data', 'results'],
  zones: [
    title(),
    ...columns(3).flatMap(({ x, w }) => [
      text('figure', SLIDE_SEED_FIGURE, x, 300, w),
      text('heading', SLIDE_SEED_FIGURE_LABEL, x, 450, w, { lines: 2 }),
      text('body', SLIDE_SEED_DETAIL, x, 540, w, { lines: 2, ...muted }),
    ]),
  ],
};

const timeline: SlideMask = {
  id: 'timeline',
  name: SLIDE_NAME_TIMELINE,
  keywords: ['timeline', 'milestones', 'history', 'schedule', 'dates'],
  zones: [
    title(),
    line([M, 470], [M + CONTENT, 470]),
    ...[0, 1, 2, 3].flatMap(i => {
      const cx = Math.round(M + (CONTENT * (i + 0.5)) / 4);
      const x = cx - 150;
      return [
        dot(cx, 470),
        text('caption', SLIDE_SEED_QUARTER, x, 410, 300, {
          ...centred,
          ...muted,
          params: { n: i + 1 },
        }),
        text('heading', SLIDE_SEED_MILESTONE, x, 510, 300, centred),
        text('body', SLIDE_SEED_DETAIL, x, 560, 300, { ...centred, ...muted }),
      ];
    }),
  ],
};

const roadmap: SlideMask = {
  id: 'roadmap',
  name: SLIDE_NAME_ROADMAP,
  keywords: ['roadmap', 'plan', 'quarters', 'gantt', 'milestones'],
  zones: [
    title(),
    ...columns(4, 0).flatMap(({ x, w }, i) => [
      text('heading', SLIDE_SEED_QUARTER, x + 24, 220, w - 48, {
        params: { n: i + 1 },
      }),
      ...(i > 0 ? [line([x, 210], [x, 800])] : []),
      card(x + 24, 290 + i * 100, w - 48, 64, {
        label: SLIDE_SEED_MILESTONE,
        filled: true,
      }),
      card(x + 24, 380 + i * 100, w - 48, 64, {
        label: SLIDE_SEED_MILESTONE,
        filled: true,
      }),
    ]),
  ],
};

const process: SlideMask = {
  id: 'process',
  name: SLIDE_NAME_PROCESS,
  keywords: ['process', 'steps', 'flow', 'workflow', 'how it works'],
  zones: [
    title(),
    ...columns(5, 57).flatMap(({ x, w }, i, all) => [
      card(x, 340, w, 140, {
        label: SLIDE_SEED_STEP,
        params: { n: i + 1 },
        stroke: 'muted',
      }),
      text('body', SLIDE_SEED_DETAIL, x, 510, w, {
        lines: 2,
        ...centred,
        ...muted,
      }),
      ...(i < all.length - 1
        ? [line([x + w + 8, 410], [all[i + 1]!.x - 8, 410], true)]
        : []),
    ]),
  ],
};

const matrix: SlideMask = {
  id: 'matrix',
  name: SLIDE_NAME_MATRIX,
  keywords: [
    'matrix',
    'quadrant',
    '2x2',
    'prioritisation',
    'prioritization',
    'value effort',
  ],
  zones: [
    title(),
    line([260, 780], [260, 210], true),
    line([260, 780], [M + CONTENT, 780], true),
    text('caption', SLIDE_SEED_AXIS_VALUE, M, 220, 140, muted),
    text('caption', SLIDE_SEED_AXIS_EFFORT, M + CONTENT - 200, 792, 200, {
      align: 'right',
      ...muted,
    }),
    ...[220, 490].flatMap(y =>
      [300, 910].flatMap(x => [
        card(x, y, 590, 250),
        text('heading', SLIDE_SEED_QUADRANT, x + 32, y + 28, 526),
        text('body', SLIDE_SEED_DETAIL, x + 32, y + 78, 526, muted),
      ])
    ),
  ],
};

const venn: SlideMask = {
  id: 'venn',
  name: SLIDE_NAME_VENN,
  keywords: ['venn', 'overlap', 'intersection', 'circles', 'sweet spot'],
  zones: [
    title(),
    card(400, 200, 520, 520, { shape: 'ellipse', stroke: 'muted' }),
    card(680, 200, 520, 520, { shape: 'ellipse', stroke: 'muted' }),
    text('heading', SLIDE_SEED_VENN_IDEA, 430, 440, 240, centred),
    text('heading', SLIDE_SEED_VENN_OTHER, 930, 440, 240, centred),
    text('caption', SLIDE_SEED_VENN_OVERLAP, 690, 448, 220, {
      lines: 2,
      ...centred,
      ...muted,
    }),
  ],
};

const marketSize: SlideMask = {
  id: 'market-size',
  name: SLIDE_NAME_MARKET_SIZE,
  keywords: ['market', 'tam sam som', 'opportunity', 'sizing', 'circles'],
  zones: [
    title(),
    ...[
      SLIDE_SEED_MARKET_TOTAL,
      SLIDE_SEED_MARKET_SERVICEABLE,
      SLIDE_SEED_MARKET_OBTAINABLE,
    ].flatMap((seed, i) => [
      text('heading', seed, M, 250 + i * 170, 560),
      text('body', SLIDE_SEED_DETAIL, M, 300 + i * 170, 560, muted),
    ]),
    card(860, 200, 600, 600, { shape: 'ellipse', stroke: 'muted' }),
    card(960, 400, 400, 400, { shape: 'ellipse', stroke: 'muted' }),
    card(1060, 600, 200, 200, { shape: 'ellipse', stroke: 'muted' }),
    text('heading', SLIDE_SEED_FIGURE, 860, 250, 600, centred),
    text('heading', SLIDE_SEED_FIGURE, 960, 450, 400, centred),
    text('heading', SLIDE_SEED_FIGURE, 1060, 680, 200, centred),
  ],
};

/** One org-chart box: an outline, a name and a role. */
function person(x: number, y: number): SlideZone[] {
  return [
    card(x, y, 300, 120),
    text('heading', SLIDE_SEED_PERSON_NAME, x, y + 22, 300, centred),
    text('caption', SLIDE_SEED_PERSON_ROLE, x, y + 70, 300, {
      ...centred,
      ...muted,
    }),
  ];
}

const orgChart: SlideMask = {
  id: 'org-chart',
  name: SLIDE_NAME_ORG_CHART,
  keywords: [
    'organisation',
    'organization',
    'hierarchy',
    'reporting',
    'structure',
  ],
  zones: [
    title(),
    ...person(650, 220),
    line([800, 340], [800, 410]),
    line([320, 410], [1280, 410]),
    ...[170, 650, 1130].flatMap(x => [
      line([x + 150, 410], [x + 150, 480]),
      ...person(x, 480),
    ]),
  ],
};

const pricing: SlideMask = {
  id: 'pricing',
  name: SLIDE_NAME_PRICING,
  keywords: ['pricing', 'plans', 'tiers', 'offer', 'packages'],
  zones: [
    title(SLIDE_SEED_TITLE, centred),
    ...columns(3).flatMap(({ x, w }) => [
      card(x, 200, w, 600),
      text('heading', SLIDE_SEED_PLAN, x + 40, 240, w - 80, muted),
      text('title', SLIDE_SEED_PRICE, x + 40, 290, w - 80),
      line([x + 40, 380], [x + w - 40, 380]),
      ...[0, 1, 2].map(i =>
        text('body', SLIDE_SEED_FEATURE, x + 40, 410 + i * 60, w - 80)
      ),
    ]),
  ],
};

const logoWall: SlideMask = {
  id: 'logo-wall',
  name: SLIDE_NAME_LOGO_WALL,
  keywords: ['logos', 'clients', 'partners', 'customers', 'trusted by'],
  zones: [
    title(SLIDE_SEED_TITLE, centred),
    ...[300, 480].flatMap(y =>
      columns(5, 52).map(({ x, w }) =>
        image(x, y, w, 120, { label: SLIDE_SEED_LOGO })
      )
    ),
  ],
};

const quote: SlideMask = {
  id: 'quote',
  name: SLIDE_NAME_QUOTE,
  keywords: ['quote', 'citation', 'testimonial', 'voice', 'customer'],
  zones: [
    text('title', SLIDE_SEED_QUOTE, 200, 300, 1200, { lines: 3, ...centred }),
    text('body', SLIDE_SEED_QUOTE_AUTHOR, 200, 520, 1200, {
      ...centred,
      ...muted,
    }),
  ],
};

const testimonials: SlideMask = {
  id: 'testimonials',
  name: SLIDE_NAME_TESTIMONIALS,
  keywords: ['testimonials', 'quotes', 'reviews', 'customers', 'clients'],
  zones: [
    title(SLIDE_SEED_TESTIMONIALS_TITLE, centred),
    ...columns(3).flatMap(({ x, w }) => [
      image(x + (w - 120) / 2, 210, 120, 120, { shape: 'ellipse' }),
      text('body', SLIDE_SEED_QUOTE, x, 370, w, { lines: 4, ...centred }),
      text('caption', SLIDE_SEED_QUOTE_AUTHOR, x, 520, w, {
        ...centred,
        ...muted,
      }),
    ]),
  ],
};

const team: SlideMask = {
  id: 'team',
  name: SLIDE_NAME_TEAM,
  keywords: ['team', 'people', 'staff', 'leadership', 'about us'],
  zones: [
    title(SLIDE_SEED_TEAM_TITLE, centred),
    ...columns(4).flatMap(({ x, w }) => [
      image(x + (w - 200) / 2, 230, 200, 200, { shape: 'ellipse' }),
      text('heading', SLIDE_SEED_PERSON_NAME, x, 460, w, centred),
      text('body', SLIDE_SEED_PERSON_ROLE, x, 505, w, { ...centred, ...muted }),
    ]),
  ],
};

const contact: SlideMask = {
  id: 'contact',
  name: SLIDE_NAME_CONTACT,
  keywords: ['contact', 'address', 'email', 'phone', 'closing', 'thank you'],
  zones: [
    image(0, 0, 640, SLIDE_HEIGHT),
    text('title', SLIDE_SEED_CONTACT_TITLE, 736, TITLE_Y, 768),
    ...[
      SLIDE_SEED_CONTACT_ADDRESS,
      SLIDE_SEED_CONTACT_PHONE,
      SLIDE_SEED_CONTACT_EMAIL,
    ].flatMap((label, i) => [
      text('caption', label, 736, 280 + i * 150, 768, muted),
      text('body', SLIDE_SEED_CONTACT_VALUE, 736, 312 + i * 150, 768),
    ]),
  ],
};

/* ── Placeholder families ─────────────────────────────────────────────── */

/**
 * The families the first set deferred (README, "Deferred") for want of a
 * chart, a photo or a device frame: built with the same dashed grey zone a
 * picture gets, labelled for what the author drops in. A chart or a device
 * frame is artwork the author brings; the mask only keeps its place.
 */

/** A chart placeholder: a fill zone labelled "Chart". */
function chart(x: number, y: number, w: number, h: number): SlideImageZone {
  return image(x, y, w, h, { label: SLIDE_SEED_CHART });
}

/** A device frame: a quiet outline around a screen zone. */
function device(
  x: number,
  y: number,
  w: number,
  h: number,
  bezel: number
): SlideZone[] {
  return [
    card(x, y, w, h, { stroke: 'muted' }),
    image(x + bezel, y + bezel, w - 2 * bezel, h - 2 * bezel, {
      label: SLIDE_SEED_SCREEN,
    }),
  ];
}

/** Gantt bars in column units: [start, length], staggered like a plan. */
const GANTT_BARS: [number, number][] = [
  [0, 1.2],
  [0.55, 1.9],
  [1.95, 1.8],
  [1.95, 1.8],
  [3, 3],
  [3.8, 2.2],
  [4.4, 1.6],
  [5, 1],
];

const gantt: SlideMask = {
  id: 'gantt',
  name: SLIDE_NAME_GANTT,
  keywords: ['gantt', 'plan', 'schedule', 'tasks', 'months', 'timeline'],
  zones: [
    title(),
    ...columns(6, 0).flatMap(({ x, w }, i) => [
      ...(i > 0 ? [line([x, 190], [x, 800])] : []),
      text('caption', SLIDE_SEED_MONTH, x, 760, w, {
        ...centred,
        ...muted,
        params: { n: i + 1 },
      }),
    ]),
    ...GANTT_BARS.map(([start, length], r) =>
      card(
        Math.round(M + (start * CONTENT) / 6),
        200 + r * 68,
        Math.round((length * CONTENT) / 6),
        56,
        { label: SLIDE_SEED_TASK, filled: true }
      )
    ),
  ],
};

const chartText: SlideMask = {
  id: 'chart-text',
  name: SLIDE_NAME_CHART_TEXT,
  keywords: ['chart', 'graph', 'data', 'figures', 'explain', 'bar', 'line'],
  zones: [
    title(SLIDE_SEED_TITLE, { w: 760 }),
    text('body', SLIDE_SEED_BODY, M, 680, 700, { lines: 3, ...muted }),
    chart(880, 200, 624, 560),
  ],
};

const threeCharts: SlideMask = {
  id: 'three-charts',
  name: SLIDE_NAME_THREE_CHARTS,
  keywords: ['charts', 'graphs', 'pie', 'donut', 'compare', 'data'],
  zones: [
    title(SLIDE_SEED_TITLE, centred),
    ...columns(3).flatMap(({ x, w }) => [
      chart(x, 220, w, 380),
      text('body', SLIDE_SEED_DETAIL, x, 640, w, {
        lines: 3,
        ...centred,
        ...muted,
      }),
    ]),
  ],
};

const collage: SlideMask = {
  id: 'collage',
  name: SLIDE_NAME_COLLAGE,
  keywords: ['collage', 'photos', 'pictures', 'gallery', 'text', 'mosaic'],
  zones: [
    title(SLIDE_SEED_TITLE, { w: 560 }),
    text('body', SLIDE_SEED_BODY, M, 640, 560, { lines: 4, ...muted }),
    image(700, 80, 440, 740),
    image(1190, 80, 314, 350),
    image(1190, 470, 314, 350),
  ],
};

const bento: SlideMask = {
  id: 'bento',
  name: SLIDE_NAME_BENTO,
  keywords: ['bento', 'photos', 'pictures', 'collage', 'mosaic', 'gallery'],
  zones: [
    image(M, 80, 940, 350),
    image(1076, 80, 428, 350),
    image(M, 470, 428, 350),
    image(564, 470, 940, 350),
  ],
};

const imageGrid: SlideMask = {
  id: 'image-grid',
  name: SLIDE_NAME_IMAGE_GRID,
  keywords: ['grid', 'photos', 'pictures', 'gallery', 'six', 'mosaic'],
  zones: [80, 470].flatMap(y =>
    columns(3, 40).map(({ x, w }) => image(x, y, w, 350))
  ),
};

/** A key-figure card: the number, then what it measures. */
function figureCard(x: number, y: number, w: number, h: number): SlideZone[] {
  return [
    card(x, y, w, h),
    text('figure', SLIDE_SEED_FIGURE, x + 40, y + 30, 320),
    text('body', SLIDE_SEED_FIGURE_LABEL, x + 400, y + 72, w - 440, {
      lines: 2,
      ...muted,
    }),
  ];
}

/** A feature card: a heading, a line of body and a picture. */
function featureCard(x: number, y: number, w: number, h: number): SlideZone[] {
  return [
    card(x, y, w, h),
    text('heading', SLIDE_SEED_HEADING, x + 40, y + 40, w - 80, { lines: 2 }),
    text('body', SLIDE_SEED_DETAIL, x + 40, y + 140, w - 80, {
      lines: 2,
      ...muted,
    }),
    image(x + 40, y + 220, w - 80, h - 260),
  ];
}

const featureBento: SlideMask = {
  id: 'feature-bento',
  name: SLIDE_NAME_FEATURE_BENTO,
  keywords: ['bento', 'features', 'metrics', 'kpi', 'product', 'highlights'],
  zones: [
    ...featureCard(M, 80, 520, 500),
    ...figureCard(660, 80, 844, 190),
    image(660, 310, 300, 270),
    ...featureCard(1000, 310, 504, 510),
    ...figureCard(M, 620, 864, 200),
  ],
};

const phone: SlideMask = {
  id: 'phone',
  name: SLIDE_NAME_PHONE,
  keywords: ['phone', 'mobile', 'mockup', 'app', 'device', 'screen'],
  zones: [
    title(SLIDE_SEED_TITLE, { w: 760 }),
    text('body', SLIDE_SEED_BODY, M, 700, 760, { lines: 2, ...muted }),
    ...device(1040, 60, 400, 780, 24),
  ],
};

const tablet: SlideMask = {
  id: 'tablet',
  name: SLIDE_NAME_TABLET,
  keywords: ['tablet', 'mockup', 'app', 'device', 'screen', 'laptop'],
  zones: [
    title(SLIDE_SEED_TITLE, { w: 700 }),
    text('body', SLIDE_SEED_BODY, M, 680, 700, { lines: 3, ...muted }),
    ...device(900, 90, 700, 720, 36),
  ],
};

/** Every mask, in the panel's order: a deck reads top to bottom. */
export const SLIDE_MASKS: readonly SlideMask[] = [
  cover,
  coverImage,
  section,
  statement,
  agenda,
  textImage,
  fullImage,
  twoColumns,
  threeColumns,
  sixPoints,
  imageCards,
  collage,
  bento,
  imageGrid,
  featureBento,
  phone,
  tablet,
  keyFigures,
  chartText,
  threeCharts,
  timeline,
  roadmap,
  gantt,
  process,
  matrix,
  venn,
  marketSize,
  orgChart,
  pricing,
  logoWall,
  quote,
  testimonials,
  team,
  contact,
];
