import { WithDisposable } from '@labre/global/lit';
import data from '@emoji-mart/data';
import { Picker } from 'emoji-mart';
import { html, LitElement, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';

/** The part of emoji-mart's selection payload a callout reads. */
export type EmojiSelection = {
  native: string;
};

export class EmojiMenu extends WithDisposable(LitElement) {
  override firstUpdated(props: PropertyValues) {
    const result = super.firstUpdated(props);

    const picker = new Picker({
      data,
      onEmojiSelect: this.onEmojiSelect,
      autoFocus: true,
      theme: this.theme,
    }) as unknown as HTMLElement;
    this.emojiMenu.append(picker);
    // The picker is built imperatively, outside Lit's template, so nothing in
    // this component takes it down when the menu goes away. It holds a
    // document click listener and a `prefers-color-scheme` listener until it
    // is unmounted, so unmount it with the menu.
    this.disposables.add(() => picker.remove());

    return result;
  }

  @property({ attribute: false })
  accessor onEmojiSelect: (emoji: EmojiSelection) => void = () => {};

  @property({ attribute: false })
  accessor theme: 'light' | 'dark' = 'light';

  @query('.affine-emoji-menu')
  accessor emojiMenu!: HTMLElement;

  override render() {
    return html`<div class="affine-emoji-menu"></div>`;
  }
}
