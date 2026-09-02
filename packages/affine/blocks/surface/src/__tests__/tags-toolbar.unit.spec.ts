import {
  UniverseTagDefsProvider,
  type ToolbarContext,
  type UniverseTagDefs,
} from '@labre/affine-shared/services';
import { CommandIconsIdentifier } from '@labre/std';
import type { GfxModel, RoleDefs } from '@labre/std/gfx';
import {
  GfxGroupLikeElementModel,
  GfxPrimitiveElementModel,
} from '@labre/std/gfx';
import { render, svg, type TemplateResult } from 'lit';
import { describe, expect, it } from 'vitest';

import { tagsToolbarConfig } from '../extensions/tags-toolbar.js';

/**
 * MF3: the type-3 qualification entry of an element's contextual toolbar.
 *
 * This suite owns WHEN the entry stands up and WHICH element it answers for,
 * which is the whole of the config's own logic. What only a real editor can
 * answer — that it renders, writes through `tag.set` and disappears with the
 * flag — belongs to the integration suite.
 */

const ROLES: RoleDefs = {
  'wardley:component': { id: 'wardley:component', kind: 'node' },
  'wardley:market': {
    id: 'wardley:market',
    parent: 'wardley:component',
    kind: 'node',
  },
  'wardley:anchor': { id: 'wardley:anchor', kind: 'node' },
};

const PACK: UniverseTagDefs = {
  formatVersion: 1,
  packId: 'test-pack',
  framework: 'wardley',
  label: 'Wardley',
  tags: [
    {
      id: 'wardley:nature',
      label: 'Nature',
      cardinality: 'single',
      appliesTo: ['wardley:component'],
      values: [{ id: 'wardley:nature/data', label: 'Data' }],
    },
  ],
};

/**
 * An element that passes the config's `instanceof` gate without dragging a
 * surface, a Y.Doc and a renderer into a unit test.
 */
function element(role?: string): GfxModel {
  const el = Object.create(GfxPrimitiveElementModel.prototype) as GfxModel;
  Object.defineProperty(el, 'role', { value: role, configurable: true });
  Object.defineProperty(el, 'tags', { value: undefined, configurable: true });
  return el;
}

/** A canvas group holding the given children — what one click actually selects. */
function group(...children: GfxModel[]): GfxModel {
  const g = Object.create(GfxGroupLikeElementModel.prototype) as GfxModel;
  Object.defineProperty(g, 'role', { value: undefined, configurable: true });
  Object.defineProperty(g, 'childElements', {
    value: children,
    configurable: true,
  });
  return g;
}

function context(
  models: GfxModel[],
  packs: UniverseTagDefs[] = [PACK],
  icons: Record<string, TemplateResult> = {}
) {
  // A fresh `std` per context: the registry is memoized per scope, so sharing
  // one would leak a previous test's packs.
  const std = {
    provider: {
      getAll: (id: unknown) => {
        if (id === UniverseTagDefsProvider) {
          return new Map(packs.map(pack => [pack.packId, pack]));
        }
        // The icon tables a framework registers with `IconTableExtension` —
        // the same identifier a command's icons land on, because an icon key
        // is an icon key.
        if (id === CommandIconsIdentifier) return new Map([['icons', icons]]);
        return new Map();
      },
    },
    getOptional: () => undefined,
  };
  return {
    std,
    getSurfaceModels: () => models,
  } as unknown as ToolbarContext;
}

const config = tagsToolbarConfig(ROLES);

const stands = (ctx: ToolbarContext) => {
  const { when } = config;
  return typeof when === 'function' ? when(ctx) : Boolean(when);
};

