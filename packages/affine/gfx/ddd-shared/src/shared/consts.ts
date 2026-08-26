/**
 * Shared DDD palette and sizes. Every tool composes the same irreducible units
 * (sticky, dot, bubble, connector, label) from these presets — no duplicated
 * component definitions across the Event Storming / Context Map / Core Domain
 * sub-menus.
 */

/** Square sticky side (px, canvas reference). */
export const STICKY_SIZE = 120;
/** Faux drop-shadow offset + colour (a plain offset rect behind the sticky). */
export const SHADOW_OFFSET = 7;
export const SHADOW_COLOR = '#0000002e';
/** Handwriting marker font, already shipped in the canvas font set. */
export const STICKY_FONT = 'blocksuite:surface:Kalam';
export const STICKY_FONT_SIZE = 20;
export const STICKY_RADIUS = 6;

/**
 * Event Storming sticky palette — DDD Crew / Brandolini colour code.
 *
 * ## The aggregate (WS5)
 *
 * Brandolini's notation has a pale-yellow sticky for the AGGREGATE — the thing a
 * command lands on and the thing that raises the event — and without it the
 * canonical sentence `Command → Aggregate → Domain event` cannot be drawn at
 * all, let alone checked. It was missing here until WS5.
 *
 * Its colour is the one judgement call in this table. The plan's indicative
 * `#FDF0A0` measures **ΔE 3.5** from the actor's `#FFF1A8` — two stickies
 * nobody could tell apart on a wall, which is exactly the failure the notation
 * already has and the tool should not inherit. `#FAF2C9` is the same pale
 * yellow taken two steps towards cream: ΔE 16.3 from the actor, 50.2 from the
 * constraint, and still 21.7 from the white board it sits on, so it reads as
 * "pale" rather than as "blank". The three yellows are then a LADDER — the
 * constraint saturated, the actor light, the aggregate palest — which is how a
 * reader tells them apart at a glance without a legend.
 *
 * Size carries the rest of the distinction, as it does on a real wall: the
 * aggregate is created at 160 against the standard 120 (see
 * `ddd-event-storming/src/commands.ts`). The palette says which; the format
 * says how big.
 */
export const ES_STICKIES = [
  { kind: 'domainEvent', label: 'Domain event', fill: '#F5963B', text: '#5a3000' },
  { kind: 'command', label: 'Command', fill: '#5BA3DB', text: '#06304d' },
  // Placed after the command, in the order the grammar reads: an actor issues a
  // command, a command lands on an aggregate, an aggregate raises an event.
  { kind: 'aggregate', label: 'Aggregate', fill: '#FAF2C9', text: '#5a4b00' },
  { kind: 'actor', label: 'Actor', fill: '#FFF1A8', text: '#5a4b00' },
  { kind: 'constraint', label: 'Constraint', fill: '#FFD84D', text: '#5a4b00' },
  { kind: 'policy', label: 'Policy', fill: '#C9A8E0', text: '#3d1f57' },
  { kind: 'readModel', label: 'Read model', fill: '#7ED38A', text: '#14502a' },
  { kind: 'system', label: 'External system', fill: '#F6A6C0', text: '#5e1230' },
] as const;

/** Hotspot — neon-pink diamond. */
export const ES_HOTSPOT = { label: 'Hotspot', fill: '#FF1E8E', text: '#ffffff' };

/** Context Map bounded-context bubble. */
export const CM_BUBBLE = {
  fill: '#e6f0fa',
  stroke: '#2f6fb0',
  text: '#06304d',
  w: 150,
  h: 70,
  radius: 30,
};

/**
 * Context Map relationship presets (DDD Crew notation). Each is the SAME
 * connector unit + an abbreviation tag; `upDown` adds U/D markers (upstream →
 * downstream); `dashed` marks the "no real integration" patterns (Separate
 * Ways, Big Ball of Mud).
 */
export const CM_RELATIONSHIPS = [
  { kind: 'partnership', label: 'Partnership', abbrev: 'PS', upDown: false, dashed: false },
  { kind: 'sharedKernel', label: 'Shared Kernel', abbrev: 'SK', upDown: false, dashed: false },
  { kind: 'customerSupplier', label: 'Customer / Supplier', abbrev: 'C/S', upDown: true, dashed: false },
  { kind: 'conformist', label: 'Conformist', abbrev: 'CF', upDown: true, dashed: false },
  { kind: 'acl', label: 'Anticorruption Layer', abbrev: 'ACL', upDown: true, dashed: false },
  { kind: 'ohs', label: 'Open Host Service', abbrev: 'OHS', upDown: true, dashed: false },
  { kind: 'publishedLanguage', label: 'Published Language', abbrev: 'PL', upDown: true, dashed: false },
  { kind: 'separateWays', label: 'Separate Ways', abbrev: 'SW', upDown: false, dashed: true },
  { kind: 'bbom', label: 'Big Ball of Mud', abbrev: 'BBoM', upDown: false, dashed: true },
] as const;

/**
 * Context Map cloud (Big Ball of Mud / general-purpose boundary). The canvas
 * polygon renderer draws straight segments (it ignores `smoothFlags`), so the
 * cloud is a DENSE lumpy closed outline — enough points that the lineTo edges
 * read as smooth curves. Normalized [0-1] coordinates relative to the bound.
 */
function buildCloud(): number[][] {
  const N = 56;
  const clamp = (v: number) => Math.min(0.98, Math.max(0.02, v));
  const pts: number[][] = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const r = 0.4 + 0.05 * Math.sin(6 * t) + 0.03 * Math.sin(3 * t + 0.8);
    pts.push([clamp(0.5 + r * Math.cos(t)), clamp(0.5 + r * 0.6 * Math.sin(t))]);
  }
  return pts;
}
export const CLOUD_VERTICES: number[][] = buildCloud();
export const CLOUD = { w: 180, h: 120, fill: '#f0eef6', stroke: '#6d6e71' };

/** Team Topologies interaction modes (placeable markers + Notation legend). */
export const TEAM_TOPOLOGIES = [
  { kind: 'collaboration', label: 'Collaboration', letter: 'C', fill: '#99ff99' },
  { kind: 'xaas', label: 'X-as-a-Service', letter: 'X', fill: '#66b2ff' },
  { kind: 'facilitating', label: 'Facilitating', letter: 'F', fill: '#ffd84d' },
] as const;
export const MARKER_SIZE = 30;

/** Core Domain sub-domain / bounded-context dot presets (colours from template). */
export const CD_SUBDOMAINS = [
  { kind: 'bigBet', label: 'Big-bet sub-domain', fill: '#9933ff' },
  { kind: 'platform', label: 'Platform sub-domain', fill: '#66b2ff' },
  { kind: 'outsourced', label: 'Outsourced / purchased', fill: '#99ff99' },
  { kind: 'bcCurrent', label: 'Bounded context', fill: '#ff3333' },
  { kind: 'bcFuture', label: 'Future position', fill: '#cccccc' },
] as const;

export const DOT_SIZE = 26;
export const MOVEMENT_COLOR = '#ff3333';
export const LABEL_COLOR = '#1f2328';
export const LABEL_FONT = 'blocksuite:surface:Inter';
export const LABEL_FONT_SIZE = 14;
