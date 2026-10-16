import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import {
  type BlockStdOptions,
  BlockStdScope,
  type EditorHost,
  ShadowlessElement,
} from '@labre/std';
import { css, html, nothing, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';

import {
  databasePageRootExtension,
  selectionStaysInHost,
} from './database-page-root.js';

/** A drag carrying files: the page root's file drop would insert blocks. */
function stopFileDrop(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return;
  event.preventDefault();
  event.stopPropagation();
  event.dataTransfer.dropEffect = 'none';
}

/**
 * The full-page database host (ADR 0035 §1, B13; labre PRD REQ-DB-7).
 *
 * The full page is the inline table view moved to a page, not a second
 * drawing: the host mounts `<affine-database-page .store .extensions
 * .hostBlockId>` with the database document's store and its usual page
 * extensions (the database block with its view bar and presets, its
 * `DatabaseDataSourceProvider` answering a `HostedDataSourceBase`, this
 * bundle's extensions). The element builds the editor itself, adding
 * `databasePageRootExtension`, so the root draws the host database block
 * alone (`DatabasePageRoot`): the same block component, view engine, cells
 * and row opening as inline.
 *
 * Two guards keep what the page does not draw out of reach, at the model and
 * the event level rather than in CSS: the selection of the store is held to
 * the host (`selectionStaysInHost`, the first subscriber of the editor, so
 * every gesture reads the held selection), and a drag carrying files never
 * reaches the editor's file drop. The schema blocks beside the host carry
 * the sources (`labre:sources`, labre ADR-0046 §3): losing one loses the
 * database. The guard owns the store's selection, so nothing else mounts on
 * that store meanwhile.
 *
 * It writes nothing, on mount or later.
 */
export class DatabasePageHost extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    affine-database-page {
      display: block;
    }
    affine-database-page > .affine-page-viewport {
      height: 100%;
      /* The container the page root's narrow-screen query reads. */
      container-type: inline-size;
      container-name: viewport;
    }
  `;

  private _std: BlockStdScope | undefined = undefined;

  private editorHost: EditorHost | undefined = undefined;

  private guard: { unsubscribe(): void } | undefined = undefined;

  /** The editor of the page, once `store` and `hostBlockId` are set. */
  get std(): BlockStdScope | undefined {
    return this._std;
  }

  private holdSelection() {
    this.guard?.unsubscribe();
    this.guard = undefined;
    const std = this._std;
    if (!std || !this.isConnected) return;
    const { store, hostBlockId } = this;
    this.guard = std.selection.slots.changed.subscribe(selections => {
      const kept = selections.filter(selection =>
        selectionStaysInHost(store, hostBlockId, selection)
      );
      if (kept.length !== selections.length) std.selection.set(kept);
    });
  }

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener('dragover', stopFileDrop, true);
    this.addEventListener('drop', stopFileDrop, true);
    this.holdSelection();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('dragover', stopFileDrop, true);
    this.removeEventListener('drop', stopFileDrop, true);
    this.guard?.unsubscribe();
    this.guard = undefined;
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    if (
      !changed.has('store') &&
      !changed.has('extensions') &&
      !changed.has('hostBlockId')
    ) {
      return;
    }
    this._std =
      this.store && this.hostBlockId
        ? new BlockStdScope({
            store: this.store,
            extensions: [
              ...this.extensions,
              databasePageRootExtension(this.hostBlockId),
            ],
          })
        : undefined;
    this.holdSelection();
    // `std.render()` builds a new editor host each call: once per editor.
    this.editorHost = this._std?.render();
  }

  override render() {
    if (!this.editorHost) return nothing;
    // The page viewport the page extensions look for above their host.
    return html`<div class="affine-page-viewport">${this.editorHost}</div>`;
  }

  @property({ attribute: false })
  accessor store!: BlockStdOptions['store'];

  /** The page-scope view extensions the host mounts its page editor with. */
  @property({ attribute: false })
  accessor extensions: BlockStdOptions['extensions'] = [];

  /** The id of the `affine:database` block whose `props.views` the page shows. */
  @property({ attribute: false })
  accessor hostBlockId = '';
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-database-page': DatabasePageHost;
  }
}
