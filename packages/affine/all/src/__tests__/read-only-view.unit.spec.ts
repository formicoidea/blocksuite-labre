/**
 * GUARD — the read-only canvas viewer is the edgeless editor minus its
 * tooling, derived from the registry (ADR 0051).
 *
 * The viewer holds no rendering of its own: it mounts the providers of
 * `getInternalViewExtensions` (every flag on) and the host's, minus
 * `READ_ONLY_EXCLUDED_VIEW_EXTENSIONS` and `READ_ONLY_EXCLUDED_EXTENSIONS`.
 * This spec reads what each side registers in a real DI container, by
 * identifier: the editor's side from the registry, the viewer's from
 * `getReadOnlyViewExtensions`, the very list `mountCanvasViewer` mounts.
 *
 * What it would catch:
 * - a provider or an extension on the exclusion lists that paints content (a
 *   block view, a canvas element's view or renderer): a published page would
 *   silently lose that block or that notation;
 * - anything the editor registers that the viewer lacks without being
 *   excluded, i.e. a composition that drifts from "the registry minus the
 *   list" (another scope, a filter added by hand);
 * - a stale entry: an excluded provider gone from the registry, an excluded
 *   extension no kept provider registers;
 * - a frame shown without its title badge, or with the editor's editing bar
 *   (PO acceptance of Labre Sites: an inserted frame shows its badge as in
 *   the editor, without the toolbar). A widget is not "content" to the rule
 *   above, since the excluded editing widgets register as widgets too, so the
 *   badge is named here.
 */
import type { ViewExtensionProvider } from '@labre/affine-ext-loader';
import { ViewExtensionManager } from '@labre/affine-ext-loader';
import { Container } from '@labre/global/di';
import type { ExtensionType } from '@labre/store';
import { describe, expect, test } from 'vitest';

import {
  getInternalViewExtensions,
  getReadOnlyViewExtensions,
  getReadOnlyViewProviders,
  READ_ONLY_EXCLUDED_EXTENSIONS,
  READ_ONLY_EXCLUDED_VIEW_EXTENSIONS,
} from '../extensions/view.js';

type Provider = typeof ViewExtensionProvider;

/** Identifier names that paint content: none may be excluded. */
const CONTENT = [
  /^BlockView$/,
  /^GfxElementModelView$/,
  /^element-renderer$/,
  /^affine\.surface\.dom-element-renderer\./,
  /^AffineInlineSpec$/,
];
const isContent = (key: string) =>
  CONTENT.some(pattern => pattern.test(key.split('|')[0] ?? ''));

/** Every `name|variant` the extensions register, in a real container. */
function registeredKeys(extensions: readonly ExtensionType[]): Set<string> {
  const container = new Container();
  extensions.forEach(extension => extension.setup(container));
  const services = (
    container as unknown as {
      services: Map<string, Map<string, Map<unknown, unknown>>>;
    }
  ).services;
  const keys = new Set<string>();
  services.forEach(byName =>
    byName.forEach((byVariant, name) =>
      byVariant.forEach((_, variant) =>
        // A variant numbered at registration (`Command-24`) differs from one
        // container to the next: its counter is not part of the identity.
        keys.add(`${name}|${String(variant).replace(/-\d+$/, '')}`)
      )
    )
  );
  return keys;
}

/** What one provider registers in the editor's scope. */
function extensionsOf(provider: Provider): ExtensionType[] {
  const extensions: ExtensionType[] = [];
  const context = {
    scope: 'edgeless' as const,
    register(added: ExtensionType | ExtensionType[]) {
      extensions.push(...(Array.isArray(added) ? added : [added]));
      return context;
    },
  };
  new provider().setup(context);
  return extensions;
}

const editorProviders = getInternalViewExtensions() as Provider[];
const editor = registeredKeys(
  new ViewExtensionManager(editorProviders).get('edgeless')
);
// The very list `mountCanvasViewer` mounts, not a recomposition of it.
const viewer = registeredKeys(getReadOnlyViewExtensions());
const excluded = registeredKeys([
  ...[...READ_ONLY_EXCLUDED_VIEW_EXTENSIONS].flatMap(extensionsOf),
  ...READ_ONLY_EXCLUDED_EXTENSIONS,
]);

describe('the read-only viewer is the editor minus its tooling', () => {
  test('no excluded provider or extension paints content', () => {
    expect([...excluded].filter(isContent)).toEqual([]);
  });

  test('everything the editor registers is in the viewer, or excluded', () => {
    const missing = [...editor].filter(
      key => !viewer.has(key) && !excluded.has(key)
    );
    expect(missing).toEqual([]);
  });

  test('every content registration of the editor reaches the viewer', () => {
    const lost = [...editor].filter(key => isContent(key) && !viewer.has(key));
    expect(lost).toEqual([]);
  });

  test('the exclusion lists hold no stale entry', () => {
    expect(
      [...READ_ONLY_EXCLUDED_VIEW_EXTENSIONS].filter(
        provider => !editorProviders.includes(provider)
      )
    ).toEqual([]);
    const kept = editorProviders.filter(
      provider => !READ_ONLY_EXCLUDED_VIEW_EXTENSIONS.has(provider)
    );
    const keptExtensions = new Set(kept.flatMap(extensionsOf));
    expect(
      [...READ_ONLY_EXCLUDED_EXTENSIONS].filter(
        extension => !keptExtensions.has(extension)
      )
    ).toEqual([]);
  });

  test('a frame keeps its title badge and loses the editing toolbars', () => {
    const widgets = (keys: Set<string>) =>
      [...keys].filter(key => key.startsWith('WidgetView|'));
    expect(
      widgets(viewer).filter(key => key.includes('affine-frame-title-widget'))
    ).not.toEqual([]);
    expect(
      widgets(viewer).filter(key =>
        /affine-toolbar-widget|edgeless-toolbar-widget|affine-edgeless-zoom-toolbar-widget/.test(
          key
        )
      )
    ).toEqual([]);
  });

  test("the host's providers join the viewer once, never the excluded ones", () => {
    const [first] = editorProviders;
    const [excludedOne] = [...READ_ONLY_EXCLUDED_VIEW_EXTENSIONS];
    if (!first || !excludedOne) throw new Error('an empty registry');
    const providers = getReadOnlyViewProviders([first, excludedOne]);
    expect(providers.filter(provider => provider === first)).toHaveLength(1);
    expect(providers).not.toContain(excludedOne);
  });
});
