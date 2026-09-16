import { TranslationProvider } from '@labre/affine-shared/services';
import { Container } from '@labre/global/di';
import {
  type AnyCommandDescriptor,
  type BlockStdScope,
  CommandExtension,
} from '@labre/std';
import { describe, expect, it } from 'vitest';

import { resolveTemplateName } from '../toolbar/resolve-name.js';
import type { Template } from '../toolbar/template-type.js';

const COMMAND = {
  id: 'demo.addBox',
  owner: 'core',
  kind: 'artefact',
  labelKey: 'com.labre.commands.demo.addBox',
  labelFallback: 'Box',
  surfaces: [],
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  run: () => {},
} as unknown as AnyCommandDescriptor;

/** A `std` whose command registry carries `COMMAND`, and an optional host. */
function stdWith(t?: (key: string) => string | undefined): BlockStdScope {
  const container = new Container();
  CommandExtension([COMMAND]).setup(container);
  const provider = container.provider();
  return {
    provider,
    getOptional: (id: unknown) =>
      id === TranslationProvider && t ? { t } : undefined,
  } as unknown as BlockStdScope;
}

const template = (props: Partial<Template>): Template => ({
  name: 'Box',
  content: {},
  type: 'template',
  ...props,
});

describe('resolveTemplateName', () => {
  it('is the template’s own name for a hand-written template (no commandId)', () => {
    const std = stdWith();
    expect(resolveTemplateName(std, template({ name: 'Kanban board' }))).toBe(
      'Kanban board'
    );
  });

  it('falls back to the template’s name when the command is not registered', () => {
    const std = stdWith();
    expect(
      resolveTemplateName(
        std,
        template({ name: 'Ghost', commandId: 'nothing.here' })
      )
    ).toBe('Ghost');
  });

  it('with no host, renders the template’s baked name, letter for letter', () => {
    const std = stdWith();
    expect(
      resolveTemplateName(std, template({ name: 'Box', commandId: COMMAND.id }))
    ).toBe('Box');
  });

  it('prefers the host’s catalogue entry for the command’s own key', () => {
    const std = stdWith(key =>
      key === 'com.labre.commands.demo.addBox' ? 'Boîte' : undefined
    );
    expect(
      resolveTemplateName(std, template({ name: 'Box', commandId: COMMAND.id }))
    ).toBe('Boîte');
  });

  it('a nameKey wins over commandId, with a provider registered', () => {
    const std = stdWith(key =>
      key === 'com.labre.templates.demo.link' ? 'Lien' : undefined
    );
    expect(
      resolveTemplateName(
        std,
        template({
          name: 'Link',
          commandId: COMMAND.id,
          nameKey: 'com.labre.templates.demo.link',
        })
      )
    ).toBe('Lien');
  });

  it('a nameKey with no provider shows the template’s own name, letter for letter', () => {
    const std = stdWith();
    expect(
      resolveTemplateName(
        std,
        template({
          name: 'Link',
          commandId: COMMAND.id,
          nameKey: 'com.labre.templates.demo.link',
        })
      )
    ).toBe('Link');
  });

  it('resolves through the command’s key even when the template’s own name diverges from the command’s label — the fallback stays the TEMPLATE’s wording, not the command’s', () => {
    // `edgy.addFacets`’s own label is "Enterprise Design facets"; its
    // tile has always said "Facets diagram" — a name of its own, and this is
    // the case that pattern models.
    const std = stdWith();
    expect(
      resolveTemplateName(
        std,
        template({ name: 'Facets diagram', commandId: COMMAND.id })
      )
    ).toBe('Facets diagram');

    const hosted = stdWith(key =>
      key === 'com.labre.commands.demo.addBox'
        ? 'Schéma des facettes'
        : undefined
    );
    expect(
      resolveTemplateName(
        hosted,
        template({ name: 'Facets diagram', commandId: COMMAND.id })
      )
    ).toBe('Schéma des facettes');
  });
});
