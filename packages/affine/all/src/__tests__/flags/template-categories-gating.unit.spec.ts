import { ViewExtensionManager } from '@labre/affine-ext-loader';
import {
  TemplateCategoryIdentifier,
  templateManagerFor,
} from '@labre/affine-gfx-template';
import { Container } from '@labre/global/di';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, test } from 'vitest';

import { getInternalViewExtensions } from '../../extensions/view.js';
import { type BlockFlags, OPTIONAL_BLOCKS } from '../../flags.js';

/**
 * A Templates-panel category is TOOLING (`docs/adr/0009`): it is a way to
 * CREATE a Wardley map, not a thing a stored map needs in order to open. So a
 * framework whose flag is off contributes none — the drawing still paints, the
 * shelf that offers a new one is gone.
 *
 * What this file really pins is WHERE the list lives. Until 0.38.2 a category
 * was appended to a module-level Set from `effect()`, which runs once per
 * process: the list outlived the editor whose flags had admitted it, so an
 * editor mounted AFTER a framework was switched off still showed that
 * framework's category until the page was reloaded (#244). Categories are now
 * read from the DI container the view extensions mounted on — one container per
 * editor — so the third test below, two mounts in one process, is the whole
 * point of the change rather than an extra.
 *
 * `Other` never appears here: it is built in (`builtInTemplates`), it belongs to
 * no framework and no flag can take it away. The last test is where the two
 * halves are read together, the way the panel reads them.
 */

/** Every optional block AND every framework switched off. */
const ALL_OFF = Object.fromEntries(
  OPTIONAL_BLOCKS.map(block => [block, false])
) as BlockFlags;

const ALL_ON: BlockFlags = {};

/**
 * The twelve categories the assembly contributes with everything on — the
 * framework half of the catalogue, sorted so the list reads as a SET and a
 * reordering of `extensions/view.ts` does not break it.
 */
const ALL_CATEGORIES = [
  'Aggregate Design Canvas',
  'BPMN',
  'C4',
  'Context Map',
  'Core Domain Chart',
  'Cynefin',
  'EDGY',
  'Estuarine',
  'Event Storming',
  'Mind Map',
  'UML',
  'Wardley',
].sort();

/** Mount the view extensions of one scope for real, exactly as std does. */
function mountProvider(scope: 'page' | 'edgeless', flags: BlockFlags) {
  const manager = new ViewExtensionManager(getInternalViewExtensions(flags));
  const container = new Container();
  manager.get(scope).forEach(ext => ext.setup(container));
  return container.provider();
}

/** What the panel of an editor built on that provider would offer. */
function categoriesOf(provider: ReturnType<typeof mountProvider>) {
  return [...provider.getAll(TemplateCategoryIdentifier).values()]
    .map(category => category.name)
    .sort();
}

describe('the Templates-panel categories are flag-gated tooling', () => {
  test('every framework contributes its category with the flags on', () => {
    // Twelve names, one per framework module that ships templates. `Other` is
    // NOT among them — it is built in, not contributed — and reading it here
    // would mean a framework had claimed the generic category.
    expect(categoriesOf(mountProvider('edgeless', ALL_ON))).toEqual(
      ALL_CATEGORIES
    );
    expect(categoriesOf(mountProvider('edgeless', ALL_ON))).not.toContain(
      'Other'
    );
  });

  test('with everything off, only Mind Map is left', () => {
    // Mind Map is the one category registered from an ALWAYS-ON extension
    // (`MindmapRenderViewExtension`), and that is deliberate rather than an
    // oversight the flags forgot: `mindmap` gates the senior BUTTON, while the
    // mindmap renderer — and the templates that produce one — ship with every
    // build. Everything else went away with its framework's flag.
    expect(categoriesOf(mountProvider('edgeless', ALL_OFF))).toEqual([
      'Mind Map',
    ]);
  });

  test('a second editor sees the flags it was mounted with, not the first one', () => {
    // #244, in the shape the module-level Set could not survive. Mount
    // everything first, in the same process…
    expect(categoriesOf(mountProvider('edgeless', ALL_ON))).toEqual(
      ALL_CATEGORIES
    );

    // …then mount a second editor with two frameworks switched off. The old
    // registry answered with the union of both mounts, because a category was
    // appended from `effect()` and nothing ever removed it; a container is per
    // editor, so this one answers about ITSELF.
    const second = categoriesOf(
      mountProvider('edgeless', { wardley: false, 'cynefin-estuarine': false })
    );

    expect(second).not.toContain('Wardley');
    expect(second).not.toContain('Cynefin');
    expect(second).not.toContain('Estuarine');
    // …and the flag took away exactly its own framework's shelf: everything
    // else is still offered, which is what tells a broken container apart from
    // a container that simply failed to register.
    expect(second).toEqual(
      ALL_CATEGORIES.filter(
        name => !['Wardley', 'Cynefin', 'Estuarine'].includes(name)
      )
    );
  });

  test('the page scope contributes no category at all', () => {
    // The Templates panel is an edgeless affordance, so every registration sits
    // behind `isEdgeless(context.scope)` — including Mind Map's, which is
    // otherwise the one that ignores its flag. A category leaking into the page
    // container would be a shelf no page editor can open.
    expect(categoriesOf(mountProvider('page', ALL_ON))).toEqual([]);
  });

  test('the panel reads the built-in half first, then the contributed one', async () => {
    // What `EdgelessTemplatePanel.catalogue` answers, on the std of an editor
    // with everything off: `Other` comes from `builtInTemplates` and is always
    // there, Mind Map from the container. The ORDER is the panel's tab order —
    // the generic diagrams first, the frameworks after — so it is worth pinning
    // even though the set above is not.
    const provider = mountProvider('edgeless', ALL_OFF);
    const catalogue = templateManagerFor({
      provider,
    } as unknown as BlockStdScope);

    await expect(catalogue.categories()).resolves.toEqual([
      'Other',
      'Mind Map',
    ]);
  });
});
