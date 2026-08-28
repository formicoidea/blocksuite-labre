import {
  type C4NodeKind,
  ConnectorMode,
  PointStyle,
  StrokeStyle,
} from '@labre/affine-model';
import { autoLegendSections } from '@labre/affine-gfx-ddd-shared';
import { groupCommandsByCategory } from '@labre/affine-widget-edgeless-toolbar';
import {
  type BlockStdScope,
  type CommandDescriptor,
  SENIOR_MENU_CAP,
  SENIOR_MENU_RANKED_SLOTS,
  selectSeniorMenuCommands,
} from '@labre/std';
import { GfxControllerIdentifier, roleIsA } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { c4CommandIcons, c4Commands } from '../commands';
import {
  BOUNDARY_LABEL,
  NODE_LABEL,
  NODE_PALETTE,
  NODE_SIZE,
  PERSON_BODY_TOP,
  RELATIONSHIP_STROKE,
  RELATIONSHIP_WIDTH,
} from '../consts';
import { C4_AUTO_LEGEND } from '../legend';
import { C4_ROLE, C4_ROLE_OF_KIND, C4_ROLES } from '../roles';
import { c4BoardToolbarConfig, c4LegendToolbarConfig } from '../toolbar/config';

/** Every kind the model declares, read off a table that is total over it. */
const ALL_KINDS = Object.keys(NODE_SIZE) as C4NodeKind[];

/**
 * Run a creation command against a stub editor and report every element it
 * asked the surface for, in the order it asked.
 *
 * Through `run`, never through the action: what a user reaches is the COMMAND,
 * and a spec that called the function directly would keep passing after someone
 * rewired a descriptor to the wrong one.
 *
 * A LIST rather than one element since the PO's recette of 28/08/2026: a node
 * command now builds a whole component — the shape, its type line, its
 * description and the group joining them. What this file is about is the
 * ARTEFACT, so {@link created} keeps returning the first; the component's own
 * shape is `component.unit.spec.ts`'s subject.
 */
function createdAll(command: CommandDescriptor): Record<string, unknown>[] {
  const added: Record<string, unknown>[] = [];
  const gfx = {
    surface: {
      addElement: (next: Record<string, unknown>) => {
        added.push(next);
        return `element-${added.length}`;
      },
    },
    viewport: { centerX: 0, centerY: 0 },
    layer: { generateIndex: () => 'a0' },
    doc: { captureSync: () => {} },
    tool: { setTool: () => {} },
    selection: { set: () => {} },
  };
  const std = {
    get: () => gfx,
  } as unknown as BlockStdScope;

  command.run(std, { surface: 'senior-menu', source: 'toolbar:general' });
  return added;
}

/** The artefact a creation command drops — the first thing it adds. */
function created(command: CommandDescriptor): Record<string, unknown> {
  return createdAll(command)[0] ?? {};
}

/** The same, for the one command that arms a tool instead of dropping a shape. */
function armed(command: CommandDescriptor) {
  let props: Record<string, unknown> = {};
  let tool: Record<string, unknown> = {};

  const editProps = {
    recordLastProps: (key: string, next: Record<string, unknown>) => {
      expect(key).toBe('connector');
      props = next;
    },
  };
  const gfx = {
    tool: {
      setTool: (_tool: unknown, options: Record<string, unknown>) => {
        tool = options;
      },
    },
  };
  const std = {
    get: (identifier: unknown) =>
      identifier === GfxControllerIdentifier ? gfx : editProps,
  } as unknown as BlockStdScope;

  command.run(std, { surface: 'senior-menu', source: 'toolbar:general' });
  return { props, tool };
}

