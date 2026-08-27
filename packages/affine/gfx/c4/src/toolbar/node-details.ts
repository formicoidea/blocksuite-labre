import type { C4NodeElementModel } from '@labre/affine-model';
import { WithDisposable } from '@labre/global/lit';
import { ShadowlessElement } from '@labre/std';
import { css, html } from 'lit';
import { property } from 'lit/decorators.js';

/**
 * The two OPTIONAL fields of a C4 element, edited in one small panel.
 *
 * ## Why two plain inputs and not two toolbar entries
 *
 * Technology and description are the same kind of thing — free text the author
 * types once and rarely revisits — and they are read together: the type line
 * `[Container: Java]` and the sentence under it are one statement about one box.
 * A row of two buttons each opening its own editor would make the reader open
 * both to find out what the element says.
 *
 * The TITLE is deliberately absent: it is the native shape's inner text, edited
 * in place on a double-click like every other shape's, and a third box here
 * would be a second way to write the same value — the one that goes stale.
 *
 * ## Writing
 *
 * Committed on `change` (blur or Enter), never on every keystroke: an undo stack
 * with one entry per character is not an undo stack. `captureSync` opens the
 * checkpoint just before the write, exactly as the pool's own toggles do.
 *
 * An EMPTY box clears the field back to `undefined` through `clearField` rather
 * than writing `''`. The difference is the whole reason both fields are optional:
 * a cleared field leaves no key in the document, so an element whose technology
 * was typed and then removed is byte-identical to one that never had it — and
 * the exporter, which tests for a value, agrees with the canvas.
 */
export class C4NodeDetailsPanel extends WithDisposable(ShadowlessElement) {
  static override styles = css`
    c4-node-details-panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 240px;
      padding: 4px 2px;
    }

    c4-node-details-panel .c4-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    c4-node-details-panel label {
      font-size: 12px;
      font-weight: 500;
      color: var(--affine-text-secondary-color, #8e8d91);
    }

    c4-node-details-panel input,
    c4-node-details-panel textarea {
      font: inherit;
      font-size: 14px;
      color: var(--affine-text-primary-color, #1f2328);
      background: var(--affine-background-primary-color, #fff);
      border: 1px solid var(--affine-border-color, #e3e2e4);
      border-radius: 4px;
      padding: 4px 8px;
      outline: none;
      resize: vertical;
    }

    c4-node-details-panel input:focus,
    c4-node-details-panel textarea:focus {
      border-color: var(--affine-primary-color, #1e96eb);
    }
  `;

  /** The selected nodes. Every edit is applied to all of them. */
  @property({ attribute: false })
  accessor models: readonly C4NodeElementModel[] = [];

  /**
   * Writes one field on every selected node. Supplied by the toolbar config,
   * which is where `std` lives — this element stays a dumb pair of boxes.
   */
  @property({ attribute: false })
  accessor onCommit: (
    field: 'technology' | 'description',
    value: string
  ) => void = () => {};

  @property({ attribute: false })
  accessor technologyLabel: string = 'Technology';

  @property({ attribute: false })
  accessor descriptionLabel: string = 'Description';

  /**
   * What the boxes open on: the value the selection AGREES on, or nothing.
   *
   * Several nodes with different technologies have no common value to show, and
   * showing the first one would invite the author to hit Enter on a box that
   * silently retypes it onto all the others. An empty box in that case reads
   * correctly — nobody's value — and typing into it deliberately sets all of
   * them, which is what a multi-selection edit is for.
   */
  private _shared(field: 'technology' | 'description'): string {
    const values = new Set(this.models.map(model => model[field] ?? ''));
    return values.size === 1 ? [...values][0] : '';
  }

  private _commit(
    field: 'technology' | 'description',
    event: Event,
    previous: string
  ): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    const value = target.value.trim();
    if (value === previous) return;
    this.onCommit(field, value);
  }

  override render() {
    const technology = this._shared('technology');
    const description = this._shared('description');
    return html`
      <div class="c4-field">
        <label for="c4-technology">${this.technologyLabel}</label>
        <input
          id="c4-technology"
          type="text"
          .value=${technology}
          @keydown=${(event: KeyboardEvent) => event.stopPropagation()}
          @change=${(event: Event) =>
            this._commit('technology', event, technology)}
        />
      </div>
      <div class="c4-field">
        <label for="c4-description">${this.descriptionLabel}</label>
        <textarea
          id="c4-description"
          rows="3"
          .value=${description}
          @keydown=${(event: KeyboardEvent) => event.stopPropagation()}
          @change=${(event: Event) =>
            this._commit('description', event, description)}
        ></textarea>
      </div>
    `;
  }
}
