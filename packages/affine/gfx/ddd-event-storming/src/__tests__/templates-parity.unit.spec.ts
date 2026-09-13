import { SHADOW_COLOR } from '@labre/affine-gfx-ddd-shared';
import { snapshotFromAction } from '@labre/affine-gfx-template';
import { TextFitMode } from '@labre/affine-model';
import { TranslationProvider } from '@labre/affine-shared/services';
import type { BlockStdScope, CommandInvocation } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { eventStormingCommands } from '../commands';
import { ES_ROLE, ES_STICKY_ROLE } from '../roles';
import { eventStormingTemplateCategory } from '../templates';

/**
 * The guard the DDD palette never had: **a template must be what its command
 * draws.**
 *
 * `ddd-shared/templates/components.ts` was written in June 2026 and never
 * functionally touched again while the toolbox kept moving — stickies became
 * shadow + face grouped, gained `textFitMode: Contained` and gained the `es:*`
 * roles every rule reads, and the board became a placeable artefact. Nothing in
 * the repository compared the two, so the palette quietly kept dropping flat
 * role-less rectangles for two and a half months.
 *
 * Every template here is now DERIVED (`templateFromCommand` runs the command
 * against a recording surface), and this file re-runs the command and compares.
 */

/** A template's stored snapshot, as far as this file reads it. */
type Snapshot = {
  blocks: { children: { props: { elements: Record<string, RawElement> } }[] };
};

type RawElement = {
  type?: string;
  role?: string;
  shapeType?: string;
  fillColor?: string;
  textFitMode?: string;
  resizeEnabled?: boolean;
  children?: { json?: Record<string, boolean> };
};

/**
 * The invocation a derived template is recorded under. Any value does: an Event
 * Storming command hands the `GfxController` to its action and reads nothing
 * else off the invocation.
 */
const INVOCATION: CommandInvocation = {
  surface: 'senior-menu',
  source: 'internal',
};

/**
 * The one artefact command with no template, and why.
 *
 * "Flow" arms the connector tool and draws nothing at all (`docs/adr/0010`):
 * there is no artefact to record, because the user draws the arc between two
 * real stickies and THAT is the statement.
 */
const TOOL_ARMING = ['ddd-event-storming.addFlow'];

const shipped = eventStormingTemplateCategory.templates;
if (typeof shipped === 'function') {
  throw new Error(
    'the Event Storming template category is expected to be eager'
  );
}
const templates = shipped;

const elementsOf = (template: (typeof templates)[number]) =>
  (template.content as unknown as Snapshot).blocks.children[0].props.elements;

const named = (name: string) => {
  const found = templates.find(template => template.name === name);
  if (!found) throw new Error(`no template named "${name}"`);
  return elementsOf(found);
};

describe('the Event Storming palette covers the toolbox', () => {
  const artefacts = eventStormingCommands.filter(
    command => command.kind === 'artefact'
  );

  it('ships one derived template per placement command', () => {
    expect(artefacts.length).toBeGreaterThan(0);
    for (const command of artefacts) {
      const derived = templates.filter(
        template => template.commandId === command.id
      );
      expect(
        derived.map(template => template.name),
        `templates for ${command.id}`
      ).toHaveLength(TOOL_ARMING.includes(command.id) ? 0 : 1);
    }
  });

  it('derives every template it ships', () => {
    const free = templates.filter(template => template.commandId === undefined);
    expect(free.map(template => template.name)).toEqual([]);
  });
});

describe('every derived template is what its command draws', () => {
  for (const template of templates) {
    const command = eventStormingCommands.find(
      entry => entry.id === template.commandId
    );

    it(`${template.name} re-runs identically`, () => {
      expect(command, template.commandId).toBeDefined();
      expect(template.content).toEqual(
        snapshotFromAction(
          std => command!.run(std, INVOCATION),
          template.name ?? 'Template'
        )
      );
    });
  }
});