describe('the c4 command inventory', () => {
  const toolbox = c4Commands.filter(c => c.surfaces.includes('senior-menu'));

  it('declares fourteen commands, every one of them in the catalogue', () => {
    // Thirteen toolbox entries — nine elements, two boundaries, the board and
    // the relationship — plus `c4.exportMermaid`, whose subject is a SELECTED
    // board rather than an artefact to draw.
    //
    // The board's automatic legend is deliberately NOT a command (PO
    // arbitration, 27/08/2026): it is a button on the selected board's row and
    // is reachable from nowhere else. See `toolbar/config.ts`.
    expect(c4Commands).toHaveLength(14);
    expect(new Set(c4Commands.map(c => c.id)).size).toBe(14);
    for (const command of c4Commands) {
      expect(command.owner, command.id).toBe('c4');
      expect(command.scope, command.id).toBe('edgeless');
      expect(command.surfaces, command.id).toContain('catalogue');
      expect(command.surfaces, command.id).toContain('agent');
      expect(command.iconKey, command.id).toBeTruthy();
      expect(command.telemetry?.framework, command.id).toBe('c4');
      // Keyless by intent — still bindable from Settings › Shortcuts.
      expect(command.defaultKeys.mac, command.id).toEqual([]);
      expect(command.defaultKeys.other, command.id).toEqual([]);
    }
  });

  it('gives every command glyph a home, and every glyph a command', () => {
    // A key a descriptor names and the icon record does not hold renders as
    // nothing; a glyph no descriptor names is a drawing nobody can reach.
    expect(Object.keys(c4CommandIcons).sort()).toEqual(
      c4Commands.map(c => c.iconKey!).sort()
    );
  });

  it('creates one command per node kind, telemetry named after it', () => {
    const drawn = c4Commands
      .map(c => c.telemetry?.element)
      .filter((element): element is string => !!element?.startsWith('node:'))
      .map(element => element.slice('node:'.length));
    // The whole model and nothing outside it: a kind with no command is a kind
    // nobody can draw, and a command naming a kind the model dropped would
    // create an element the renderer cannot paint.
    expect(drawn.sort()).toEqual([...ALL_KINDS].sort());
  });

  it('puts all thirteen artefacts on the senior row, in author order', () => {
    // C4 is the last framework that FITS: fourteen catalogue entries against a
    // cap of fourteen, so nothing is arbitrated and the sub-menu is this list
    // exactly. Thirteen of the fourteen are senior slots — every command that
    // DRAWS something — and the fourteenth is the export, which draws nothing.
    // The house order for a framework that fits (PO, 28/08/2026): boards, then
    // base components with each external variant against its plain form, then
    // the niche ones, then what joins them and what frames them.
    expect(toolbox.map(c => c.id)).toEqual([
      'c4.addBoard',
      'c4.addPerson',
      'c4.addPersonExt',
      'c4.addSystem',
      'c4.addSystemExt',
      'c4.addContainer',
      'c4.addComponent',
      'c4.addDatabase',
      'c4.addMobile',
      'c4.addBrowser',
      'c4.relationshipTool',
      'c4.addSystemBoundary',
      'c4.addContainerBoundary',
    ]);
    expect(toolbox).toHaveLength(13);
    // The export is the one command that is not a senior slot.
    expect(toolbox).toHaveLength(c4Commands.length - 1);
    expect(toolbox.length).toBeLessThanOrEqual(SENIOR_MENU_CAP);
  });

  /** What the panel actually renders: the registry, grouped the panel's way. */
  const catalogueGroups = () =>
    groupCommandsByCategory(
      [...c4Commands].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    );

  it('groups the catalogue into four sections, in first-encounter order', () => {
    const groups = catalogueGroups();
    // Boards first, so `diagrams` is the section the panel opens with.
    expect(groups.map(group => group.category)).toEqual([
      'diagrams',
      'elements',
      'relations',
      'boundaries',
    ]);
    // One group per category, no trailing uncategorised group, and every
    // command in exactly one of them.
    expect(new Set(groups.map(g => g.category)).size).toBe(groups.length);
    expect(groups.every(group => group.category !== null)).toBe(true);
    expect(groups.reduce((n, group) => n + group.commands.length, 0)).toBe(
      c4Commands.length
    );
    // The export is filed with the board that offers it, after it. The legend
    // that used to sit between them is not a command at all any more.
    expect(
      groups
        .find(group => group.category === 'diagrams')!
        .commands.map(c => c.id)
    ).toEqual(['c4.addBoard', 'c4.exportMermaid']);
  });

  /**
   * The COLD START that is not one YET, and the reason the order above is what
   * it is.
   *
   * The cap is measured on the CATALOGUE and not on the sub-menu
   * (`selectSeniorMenuCommands` tests `catalogue.length`), and the catalogue is
   * now exactly fourteen: the thirteen artefacts plus `c4.exportMermaid`, which
   * declines the sub-menu. Fourteen against a cap of fourteen is still no
   * overflow — the ranking arbitrates nothing and hands back the whole menu — so
   * C4 remains the framework that FITS, with the export having spent the last
   * slot.
   *
   * A FIFTEENTH entry of any kind tips it over: a deployment node, a
   * code-level element, a second export. The ranking then kicks in and a user
   * with no history meets the first `SENIOR_MENU_RANKED_SLOTS` of the catalogue.
   * BPMN learned that in a live recette (#144); the second half of this test is
   * what applies the lesson before the overflow rather than after it, by
   * asserting what the cold start WOULD be.
   *
   * That head is THIRTEEN since #167 (seven recent + six frequent), not the
   * seven BPMN met — so the cold start is nearly the whole toolbox, and the
   * author's order is nearly the whole answer. It is also no longer the four
   * levels and the line between them: the PO's boards-first convention
   * (28/08/2026) supersedes that reading, and the catalogue opens with the
   * SHEET, then the two most-drawn levels with their external variants beside
   * them, then the container and the component.
   */
  it('does not overflow, and would lead with the board and five levels', () => {
    const catalogue = [...c4Commands]
      .filter(c => c.surfaces.includes('catalogue'))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    expect(catalogue).toHaveLength(SENIOR_MENU_CAP);
    const { commands, overflow } = selectSeniorMenuCommands(
      toolbox,
      catalogue,
      () => undefined
    );
    expect(overflow, 'c4 now overflows — re-read this test').toBe(false);
    expect(commands).toHaveLength(13);

    // What the cold start would be the day it tips over: the sheet first, then
    // the people and the systems with their external variants beside them, then
    // the container and the component. The PO's boards-first convention
    // (28/08/2026), not the canonical-core-first order it replaced.
    // #167 widened the ranked slots to thirteen (seven recent + six frequent),
    // so the would-be cold start is no longer a seven-entry head: it is the
    // WHOLE toolbox in the PO's boards-first author order — the sheet first,
    // the levels with their external variants beside them, the line, and the
    // two frames last.
    expect(catalogue.slice(0, SENIOR_MENU_RANKED_SLOTS).map(c => c.id)).toEqual(
      [
        'c4.addBoard',
        'c4.addPerson',
        'c4.addPersonExt',
        'c4.addSystem',
        'c4.addSystemExt',
        'c4.addContainer',
        'c4.addComponent',
        'c4.addDatabase',
        'c4.addMobile',
        'c4.addBrowser',
        'c4.relationshipTool',
        'c4.addSystemBoundary',
        'c4.addContainerBoundary',
      ]
    );
  });

  /**
   * The PO arbitration of 27/08/2026, pinned so a well-meaning refactor cannot
   * quietly promote the legend back into the registry.
   *
   * Generating a legend belongs to a board you have SELECTED and to nothing
   * else: it is not an artefact to pick off a palette, and a catalogue entry
   * would offer it to a user with no board in front of them. So there is no
   * command, no catalogue row, no palette entry and no bindable shortcut — one
   * button, on one row.
   */
  it('makes the legend a toolbar button and never a command', () => {
    expect(c4Commands.find(c => c.id === 'c4.legend')).toBeUndefined();
    expect(c4Commands.some(c => c.kind === 'legend')).toBe(false);
    expect(c4CommandIcons['c4.legend']).toBeUndefined();
    // The export is the ONLY command that reaches the board's row, and it does
    // so through the "⋮". The arbitration is about the legend, not about the
    // row: a command may still be invoked from a contextual toolbar, and the
    // export is the one that is.
    expect(
      c4Commands
        .filter(c => c.surfaces.includes('contextual-toolbar'))
        .map(c => c.id)
    ).toEqual(['c4.exportMermaid']);

    // …and the legend is on the row, which is the only place it can be reached
    // from.
    const legend = c4LegendToolbarConfig.actions.find(
      action => action.id === 'b.legend'
    );
    expect(legend).toBeDefined();
    expect(typeof legend!.run).toBe('function');
    // `b.` sorts it after the resize toggle, so the two modules render as the
    // one row a user sees rather than in registration order. The always-on
    // module holds the toggle and — partitioned into the "⋮" — the export.
    expect(c4BoardToolbarConfig.actions.map(action => action.id)).toEqual([
      'a.toggle-resize',
      'z.export-mermaid',
    ]);
  });
});

