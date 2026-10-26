import {
  generateKeyBetween,
  SURFACE_TEXT_UNIQ_IDENTIFIER,
  SURFACE_YMAP_UNIQ_IDENTIFIER,
} from '@labre/std/gfx';

/** A surface-elements map as it appears inside a template's DocSnapshot. */
export type SurfaceElementsJSON = Record<string, Record<string, unknown>>;

/** A block the surface holds (a frame), as it appears inside a DocSnapshot. */
export type SurfaceChildBlockJSON = {
  type: 'block';
  id: string;
  flavour: string;
  props: Record<string, unknown>;
  children: [];
};

/**
 * Serialize a plain string into the surface `Y.Text` JSON form used inside
 * snapshots (the shape inner-text / label field). Mirrors what
 * `SurfaceBlockTransformer.toSnapshot` would emit, so templates can be
 * hand-authored without a live document.
 */
export function surfaceText(text: string) {
  return {
    [SURFACE_TEXT_UNIQ_IDENTIFIER]: true,
    delta: text ? [{ insert: text }] : [],
  };
}

/**
 * Serialize a plain record into the surface `Y.Map` JSON form used inside
 * snapshots — a group's `children`, a mindmap's node table. Same seam as
 * {@link surfaceText}: what `SurfaceBlockTransformer.toSnapshot` emits.
 */
export function surfaceYMap(json: Record<string, unknown>) {
  return {
    [SURFACE_YMAP_UNIQ_IDENTIFIER]: true,
    json,
  };
}

/**
 * Wrap a surface-elements map into the minimal `page → surface` DocSnapshot a
 * template's `content` expects. Block/element ids are remapped on insert by the
 * template job's `replaceIdMiddleware`.
 *
 * Z-order indices are regenerated on insert too, but IN THE SNAPSHOT'S OWN
 * ORDER: `createRegenerateIndexMiddleware` sorts the elements by their `index`
 * (group-aware) and only then mints fresh keys — and it skips any element that
 * carries no `index` at all. So a missing `index` is filled in here, in key
 * (insertion) order, which is the order a creation action added the elements.
 *
 * `blocks` are the surface's own child blocks — a slide mask's frame. They
 * keep the props they are given: the template job remaps their ids, their
 * `childElementIds` and their `index` on insert like any frame's.
 */
export function makeTemplateSnapshot(
  elements: SurfaceElementsJSON,
  title = 'Template',
  blocks: SurfaceChildBlockJSON[] = []
) {
  const indexed: SurfaceElementsJSON = {};
  let last: string | null = null;

  for (const [id, element] of Object.entries(elements)) {
    const copy = { ...element };
    // The middleware keys its fresh indexes by the element's OWN `id` field,
    // not by the map key: a hand-written element without one would collect
    // every other element's key under `undefined` and land at one shared depth.
    if (copy['id'] === undefined) copy['id'] = id;
    // A group's title is a Y.Text the model initialises at creation and reads
    // back unguarded when it paints (`group.title.toString()`): a group written
    // without one lands with no key at all, and the renderer threw on every
    // frame — the inserted map showed its background and nothing else
    // (recette of 09/09/2026).
    if (copy['type'] === 'group' && copy['title'] === undefined) {
      copy['title'] = surfaceText('');
    }
    if (copy['index'] === undefined) {
      last = generateKeyBetween(last, null);
      copy['index'] = last;
    }
    indexed[id] = copy;
  }

  return {
    type: 'page',
    meta: {
      id: 'doc:template',
      title,
      createDate: 1700000000000,
      tags: [],
    },
    blocks: {
      type: 'block',
      id: 'block:template-page',
      flavour: 'affine:page',
      props: {
        title: {
          '$blocksuite:internal:text$': true,
          delta: title ? [{ insert: title }] : [],
        },
      },
      children: [
        {
          type: 'block',
          id: 'block:template-surface',
          flavour: 'affine:surface',
          props: { elements: indexed },
          children: blocks,
        },
      ],
    },
  };
}
