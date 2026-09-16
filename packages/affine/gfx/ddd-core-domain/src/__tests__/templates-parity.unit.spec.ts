import { CD_SUBDOMAINS, TEAM_TOPOLOGIES } from '@labre/affine-gfx-ddd-shared';
import { snapshotFromAction } from '@labre/affine-gfx-template';
import { TranslationProvider } from '@labre/affine-shared/services';
import type { BlockStdScope, CommandInvocation } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { coreDomainCommands } from '../commands';
import { CORE_DOMAIN_ROLE, markerRole, subdomainRole } from '../roles';
import { coreDomainTemplateCategory } from '../templates';

/**
 * The guard the DDD palette never had: **a template must be what its command
 * draws.**
 *
 * The hand-written Core Domain templates had lost `role: core-domain:chart` on
 * the background — so the validation engine did not see a templated chart AS a
 * chart, and `core-domain.outsourced-core` and `malformed-movement` could not
 * fire on anything dropped from the palette — and the dots and markers arrived
 * as single bare shapes with no role, no name and no group.
 */

/** A template's stored snapshot, as far as this file reads it. */
type Snapshot = {
  blocks: { children: { props: { elements: Record<string, RawElement> } }[] };
};

type RawElement = {
  type?: string;
  role?: string;
  shapeType?: string;
  resizeEnabled?: boolean;
  children?: { json?: Record<string, boolean> };
};

/** Any value does: these commands read the controller and nothing else. */
const INVOCATION: CommandInvocation = {
  surface: 'senior-menu',
  source: 'internal',
};

/**
 * The one artefact command with no template, and why.
 *
 * "Movement over time" arms the connector tool and draws nothing
 * (`docs/adr/0010`): a movement is a sentence, and only becomes one once the
 * user has dragged it from the current position to the future one. The palette
 * used to ship it as a free arrow attached to nothing.
 */
const TOOL_ARMING = ['ddd-core-domain.addMovement'];

const shipped = coreDomainTemplateCategory.templates;
if (typeof shipped === 'function') {
  throw new Error('the Core Domain template category is expected to be eager');
}
const templates = shipped;

const elementsOf = (template: (typeof templates)[number]) =>
  (template.content as unknown as Snapshot).blocks.children[0].props.elements;

const named = (name: string) => {
  const found = templates.find(template => template.name === name);
  if (!found) throw new Error(`no template named "${name}"`);
  return elementsOf(found);
};

describe('the Core Domain palette covers the toolbox', () => {
  const artefacts = coreDomainCommands.filter(
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
    const command = coreDomainCommands.find(
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

describe('the chart is a declared chart', () => {
  it('carries `core-domain:chart` and its declared resize policy', () => {
    const elements = Object.values(named('Core Domain Chart'));
    expect(elements).toHaveLength(1);
    expect(elements[0].role).toBe(CORE_DOMAIN_ROLE.chart);
    expect(elements[0].resizeEnabled).toBe(true);
  });
});

/**
 * A dot IS the sub-domain: the role rides on the ellipse, never on the group
 * that also holds its name — so a rule measuring where a sub-domain sits
 * measures the artefact and not the box around it and its caption.
 */
describe('a sub-domain dot travels with its name', () => {
  for (const preset of CD_SUBDOMAINS) {
    it(`${preset.label} is a dot, a name and the group that carries both`, () => {
      const entries = Object.entries(named(`Core Domain — ${preset.label}`));
      expect(entries).toHaveLength(3);

      const dot = entries.find(([, el]) => el.type === 'shape');
      const label = entries.find(([, el]) => el.type === 'text');
      const group = entries.find(([, el]) => el.type === 'group');
      expect(dot && label && group).toBeTruthy();

      expect(dot![1].shapeType).toBe('ellipse');
      expect(dot![1].role).toBe(subdomainRole(preset.kind));
      expect(label![1].role).toBeUndefined();

      expect(Object.keys(group![1].children?.json ?? {}).sort()).toEqual(
        [dot![0], label![0]].sort()
      );
    });
  }
});

/** The marker is the square; the letter is its glyph and the word a caption. */
describe('a team-topology marker is a square, its letter and its caption', () => {
  for (const preset of TEAM_TOPOLOGIES) {
    it(`${preset.label} groups the three`, () => {
      const entries = Object.entries(named(`Team topology — ${preset.label}`));
      expect(entries).toHaveLength(4);

      const square = entries.find(([, el]) => el.type === 'shape');
      const texts = entries.filter(([, el]) => el.type === 'text');
      const group = entries.find(([, el]) => el.type === 'group');
      expect(square && group).toBeTruthy();
      expect(texts).toHaveLength(2);

      expect(square![1].role).toBe(markerRole(preset.kind));
      for (const [, text] of texts) expect(text.role).toBeUndefined();

      expect(Object.keys(group![1].children?.json ?? {})).toHaveLength(3);
    });
  }
});

/**
 * A dot's name and a marker's caption are SEEDS: resolved at placement,
 * through the same translation seam a derived template already speaks
 * (ADR 0016).
 */
describe('captions speak the inserting editor’s language', () => {
  const hostWith = (t?: (key: string) => string | undefined) =>
    ({
      getOptional: (id: unknown) =>
        id === TranslationProvider && t ? { t } : null,
    }) as unknown as BlockStdScope;

  type Text = { type?: string; text?: { delta?: { insert?: string }[] } };

  it('without a provider, a sub-domain dot keeps its English name', () => {
    const command = coreDomainCommands.find(
      c => c.id === 'ddd-core-domain.addBigBet'
    )!;
    const elements = snapshotFromAction(
      std => command.run(std, INVOCATION),
      'big bet'
    ).blocks.children[0].props.elements as unknown as Record<string, Text>;
    const label = Object.values(elements).find(el => el.type === 'text');
    expect(label?.text?.delta?.[0]?.insert).toBe('Big-bet sub-domain');
  });

  it('with a fake provider, a sub-domain dot is named in French', () => {
    const command = coreDomainCommands.find(
      c => c.id === 'ddd-core-domain.addBigBet'
    )!;
    const std = hostWith(key =>
      key === 'com.labre.ddd-core-domain.seed.big-bet'
        ? 'Sous-domaine pari majeur'
        : undefined
    );
    const elements = snapshotFromAction(
      s => command.run(s, INVOCATION),
      'big bet',
      std
    ).blocks.children[0].props.elements as unknown as Record<string, Text>;
    const label = Object.values(elements).find(el => el.type === 'text');
    expect(label?.text?.delta?.[0]?.insert).toBe('Sous-domaine pari majeur');
  });

  it('with a fake provider, a team-topology marker’s caption is translated (its letter is not)', () => {
    const command = coreDomainCommands.find(
      c => c.id === 'ddd-core-domain.addCollaboration'
    )!;
    const std = hostWith(key =>
      key === 'com.labre.ddd-core-domain.seed.collaboration'
        ? 'Collaboration FR'
        : undefined
    );
    const elements = snapshotFromAction(
      s => command.run(s, INVOCATION),
      'collaboration',
      std
    ).blocks.children[0].props.elements as unknown as Record<string, Text>;
    const texts = Object.values(elements)
      .filter(el => el.type === 'text')
      .map(el => el.text?.delta?.[0]?.insert);
    expect(texts.sort()).toEqual(['C', 'Collaboration FR'].sort());
  });
});
