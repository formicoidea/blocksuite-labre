import { POPUP_ROOT_ATTR } from '@labre/affine-components/context-menu';
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
      height: 100%;
    }
    /* The page's only scroller, in both directions: the heading and the
       views scroll as one page, and a wide table widens the page instead of
       scrolling inside it (labre recette of 2026-10-26: a host viewport
       around this one showed two scrollbars, then the column header, put
       back by script on each scroll of a table that scrolled sideways
       itself, jumped). */
    affine-database-page > .affine-page-viewport {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: auto;
      /* The container the heading's narrow-screen query reads (doc-title,
         outside the editor). Never a width to size with: on a scroller,
         Chrome's 100cqw counts its vertical scrollbar (the editor-host
         rule below). */
      container-type: inline-size;
      container-name: viewport;
      /* A wide table scrolled sideways fades into the gutters instead of
         being cut at the page's edges (labre recette of 2.0). The fade
         stays in the gutter (at most 24px, the phone's), so nothing at
         rest is faded. Its layer covers the padding box only: the two
         layers below it give back the scrollbars, which sit between the
         padding box and the border box. */
      --affine-database-page-fade: min(
        var(--affine-editor-side-padding, 24px),
        24px
      );
      mask:
        linear-gradient(
            to right,
            transparent,
            #000 var(--affine-database-page-fade),
            #000 calc(100% - var(--affine-database-page-fade)),
            transparent
          )
          padding-box add,
        linear-gradient(#000 0 0) border-box exclude,
        linear-gradient(#000 0 0) padding-box;
    }
    /* The editor takes the height the heading leaves (std gives it 100%,
       which overflowed by the heading's height: a scrollbar on a short
       table).
       It is also the container the page's widths read (the root's inset,
       its narrow-screen query, the block's sticky view bar): a child of
       the scroller, its width is the visible one. The scroller's own 100cqw
       counted its vertical scrollbar, so as soon as a base scrolled down
       the page overflowed sideways by that scrollbar's width and showed a
       horizontal one (labre recette of 2.1). */
    affine-database-page > .affine-page-viewport > editor-host {
      flex: 1 0 auto;
      height: auto;
      container-type: inline-size;
      container-name: viewport;
    }
    /* The heading stays in view when the page scrolls sideways, as wide as
       the scroller shows (100%, not the scroller's 100cqw: see above). */
    affine-database-page > .affine-page-viewport > doc-title {
      position: sticky;
      left: 0;
      width: 100%;
    }
    /* A database page is a table, not a text: the heading sits on the view
       bar, without the page title's bottom padding, its band's, or the
       block's top margin and padding (the root's rule). */
    affine-database-page
      > .affine-page-viewport
      > doc-title
      .doc-title-container,
    affine-database-page > .affine-page-viewport > doc-title .doc-title-band {
      padding-bottom: 0;
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
    // The popups of the page hang here, beside its viewport: the viewport
    // masks and contains what it holds, so a menu hung in the editor was cut
    // at its edges, under the host's sidebar (labre recette of 2.4).
    this.setAttribute(POPUP_ROOT_ATTR, '');
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
    // The page viewport the page extensions, and `<doc-title>`, look for
    // above their host.
    return html`<div class="affine-page-viewport">
      ${this.heading ?? nothing}${this.editorHost ?? nothing}
    </div>`;
  }

  @property({ attribute: false })
  accessor store!: BlockStdOptions['store'];

  /** The page-scope view extensions the host mounts its page editor with. */
  @property({ attribute: false })
  accessor extensions: BlockStdOptions['extensions'] = [];

  /**
   * The page title the host draws above the views, a `<doc-title>` with its
   * `bodyBlockId` set to `hostBlockId`. The page renders it inside its own
   * viewport, so the title and the views scroll as one page; it shows before
   * the editor exists.
   */
  @property({ attribute: false })
  accessor heading: HTMLElement | null = null;

  /** The id of the `affine:database` block whose `props.views` the page shows. */
  @property({ attribute: false })
  accessor hostBlockId = '';
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-database-page': DatabasePageHost;
  }
}