describe('what a c4 command actually creates', () => {
  const byId = new Map(c4Commands.map(c => [c.id, c]));

  it('stamps every element with the role its kind means', () => {
    for (const command of c4Commands) {
      const element = command.telemetry?.element;
      if (!element?.startsWith('node:')) continue;
      const kind = element.slice('node:'.length) as C4NodeKind;
      const props = created(command);
      expect(props.type, kind).toBe('c4Node');
      expect(props.kind, kind).toBe(kind);
      expect(props.role, kind).toBe(C4_ROLE_OF_KIND[kind]);
      // The palette is what the creation site SEEDS the element with; both
      // colours stay editable from the shape toolbar afterwards.
      expect(props.fillColor, kind).toBe(NODE_PALETTE[kind].fill);
      expect(props.strokeColor, kind).toBe(NODE_PALETTE[kind].border);
      expect(props.color, kind).toBe(NODE_PALETTE[kind].text);
      // Every C4 element carries words — the box is the same box at three of
      // the four levels, so one with nothing written on it says nothing at all
      // — but they are on the TITLE tier now, not on the shape.
      const [, title] = createdAll(command);
      expect(title.role, kind).toBe(C4_ROLE.title);
      expect(title.text, kind).toBe(NODE_LABEL[kind]);
    }
  });

  it('builds a whole component, not a lone box, for every node kind', () => {
    // The PO's recette of 28/08/2026, at the command level: every one of the
    // nine artefacts arrives as the shape, its three written tiers — the name
    // included — and the group that makes the four one thing. Asserted here as
    // well as in `component.unit.spec.ts` because this is the wiring a user
    // reaches: a command rewired to a creation function that dropped a bare
    // shape would pass every other assertion in this file.
    for (const command of c4Commands) {
      const element = command.telemetry?.element;
      if (!element?.startsWith('node:')) continue;
      expect(
        createdAll(command).map(props => props.type),
        element
      ).toEqual(['c4Node', 'text', 'text', 'text', 'group']);
    }
  });

  it('leaves the five glyph-bodied silhouettes unfilled and unstroked', () => {
    // A head fused into a body, a cylinder, a phone and a browser window are not
    // native shapes: the renderer paints their body, so the shape underneath
    // must paint nothing. The two devices joined the list with the PO's recette
    // — the stencil paints their OUTER rectangle in the darker colour and insets
    // a lighter screen in it, which leaves a native rect nothing to contribute.
    const glyphBodied = [
      'c4.addPerson',
      'c4.addPersonExt',
      'c4.addDatabase',
      'c4.addMobile',
      'c4.addBrowser',
    ];
    for (const id of glyphBodied) {
      const props = created(byId.get(id)!);
      expect(props.filled, id).toBe(false);
      expect(props.strokeStyle, id).toBe(StrokeStyle.None);
    }
    // The four boxed levels are real filled rectangles, and square-cornered:
    // that is all the stencil draws them as.
    for (const id of [
      'c4.addSystem',
      'c4.addSystemExt',
      'c4.addContainer',
      'c4.addComponent',
    ]) {
      const props = created(byId.get(id)!);
      expect(props.filled, id).toBe(true);
      expect(props.strokeStyle, id).toBe(StrokeStyle.Solid);
      expect(props.radius, id).toBe(0);
    }
  });

  it('drops a shape with no words in it, and stacks the three tiers below', () => {
    // The name is a `c4:title` child since the PO's follow-up, so the shape
    // carries no inner text — anything written there would be a second,
    // invisible name. The person's stack also clears its HEAD: its words are
    // laid out in the body, not across the silhouette.
    for (const id of ['c4.addPerson', 'c4.addSystem']) {
      expect(created(byId.get(id)!).text, id).toBeUndefined();
    }
    const [, personTitle] = createdAll(byId.get('c4.addPerson')!);
    const [, systemTitle] = createdAll(byId.get('c4.addSystem')!);
    const topOf = (props: Record<string, unknown>) =>
      (JSON.parse(props.xywh as string) as number[])[1];
    // Element boxes are centred on the viewport origin, so a tier's top is
    // measured against the element's own top edge.
    expect(topOf(personTitle) + NODE_SIZE.person.h / 2).toBeGreaterThan(
      NODE_SIZE.person.h * PERSON_BODY_TOP
    );
    expect(topOf(systemTitle) + NODE_SIZE.system.h / 2).toBeLessThan(
      NODE_SIZE.system.h / 2
    );
  });

  it('creates the board and the two boundaries with their frame roles', () => {
    expect(created(byId.get('c4.addBoard')!)).toMatchObject({
      type: 'c4Board',
      role: C4_ROLE.board,
    });
    // The variant is WRITTEN, and it also picks the default name — the two
    // boundaries are the same dashed rectangle, and C4 tells them apart by what
    // is written under the corner.
    //
    // Since the boundary role split, the same argument also picks the ROLE, and
    // the two are asserted together on purpose: this is the one site that writes
    // either, and a boundary whose role said "system" while its variant said
    // "container" would paint one thing and be judged as another.
    expect(created(byId.get('c4.addSystemBoundary')!)).toMatchObject({
      type: 'c4Boundary',
      role: C4_ROLE['system-boundary'],
      variant: 'system',
      name: BOUNDARY_LABEL.system,
    });
    expect(created(byId.get('c4.addContainerBoundary')!)).toMatchObject({
      type: 'c4Boundary',
      role: C4_ROLE['container-boundary'],
      variant: 'container',
      name: BOUNDARY_LABEL.container,
    });
    // The PARENT role is what a boundary drawn before the split carries, and
    // this editor never writes it again.
    for (const id of ['c4.addSystemBoundary', 'c4.addContainerBoundary']) {
      expect(created(byId.get(id)!).role, id).not.toBe(C4_ROLE.boundary);
      // ...and both still ARE boundaries, which is what keeps the two
      // membership rules and the legend row written on the parent.
      expect(
        roleIsA(
          created(byId.get(id)!).role as string,
          C4_ROLE.boundary,
          C4_ROLES
        ),
        id
      ).toBe(true);
    }
  });

  it('arms a straight, dashed, filled-headed connector for the relationship', () => {
    const { props, tool } = armed(byId.get('c4.relationshipTool')!);
    expect(props).toEqual({
      mode: ConnectorMode.Straight,
      stroke: RELATIONSHIP_STROKE,
      strokeStyle: StrokeStyle.Dash,
      strokeWidth: RELATIONSHIP_WIDTH,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.Triangle,
    });
    // A TYPED edge (`docs/adr/0010`): the role is carried by the TOOL, so the
    // connector is born with it rather than acquiring one afterwards.
    expect(tool).toEqual({
      mode: ConnectorMode.Straight,
      role: C4_ROLE.relationship,
    });
  });
});

