import { snapshotFromAction } from '@labre/affine-gfx-template';
import { TextFitMode } from '@labre/affine-model';
import { TranslationProvider } from '@labre/affine-shared/services';
import type { BlockStdScope, CommandInvocation } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { contextMapCommands } from '../commands';
import { CONTEXT_MAP_ROLE } from '../roles';
import { contextMapTemplateCategory } from '../templates';

/**
 * The guard the DDD palette never had: **a template must be what its command
 * draws.**
 *
 * The hand-written Context Map templates had lost the `context-map:context`
 * role and the overflow fit mode on the bubble, stored the cloud's name on the
 * polygon instead of grouping a text beside it, shipped no board at all — and
 * kept alive, in NINE entries, the free-floating relationship drawing WS2 had
 * removed from the toolbox. Those nine are gone here: their commands arm the
 * connector tool, so there is nothing to record.
 */

/** A template's stored snapshot, as far as this file reads it. */
type Snapshot = {
  blocks: { children: { props: { elements: Record<string, RawElement> } }[] };
};

type RawElement = {
  type?: string;
  role?: string;
  shapeType?: string;
  text?: unknown;
  textFitMode?: string;
  resizeEnabled?: boolean;
  children?: { json?: Record<string, boolean> };
};

/** Any value does: these commands read the controller and nothing else. */
const INVOCATION: CommandInvocation = {
  surface: 'senior-menu',
  source: 'internal',
};

/**
 * The nine artefact commands with no template, and why: each arms the connector
 * tool for one DDD Crew pattern and draws nothing (`docs/adr/0010`). The user
 * drags from one bounded context to another, and THAT pair is the statement the
 * `context-map.*` rules read. A template could only have re-created the
 * mid-air group WS2 deleted.
 */
const TOOL_ARMING = contextMapCommands
  .filter(command => command.telemetry?.element?.startsWith('relationship:'))
  .map(command => command.id);

const shipped = contextMapTemplateCategory.templates;
if (typeof shipped === 'function') {
  throw new Error('the Context Map template category is expected to be eager');
}
const templates = shipped;

const elementsOf = (template: (typeof templates)[number]) =>
  (template.content as unknown as Snapshot).blocks.children[0].props.elements;

const named = (name: string) => {
  const found = templates.find(template => template.name === name);
  if (!found) throw new Error(`no template named "${name}"`);
  return elementsOf(found);
};

describe('the Context Map palette covers the toolbox', () => {
  const artefacts = contextMapCommands.filter(
    command => command.kind === 'artefact'
  );

  it('arms a tool for the nine patterns rather than drawing them', () => {
    expect(TOOL_ARMING).toHaveLength(9);
  });

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
    const command = contextMapCommands.find(
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

describe('the board is a declared board', () => {
  it('carries `context-map:board` and its declared resize policy', () => {
    const elements = Object.values(named('Context Map board'));
    expect(elements).toHaveLength(1);
    expect(elements[0].role).toBe(CONTEXT_MAP_ROLE.board);
    expect(elements[0].resizeEnabled).toBe(true);
  });
});

describe('the bubble is a bounded CONTEXT, not a blue pill', () => {
  it('carries its role and lets a long name spill rather than deform', () => {
    const elements = Object.values(named('Context Map — Bounded Context'));
    expect(elements).toHaveLength(1);
    expect(elements[0].role).toBe(CONTEXT_MAP_ROLE.context);
    expect(elements[0].textFitMode).toBe(TextFitMode.Overflow);
  });
});

describe('the cloud carries its name beside it', () => {
  it('is a polygon and a grouped text, not a polygon with words in it', () => {
    const entries = Object.entries(named('Context Map — Cloud / System'));
    expect(entries).toHaveLength(3);

    const cloud = entries.find(([, el]) => el.type === 'shape');
    const label = entries.find(([, el]) => el.type === 'text');
    const group = entries.find(([, el]) => el.type === 'group');
    expect(cloud && label && group).toBeTruthy();

    expect(cloud![1].shapeType).toBe('polygon');
    expect(cloud![1].text).toBeUndefined();

    expect(Object.keys(group![1].children?.json ?? {}).sort()).toEqual(
      [cloud![0], label![0]].sort()
    );
  });
});

/**
 * The bubble's caption and the cloud's name are SEEDS: resolved at placement,
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

  it('without a provider, the bubble keeps its English caption', () => {
    const command = contextMapCommands.find(
      c => c.id === 'ddd-context-map.addBoundedContext'
    )!;
    const elements = snapshotFromAction(
      std => command.run(std, INVOCATION),
      'bubble'
    ).blocks.children[0].props.elements as unknown as Record<string, Text>;
    const [bubble] = Object.values(elements);
    expect(bubble.text?.delta?.[0]?.insert).toBe('Bounded Context');
  });

  it('with a fake provider, the bubble caption is French', () => {
    const command = contextMapCommands.find(
      c => c.id === 'ddd-context-map.addBoundedContext'
    )!;
    const std = hostWith(key =>
      key === 'com.labre.ddd-context-map.seed.bounded-context'
        ? 'Contexte borné'
        : undefined
    );
    const elements = snapshotFromAction(
      s => command.run(s, INVOCATION),
      'bubble',
      std
    ).blocks.children[0].props.elements as unknown as Record<string, Text>;
    const [bubble] = Object.values(elements);
    expect(bubble.text?.delta?.[0]?.insert).toBe('Contexte borné');
  });

  it('with a fake provider, the cloud’s name is French', () => {
    const command = contextMapCommands.find(
      c => c.id === 'ddd-context-map.addCloud'
    )!;
    const std = hostWith(key =>
      key === 'com.labre.ddd-context-map.seed.cloud' ? 'Système' : undefined
    );
    const elements = snapshotFromAction(
      s => command.run(s, INVOCATION),
      'cloud',
      std
    ).blocks.children[0].props.elements as unknown as Record<string, Text>;
    const label = Object.values(elements).find(el => el.type === 'text');
    expect(label?.text?.delta?.[0]?.insert).toBe('Système');
  });
});