describe('when the qualification entry stands up', () => {
  it('does, on a single element whose role a seeded tag qualifies', () => {
    expect(stands(context([element('wardley:component')]))).toBe(true);
  });

  it('does, through specialisation', () => {
    // `market` specialises `component`, so a tag declared on the parent reaches
    // it — resolved with `roleIsA` against the registrar's own vocabulary.
    expect(stands(context([element('wardley:market')]))).toBe(true);
  });

  it('does not, on a role no tag applies to', () => {
    // A user / need has no nature; `anchor` is deliberately not a child of
    // `component`.
    expect(stands(context([element('wardley:anchor')]))).toBe(false);
  });

  it('does not, on a neutral element', () => {
    // Absent `role` means NEUTRAL, full stop — never "infer one from the shape
    // type". A plain rectangle is a rectangle.
    expect(stands(context([element()]))).toBe(false);
  });

  it('does not, when no pack was seeded', () => {
    // Flag off, or a host that seeded nothing: a picker with nothing in it is
    // chrome that decides nothing.
    expect(stands(context([element('wardley:component')], []))).toBe(false);
  });

  it('does not, on an empty selection', () => {
    expect(stands(context([]))).toBe(false);
  });

  it('does not, on a multi-selection', () => {
    // A qualification is one decision about one thing; two elements with two
    // roles have no honest current value to show.
    expect(
      stands(context([element('wardley:component'), element('wardley:market')]))
    ).toBe(false);
  });

  it('does not, on something that is not a surface element', () => {
    const block = {
      id: 'note',
      role: 'wardley:component',
    } as unknown as GfxModel;
    expect(stands(context([block]))).toBe(false);
  });

  it('does not offer a deprecated tag', () => {
    const retired: UniverseTagDefs = {
      ...PACK,
      tags: [{ ...PACK.tags[0], deprecated: true }],
    };
    // Ids are forever, so the def survives — it is just out of the picker.
    expect(stands(context([element('wardley:component')], [retired]))).toBe(
      false
    );
  });
});

describe('which element answers for the qualification', () => {
  it('resolves through a group to its single QUALIFIABLE member', () => {
    // A Wardley component is an ellipse and a free text grouped together, so a
    // single click selects the GROUP, which carries no role of its own. Making
    // the user enter the group to find the qualification would bury it.
    //
    // Note that BOTH members are roled — a Wardley label has a role of its own
    // (PF13.4) — so the discriminator cannot be "carries a role". Only the node
    // is something a nature is a fact about.
    const node = element('wardley:component');
    const label = element('wardley:label');
    expect(stands(context([group(node, label)]))).toBe(true);
  });

  it('stands down when a group holds two qualifiable members', () => {
    // Two artefacts in one group: there is no single answer, and reporting
    // "no entry" is better than picking the first.
    expect(
      stands(
        context([
          group(element('wardley:component'), element('wardley:market')),
        ])
      )
    ).toBe(false);
  });

  it('stands down on a group of nothing roled', () => {
    expect(stands(context([group(element(), element())]))).toBe(false);
  });

  it('stands down on a group whose members no tag applies to', () => {
    expect(stands(context([group(element('wardley:anchor'), element())]))).toBe(
      false
    );
  });

  it('answers for the element itself when it is the qualifiable one', () => {
    // A group that somehow carried a qualifiable role answers for itself; the
    // descent is a fallback, not a rule.
    const g = group(element('wardley:label'));
    Object.defineProperty(g, 'role', {
      value: 'wardley:component',
      configurable: true,
    });
    expect(stands(context([g]))).toBe(true);
  });
});

