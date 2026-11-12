import { ColorScheme } from '@labre/affine-model';
import {
  getThemeObserver,
  ThemeProvider,
  type TranslationService,
} from '@labre/affine-shared/services';
import { WithDisposable } from '@labre/global/lit';
import type { BlockStdScope } from '@labre/std';
import { stdContext } from '@labre/std';
import emojiMartData from '@emoji-mart/data';
import { consume } from '@lit/context';
import { Picker } from 'emoji-mart';
import { css, html, LitElement } from 'lit';
import { property, query } from 'lit/decorators.js';

import { IconType } from './types.js';
import { iconPickerWording } from './wording.js';
import {
  EMOJI_GROUP_WORDINGS,
  EMOJI_PICKER_FREQUENT,
  EMOJI_PICKER_NO_RESULTS_TITLE,
  EMOJI_PICKER_PICK,
  EMOJI_PICKER_SEARCH_RESULTS,
  EMOJI_PICKER_SKIN_CHOOSE,
  EMOJI_PICKER_SKIN_WORDINGS,
  FILTERABLE_LIST_SEARCH_PLACEHOLDER,
  ICON_PICKER_NO_EMOJI_FOUND,
} from '../translations.js';

/**
 * emoji-mart's category ids in its own order, which `EMOJI_GROUP_WORDINGS`
 * declares them in, "Frequently used" first.
 */
const FREQUENT_CATEGORY = 'frequent';
const EMOJI_CATEGORIES = Object.keys(EMOJI_GROUP_WORDINGS);

/** The part of emoji-mart's selection payload the panel reads. */
interface EmojiMartSelection {
  native: string;
}

/**
 * The emoji half of the picker: emoji-mart's own picker, the one the callout
 * block always opened (search, category bar, "Frequently used", skin tones
 * and a preview line), emitting the same `select` event as the icon half.
 *
 * Nothing is fetched. emoji-mart downloads its dataset and every non-English
 * locale from a public CDN unless it is handed them, so the panel always
 * passes `data` (the `@emoji-mart/data` set already bundled) and `i18n`
 * (built from this package's `com.labre.*` wordings, so the host's catalogue
 * translates it like the rest of the picker); the `native` set draws system
 * emojis, never a spritesheet. `icon-picker-network.unit.spec.ts` holds it.
 *
 * emoji-mart remembers what it is given in `localStorage`: the picks under
 * `emoji-mart.frequently` / `emoji-mart.last` (none with
 * {@link rememberRecent} off, which also hides the "Frequently used" row) and
 * the chosen skin tone under `emoji-mart.skin`, whatever `rememberRecent`
 * says.
 */
export class AffineEmojiPickerPanel extends WithDisposable(LitElement) {
  static override styles = css`
    :host {
      display: block;
    }

    /*
     * Inside the tabbed frame of affine-icon-picker the frame draws the
     * border, the corners and the shadow, so emoji-mart fills it bare. On its
     * own (the callout) it keeps its own, as it always looked.
     */
    :host([framed]) {
      height: 100%;
      min-height: 0;
    }

    :host([framed]) .affine-emoji-picker-panel {
      display: flex;
      height: 100%;
    }

    :host([framed]) em-emoji-picker {
      width: 100%;
      height: 100%;
      min-height: 0;
      --border-radius: 0;
      --shadow: none;
    }
  `;

  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  /** Handed down by `affine-icon-picker`; see its `translation`. */
  @property({ attribute: false })
  accessor translation: TranslationService | undefined = undefined;

  /**
   * Whether emoji-mart keeps the picks in `localStorage` and shows them as
   * "Frequently used". Read once, when the panel opens.
   */
  @property({ attribute: false })
  accessor rememberRecent = true;

  /** Set by `affine-icon-picker` when it draws its tabbed frame around. */
  @property({ type: Boolean, reflect: true })
  accessor framed = false;

  @query('.affine-emoji-picker-panel')
  private accessor _container!: HTMLElement;

  private _wording(wording: readonly [string, string]): string {
    return iconPickerWording(this, wording);
  }

  /** emoji-mart's `i18n` object, every entry read through the seam. */
  private _i18n() {
    const categories: Record<string, string> = {
      frequent: this._wording(EMOJI_PICKER_FREQUENT),
      search: this._wording(EMOJI_PICKER_SEARCH_RESULTS),
    };
    for (const [id, wording] of Object.entries(EMOJI_GROUP_WORDINGS)) {
      categories[id] = this._wording(wording);
    }

    const skins: Record<string, string> = {
      choose: this._wording(EMOJI_PICKER_SKIN_CHOOSE),
    };
    EMOJI_PICKER_SKIN_WORDINGS.forEach((wording, index) => {
      skins[index + 1] = this._wording(wording);
    });

    return {
      search: this._wording(FILTERABLE_LIST_SEARCH_PLACEHOLDER),
      search_no_results_1: this._wording(EMOJI_PICKER_NO_RESULTS_TITLE),
      search_no_results_2: this._wording(ICON_PICKER_NO_EMOJI_FOUND),
      pick: this._wording(EMOJI_PICKER_PICK),
      categories,
      skins,
    };
  }

  /**
   * The editor's theme where there is one (the callout read it the same way),
   * else the page's `data-theme`, the attribute the library's own colours
   * follow outside an editor.
   */
  private _theme(): 'light' | 'dark' {
    const scheme =
      this.std?.getOptional(ThemeProvider)?.theme$.peek() ??
      getThemeObserver().theme$.peek();
    return scheme === ColorScheme.Dark ? 'dark' : 'light';
  }

  private readonly _select = ({ native }: EmojiMartSelection) => {
    this.dispatchEvent(
      new CustomEvent('select', {
        detail: { type: IconType.Emoji, unicode: native },
        bubbles: true,
        composed: true,
      })
    );
  };

  override firstUpdated() {
    const picker = new Picker({
      data: emojiMartData,
      i18n: this._i18n(),
      theme: this._theme(),
      autoFocus: true,
      // Always named, never left to emoji-mart's default. Its categories live
      // at module level, shared by every picker of the page, and its init
      // splices an empty `frequent` out of that shared list unless
      // `categories` is given, in which case it works on a filtered copy.
      // Without this, one `rememberRecent: false` opening (`maxFrequentRows:
      // 0` empties `frequent`) took the row away from every later picker,
      // the callout's included, until the page reloaded.
      categories: this.rememberRecent
        ? [FREQUENT_CATEGORY, ...EMOJI_CATEGORIES]
        : EMOJI_CATEGORIES,
      ...(this.rememberRecent ? {} : { maxFrequentRows: 0 }),
      onEmojiSelect: this._select,
    }) as unknown as HTMLElement;
    this._container.append(picker);
    // Built imperatively, outside Lit's template: nothing else takes it down,
    // and it holds a document click listener and a `prefers-color-scheme`
    // listener until it is unmounted.
    this.disposables.add(() => picker.remove());
  }

  override render() {
    return html`<div class="affine-emoji-picker-panel"></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-emoji-picker-panel': AffineEmojiPickerPanel;
  }
}
