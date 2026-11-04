import type { Store } from '@labre/store';

/** What a view of html has to do when the document's interaction changes. */
export interface HtmlInteractionView extends EventTarget {
  /** The reader's gesture reached this view: its scripts may run. */
  startScripts(): void;
  requestUpdate(): void;
}

/**
 * Interacting is one state per document, and never stored: "Interact" on one embed
 * view turns on all those of the document, and a press outside all of them turns
 * them off (ADR 0048). A press inside a frame never reaches this document, which is
 * what keeps it going.
 *
 * Only the views there at the gesture start: one that arrives later, from a
 * collaborator say, stays closed until the next gesture.
 */
export class HtmlInteraction {
  interacting = false;

  private readonly _views = new Set<HtmlInteractionView>();

  private readonly _endOnOutsidePress = (event: Event) => {
    if (!this.interacting) return;
    if (event.composedPath().some(target => this._isView(target))) return;
    this.toggle();
  };

  private _isView(target: EventTarget) {
    return this._views.has(target as HtmlInteractionView);
  }

  add(view: HtmlInteractionView) {
    if (!this._views.size) {
      document.addEventListener('pointerdown', this._endOnOutsidePress, {
        capture: true,
      });
    }
    this._views.add(view);
  }

  remove(view: HtmlInteractionView) {
    this._views.delete(view);
    if (this._views.size) return;
    this.interacting = false;
    document.removeEventListener('pointerdown', this._endOnOutsidePress, {
      capture: true,
    });
  }

  toggle() {
    this.interacting = !this.interacting;
    this._views.forEach(view => {
      if (this.interacting) view.startScripts();
      view.requestUpdate();
    });
  }
}

const interactions = new WeakMap<Store, HtmlInteraction>();

export function htmlInteractionOf(store: Store) {
  let interaction = interactions.get(store);
  if (!interaction) {
    interaction = new HtmlInteraction();
    interactions.set(store, interaction);
  }
  return interaction;
}
