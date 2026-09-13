import { TranslationProvider } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { bpmnTemplateCategory } from '../templates';

/**
 * The two hand-composed scenes rebuild their seeds through
 * {@link Template.localize} (`docs/adr/0016`): without a host catalogue the
 * rebuild must be byte-identical to the shipped `content`, and with one every
 * seed the scene writes must come back in the host's words.
 *
 * Mirrors `a derived template speaks the inserting editor's language` in
 * `@labre/affine-gfx-template`'s own suite, one level up: that file proves the
 * MECHANISM works for a template derived from a command, this one proves the
 * two BPMN scenes actually wire their seeds through it.
 */
const hostWith = (t?: (key: string, params?: unknown) => string | undefined) =>
  ({
    getOptional: (id: unknown) =>
      id === TranslationProvider && t ? { t } : undefined,
  }) as unknown as BlockStdScope;

const shipped = bpmnTemplateCategory.templates;
if (typeof shipped === 'function') {
  throw new Error('the BPMN template category is expected to be eager');
}
const templates = shipped;

const localizable = templates.filter(template => template.localize);

describe('every BPMN template with a localize rebuild', () => {
  it('lists the two hand-composed scenes and the ones derived from a command', () => {
    // The two hand-composed scenes AND every `templateFromCommand` template
    // (which gets `localize` for free) — see `Template.localize`.
    expect(localizable.length).toBeGreaterThanOrEqual(2);
    expect(localizable.map(t => t.name)).toEqual(
      expect.arrayContaining(['Simple process', 'Message exchange'])
    );
  });

  it('without a provider, every localize rebuild equals the shipped content', () => {
    for (const template of localizable) {
      expect(
        JSON.stringify(template.localize!(hostWith())),
        template.name
      ).toBe(JSON.stringify(template.content));
    }
  });
});

/**
 * The words one surface element carries — a node's `text` (a serialized
 * `Y.Text`) or a pool's plain `name` string, whichever it has.
 */
function textOf(content: unknown, id: string): string | undefined {
  const elements = (
    content as {
      blocks: { children: { props: { elements: Record<string, unknown> } }[] };
    }
  ).blocks.children[0].props.elements as Record<
    string,
    { text?: { delta: { insert: string }[] }; name?: string }
  >;
  const element = elements[id];
  if (element?.name !== undefined) return element.name;
  const delta = element?.text?.delta;
  return delta?.map(op => op.insert).join('');
}

describe('the two worked scenes speak the inserting editor’s language', () => {
  const shout = (key: string, params?: unknown) =>
    `[${key}${params ? ':' + JSON.stringify(params) : ''}]`.toUpperCase();

  it('"Simple process" resolves its pool name and its three task captions', () => {
    const template = templates.find(t => t.name === 'Simple process')!;
    const localized = template.localize!(hostWith(shout));

    expect(textOf(localized, 'pool')).toBe(
      shout('com.labre.bpmn.example.simple-process.pool-name')
    );
    expect(textOf(localized, 'task1')).toBe(
      shout('com.labre.bpmn.example.simple-process.submit-request')
    );
    expect(textOf(localized, 'task2')).toBe(
      shout('com.labre.bpmn.example.simple-process.fulfil')
    );
    expect(textOf(localized, 'task3')).toBe(
      shout('com.labre.bpmn.example.simple-process.reject')
    );
  });

  it('"Message exchange" resolves its two pool names and its two task captions', () => {
    const template = templates.find(t => t.name === 'Message exchange')!;
    const localized = template.localize!(hostWith(shout));

    expect(textOf(localized, 'customer')).toBe(
      shout('com.labre.bpmn.example.message-exchange.customer')
    );
    expect(textOf(localized, 'supplier')).toBe(
      shout('com.labre.bpmn.example.message-exchange.supplier')
    );
    expect(textOf(localized, 'ask')).toBe(
      shout('com.labre.bpmn.example.message-exchange.place-order')
    );
    expect(textOf(localized, 'answer')).toBe(
      shout('com.labre.bpmn.example.message-exchange.confirm-order')
    );
  });
});
