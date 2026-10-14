import { translateKey } from '@labre/affine-shared/services';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import {
  BLOCK_ID_ATTR,
  type BlockStdScope,
  type EditorHost,
  ShadowlessElement,
} from '@labre/std';
import { css, html, nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';

import { DATABASE_PAGE_HOST_MISSING } from '../translations.js';

const DATABASE_FLAVOUR = 'affine:database';

/**
 * The rules that turn the editor of a database document into its full page,
 * scoped to `hostBlockId`: every other database block of the document is
 * not drawn (a host keeps one schema block per source beside the views'
 * block, labre ADR-0046 §3; they hold no view and draw nothing anyway), and
 * the views' block loses its own title row, the page title above it being the
 * database's name. `CSS.escape` makes any id a valid string in the selector,
 * and the rules are set as text, never parsed as markup.
 */
export function databasePageRules(hostBlockId: string): string {
  const host = `affine-database[${BLOCK_ID_ATTR}="${CSS.escape(hostBlockId)}"]`;
  return [
    `affine-database-page affine-database:not(${host}) { display: none; }`,
    `affine-database-page ${host} div:has(> affine-database-title) { display: none; }`,
  ].join('\n');
}

/**
 * The full-page database host (ADR 0035 §1, B13; labre PRD REQ-DB-7).
 *
 * The full page is the inline table view moved to a page, not a second
 * drawing: the host builds a `BlockStdScope` on the database document with
 * its usual page extensions (the database block with its view bar and its
 * presets, its `DatabaseDataSourceProvider` answering a `HostedDataSourceBase`
 * for the block's `externalSourceId`, this bundle's extensions) and mounts
 * `<affine-database-page .std=${std} .hostBlockId=${id}>` where it would
 * mount `std.render()`. The element renders that editor once per `std` and
 * only scopes what it shows (`databasePageRules`): the same block component,
 * view engine, cells, toolbar and row opening as inline.
 *
 * It writes nothing, on mount or later; which block hosts the views is the
 * host's format, passed in, never read from the document. A document with no
 * block by that id draws a notice above the editor and none of its database
 * blocks.
 */
export class DatabasePageHost extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    affine-database-page {
      display: block;
    }
    .affine-database-page-missing {
      padding: 16px 0;
      color: var(--affine-text-secondary-color);
      font-size: var(--affine-font-sm);
    }
  `;

  private editorHost: EditorHost | undefined = undefined;

  /** The store whose blocks this connection watches. */
  private watched: BlockStdScope['store'] | undefined = undefined;

  protected override willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    // `std.render()` builds a new editor host each call: once per scope.
    if (changed.has('std')) {
      this.editorHost = this.std?.render();
    }
  }

  protected override updated(changed: PropertyValues<this>) {
    super.updated(changed);
    const store = this.std?.store;
    if (!store || store === this.watched) return;
    this.watched = store;
    // The views' block may arrive through sync after the first draw, or
    // leave: the notice follows it.
    this.disposables.add(
      store.slots.blockUpdated.subscribe(payload => {
        if (payload.type !== 'update') this.requestUpdate();
      })
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.watched = undefined;
  }

  private hostIsDatabase() {
    const block = this.std.store.getBlock(this.hostBlockId);
    return block?.model.flavour === DATABASE_FLAVOUR;
  }

  override render() {
    if (!this.std) return nothing;
    const missing = !this.hostIsDatabase();
    return html`<style>
        ${databasePageRules(this.hostBlockId)}
      </style>
      ${missing
        ? html`<div
            class="affine-database-page-missing"
            data-testid="database-page-host-missing"
            role="status"
          >
            ${translateKey(this.std, ...DATABASE_PAGE_HOST_MISSING)}
          </div>`
        : nothing}
      ${this.editorHost}`;
  }

  @property({ attribute: false })
  accessor std!: BlockStdScope;

  /** The id of the `affine:database` block whose `props.views` the page shows. */
  @property({ attribute: false })
  accessor hostBlockId = '';
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-database-page': DatabasePageHost;
  }
}