/**
 * The break the audit reported, spelled out: a sticky dropped from the palette
 * must arrive as the post-it the button produces — a shadow, a coloured face
 * that carries the role and shrinks its handwriting to fit, and the group that
 * keeps the two together — not as one flat, role-less, unfitted rectangle.
 */
describe('a sticky is a post-it, not a rectangle', () => {
  for (const preset of [
    { name: 'Domain event', kind: 'domainEvent' as const },
    { name: 'Aggregate', kind: 'aggregate' as const },
    { name: 'Hotspot', kind: 'hotspot' as const },
  ]) {
    it(`${preset.name} is a shadow, a face and the group that carries both`, () => {
      const elements = named(`Event Storming — ${preset.name}`);
      const entries = Object.entries(elements);
      expect(entries).toHaveLength(3);

      const group = entries.find(([, el]) => el.type === 'group');
      const shapes = entries.filter(([, el]) => el.type === 'shape');
      expect(group).toBeTruthy();
      expect(shapes).toHaveLength(2);

      const shadow = shapes.find(([, el]) => el.fillColor === SHADOW_COLOR);
      const face = shapes.find(([, el]) => el.fillColor !== SHADOW_COLOR);
      expect(shadow && face).toBeTruthy();

      // The role rides on the FACE: it is what carries the words and what every
      // grammar rule reads. The shadow is ink and stays neutral.
      expect(face![1].role).toBe(ES_STICKY_ROLE[preset.kind]);
      expect(face![1].textFitMode).toBe(TextFitMode.Contained);
      expect(shadow![1].role).toBeUndefined();

      expect(Object.keys(group![1].children?.json ?? {}).sort()).toEqual(
        [shadow![0], face![0]].sort()
      );
    });
  }
});

describe('the board is a declared board', () => {
  it('carries `es:board` and its declared resize policy', () => {
    const elements = Object.values(named('Event Storming board'));
    expect(elements).toHaveLength(1);
    expect(elements[0].role).toBe(ES_ROLE.board);
    expect(elements[0].resizeEnabled).toBe(true);
  });
});

/**
 * A sticky's caption is a SEED: resolved at placement, through the same
 * translation seam a derived template already speaks (ADR 0016).
 */
describe('a sticky speaks the inserting editor’s language', () => {
  const hostWith = (t?: (key: string) => string | undefined) =>
    ({
      getOptional: (id: unknown) =>
        id === TranslationProvider && t ? { t } : null,
    }) as unknown as BlockStdScope;

  const textOf = (elements: Record<string, RawElement>) => {
    const face = Object.values(elements).find(
      el => el.type === 'shape' && el.fillColor !== SHADOW_COLOR
    ) as unknown as { text?: { delta?: { insert?: string }[] } };
    return face?.text?.delta?.[0]?.insert;
  };

  it('without a provider, the domain-event sticky keeps its English caption', () => {
    const command = eventStormingCommands.find(
      c => c.id === 'ddd-event-storming.addDomainEvent'
    )!;
    const elements = snapshotFromAction(
      std => command.run(std, INVOCATION),
      'domain event'
    ).blocks.children[0].props.elements as unknown as Record<
      string,
      RawElement
    >;
    expect(textOf(elements)).toBe('Domain event');
  });

  it('with a fake provider, the domain-event sticky is written in French', () => {
    const command = eventStormingCommands.find(
      c => c.id === 'ddd-event-storming.addDomainEvent'
    )!;
    const std = hostWith(key =>
      key === 'com.labre.ddd-event-storming.seed.domain-event'
        ? 'Événement de domaine'
        : undefined
    );
    const elements = snapshotFromAction(
      s => command.run(s, INVOCATION),
      'domain event',
      std
    ).blocks.children[0].props.elements as unknown as Record<
      string,
      RawElement
    >;
    expect(textOf(elements)).toBe('Événement de domaine');
  });
});