describe('the c4 automatic legend', () => {
  it('documents the five element roles, the frame and the relation', () => {
    expect(C4_AUTO_LEGEND.sections.map(section => section.title)).toEqual([
      'Elements',
      'Frames',
      'Relations',
    ]);
    const roles = C4_AUTO_LEGEND.sections.flatMap(section =>
      section.entries.map(entry => entry.role)
    );
    expect(roles).toEqual([
      C4_ROLE.person,
      C4_ROLE.system,
      C4_ROLE.container,
      C4_ROLE.database,
      C4_ROLE.component,
      C4_ROLE.boundary,
      C4_ROLE.relationship,
    ]);
    // The board itself is never a legend row: a legend of what is drawn ON the
    // sheet must not list the sheet.
    expect(roles).not.toContain(C4_ROLE.board);
  });

  it('asks for an exact match on the container, and only there', () => {
    // `c4:database` specialises `c4:container`, so an inclusive entry would put
    // a "Container" row on a board carrying nothing but cylinders — a row
    // naming a shape that is nowhere on the diagram.
    const exact = C4_AUTO_LEGEND.sections
      .flatMap(section => section.entries)
      .filter(entry => entry.exact)
      .map(entry => entry.role);
    expect(exact).toEqual([C4_ROLE.container]);
  });

  /**
   * The boundary row survived the role split without a line of its own, and
   * this is what proves it rather than assuming it.
   *
   * The entry is written on the PARENT role and asks for no `exact` match, so
   * `autoLegendSections` reaches both children through `roleIsA`. Had the split
   * needed a second and a third entry here, a board of container boundaries
   * would have listed "Boundary" twice or not at all.
   */
  it('lists the one Boundary row for a board drawn at either level', () => {
    const framesOf = (present: string[]) =>
      autoLegendSections(new Set(present), C4_AUTO_LEGEND).find(
        section => section.title === 'Frames'
      );
    for (const role of [
      C4_ROLE.boundary,
      C4_ROLE['system-boundary'],
      C4_ROLE['container-boundary'],
    ]) {
      const frames = framesOf([role]);
      expect(frames?.rows, role).toHaveLength(1);
      expect(frames?.rows[0].label, role).toBe('Boundary');
    }
    // A board with both levels drawn on it still lists the row once: they are
    // one frame of the notation, drawn twice.
    expect(
      framesOf([C4_ROLE['system-boundary'], C4_ROLE['container-boundary']])
        ?.rows
    ).toHaveLength(1);
    // ...and a board with no boundary at all lists no Frames section.
    expect(framesOf([C4_ROLE.system])).toBeUndefined();
  });

  it('reads its wordings off the vocabulary rather than restating them', () => {
    const rows = C4_AUTO_LEGEND.sections.flatMap(section =>
      section.entries.map(entry => entry.row)
    );
    for (const row of rows) expect(row.label).toBeTruthy();
    // The two frames of the notation are drawn, never filled: a boundary and a
    // relationship are both lines, and both are dashed on the canvas.
    const dashed = rows.filter(row => row.swatch === 'line');
    expect(dashed).toHaveLength(2);
    expect(dashed.every(row => row.dashed)).toBe(true);
  });
});
