import { translateKey } from '@labre/affine-shared/services';
import { type Container, createIdentifier } from '@labre/global/di';
import {
  BlockComponent,
  CommandExtension,
  type BlockStdScope,
  BlockSelection,
  BlockViewIdentifier,
  TextSelection,
} from '@labre/std';
import { css, html } from 'lit';
import { literal } from 'lit/static-html.js';

import { DATABASE_PAGE_HOST_MISSING } from '../translations.js';
import { databasePageViewCommands } from './view-menu-commands.js';

const DATABASE_FLAVOUR = 'affine:database';

type Selection = BlockStdScope['selection']['value'][number];

type ModelLike = { id: string; parent: ModelLike | null };
type StoreLike = { getModelById(id: string): ModelLike | null };

/** The block whose `props.views` the full page shows, for its root view. */
export const DatabasePageHostBlockIdentifier = createIdentifier<{
  hostBlockId: string;
}>('AffineDatabasePageHostBlock');

/**
 * The extension that turns a page editor into the full page of one database
 * block: the document root draws `<affine-database-page-root>` instead of the
 * page root. `di.override` because the page scope already registered
 * `affine-page-root` for `affine:page`. It also registers the page's
 * "This view" commands (`view-menu-commands.ts`), which exist only here.
 */
export function databasePageRootExtension(hostBlockId: string) {
  return {
    setup: (di: Container) => {
      di.override(
        BlockViewIdentifier('affine:page'),
        () => literal`affine-database-page-root`
      );
      di.override(DatabasePageHostBlockIdentifier, () => ({ hostBlockId }));
      CommandExtension(databasePageViewCommands(hostBlockId)).setup(di);
    },
  };
}

function isUnder(
  store: StoreLike,
  hostBlockId: string,
  blockId: string,
  strictly: boolean
) {
  let model = store.getModelById(blockId);
  if (strictly) model = model?.parent ?? null;
  for (; model; model = model.parent) {
    if (model.id === hostBlockId) return true;
  }
  return false;
}

/**
 * Whether a selection may stand on the full page of `hostBlockId`.
 *
 * The keymaps of a flavour fire for any selection whose block has it among
 * its MODEL ancestors, drawn or not (`UIEventDispatcher.buildEventScope`): a
 * note's ⌘A, a paragraph's Backspace or the clipboard's cut would reach the
 * schema blocks beside the host (they carry `labre:sources`, labre ADR-0046)
 * through a selection on them, or the host itself through a block selection
 * on it. So a text or block selection must sit strictly inside the host (an
 * inline database's rows), and any other one (the database's own view
 * selection, an image inside a row) on the host or inside it.
 */
export function selectionStaysInHost(
  store: StoreLike,
  hostBlockId: string,
  selection: Selection
): boolean {
  if (selection instanceof TextSelection) {
    const { from, to } = selection;
    return (
      isUnder(store, hostBlockId, from.blockId, true) &&
      (!to || isUnder(store, hostBlockId, to.blockId, true))
    );
  }
  return isUnder(
    store,
    hostBlockId,
    selection.blockId,
    selection instanceof BlockSelection
  );
}

/**
 * The root of the full-page database (ADR 0035 §1, B13): it draws the host
 * database block alone, with its own widgets, and nothing else of the
 * document. No note, no schema block, none of the page root's widgets (drag
 * handle, block menu, slash menu, "Turn into" toolbar, box selection) and none
 * of its handlers (Backspace on a block selection, ⌘A, the click below the
 * last block that appends a paragraph): nothing on this page can select,
 * move or delete what it does not draw, and nothing inserts into the note.
 *
 * The page's look is not this root's: the block derives it from where it is
 * drawn (ADR 0035 amendment of 2026-10-28). Rendered directly by this root,
 * under a `<doc-title>` that names it as its body, it hides its own title
 * row, drops its top margin and keeps its view bar in view sideways
 * (`data-standalone`), and its table sticks its column header to the page
 * (`data-page-layout`). Mounted without that heading, the block renders as
 * inline, its title shown. This root only widens with such a table.
 *
 * It writes nothing, on mount or later. A document with no database block by
 * that id draws a notice; the block may arrive through sync, so the notice
 * follows additions and deletions.
 */
export class DatabasePageRoot extends BlockComponent {
  static override styles = css`
    affine-database-page-root {
      display: block;
      min-height: 100%;
      max-width: var(--affine-editor-width);
      margin: 0 auto;
      padding: 0 var(--affine-editor-side-padding, 24px);
    }
    /* A table laid out as the page is as wide as its columns
       (data-view's data-page-layout): the root grows with it, so the page
       scrolls sideways. A board keeps its own sideways scroller. */
    affine-database-page-root:has(dv-table-view-ui[data-page-layout]) {
      width: max-content;
      min-width: 100%;
    }
    /* A phone keeps the page root's narrow padding (page-root-block.ts). */
    @container viewport (width <= 640px) {
      affine-database-page-root {
        padding-left: 24px;
        padding-right: 24px;
      }
    }
    .affine-database-page-missing {
      padding: 16px 0;
      color: var(--affine-text-secondary-color);
      font-size: var(--affine-font-sm);
    }
  `;

  private get hostBlockId() {
    return this.std.get(DatabasePageHostBlockIdentifier).hostBlockId;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.disposables.add(
      this.store.slots.blockUpdated.subscribe(payload => {
        if (payload.type !== 'update') this.requestUpdate();
      })
    );
  }

  override renderBlock() {
    const host = this.store.getModelById(this.hostBlockId);
    const parent = host?.parent;
    if (!host || !parent || host.flavour !== DATABASE_FLAVOUR) {
      return html`<div
        class="affine-database-page-missing"
        data-testid="database-page-host-missing"
        role="status"
      >
        ${translateKey(this.std, ...DATABASE_PAGE_HOST_MISSING)}
      </div>`;
    }
    return this.host.renderChildren(parent, model => model.id === host.id);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-database-page-root': DatabasePageRoot;
  }
}