describe('the entry is generic', () => {
  it('names no framework: it reads the seeded packs and the given roles', () => {
    const other: UniverseTagDefs = {
      formatVersion: 1,
      packId: 'bpmn-pack',
      framework: 'bpmn',
      label: 'BPMN',
      tags: [
        {
          id: 'bpmn:lane-kind',
          label: 'Lane',
          cardinality: 'single',
          appliesTo: '*',
          values: [{ id: 'bpmn:lane-kind/pool', label: 'Pool' }],
        },
      ],
    };
    const bpmnRoles: RoleDefs = {
      'bpmn:task': { id: 'bpmn:task', kind: 'node' },
    };

    // Same config factory, another framework's vocabulary and another pack.
    // Nothing here changes.
    expect(
      typeof tagsToolbarConfig(bpmnRoles).when === 'function' &&
        (tagsToolbarConfig(bpmnRoles).when as (c: ToolbarContext) => boolean)(
          context([element('bpmn:task')], [other])
        )
    ).toBe(true);
  });

  it("a wildcard pack does not qualify another framework's roles", () => {
    const wildcard: UniverseTagDefs = {
      ...PACK,
      packId: 'wildcard',
      tags: [{ ...PACK.tags[0], appliesTo: '*' }],
    };
    // `'*'` means "every role of THIS framework". Crossing the boundary is what
    // namespacing exists to prevent.
    expect(stands(context([element('edgy:activity')], [wildcard]))).toBe(false);
    expect(stands(context([element('wardley:anchor')], [wildcard]))).toBe(true);
  });
});

/**
 * The icon a tag VALUE may carry (PO recette of 02/09/2026).
 *
 * A pack is host-extensible DATA and may ship as a `.json` asset, so a value
 * names a key and never a template; the drawing comes from a table the
 * framework registers, and both ends of that seam are optional. What is pinned
 * here is that a value with no icon renders as it always has.
 */
describe('the icon of a tag value', () => {
  it('renders a value icon only when the pack names one AND it resolves', () => {
    // The PO asked for the four Wardley natures to be pictured (recette of
    // 02/09/2026). The seam that makes it possible without breaking a host's
    // own packs is asserted here, three ways at once: a pack carries an icon
    // KEY (it may ship as `.json`, so it can carry nothing else), the drawing
    // comes from a registered table, and a value with neither renders exactly
    // as it always has.
    const pack: UniverseTagDefs = {
      ...PACK,
      tags: [
        {
          ...PACK.tags[0],
          values: [
            { id: 'wardley:nature/data', label: 'Data', iconKey: 'demo.data' },
            // A key no table answers — a framework switched off, or a host pack
            // whose icons this build does not ship.
            {
              id: 'wardley:nature/practice',
              label: 'Practice',
              iconKey: 'demo.missing',
            },
            // ...and the pack that never heard of icons: every host pack today.
            { id: 'wardley:nature/knowledge', label: 'Knowledge' },
          ],
        },
      ],
    };
    const icons: Record<string, TemplateResult> = {
      'demo.data': svg`<svg data-testid="demo-glyph" viewBox="0 0 24 24"></svg>`,
    };

    const ctx = context([element('wardley:component')], [pack], icons);
    const action = config.actions?.[0] as {
      content: (c: ToolbarContext) => TemplateResult | null;
    };
    const template = action.content(ctx);
    expect(template).not.toBeNull();

    const host = document.createElement('div');
    document.body.append(host);
    try {
      render(template, host);
      const options = Array.from(
        host.querySelectorAll<HTMLElement>('[data-testid="element-tag-option"]')
      );
      expect(options.map(o => o.dataset.valueId)).toEqual([
        'wardley:nature/data',
        'wardley:nature/practice',
        'wardley:nature/knowledge',
      ]);
      // Resolved: the glyph is drawn, and the label is still there beside it.
      expect(
        options[0].querySelector('[data-testid="element-tag-option-icon"]')
      ).toBeTruthy();
      expect(
        options[0].querySelector('[data-testid="demo-glyph"]')
      ).toBeTruthy();
      expect(options[0].textContent).toContain('Data');
      // Unresolved, and absent: no glyph, no placeholder, and the label — the
      // one thing the row is FOR — untouched in both.
      for (const option of [options[1], options[2]]) {
        expect(
          option.querySelector('[data-testid="element-tag-option-icon"]'),
          option.dataset.valueId
        ).toBeNull();
      }
      expect(options[1].textContent).toContain('Practice');
      expect(options[2].textContent).toContain('Knowledge');
    } finally {
      host.remove();
    }
  });
});
