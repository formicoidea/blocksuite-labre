import type { Container } from '@labre/global/di';
import { LifeCycleWatcher } from '@labre/std';
import {
  InvisibleCharactersDisplayIdentifier,
  SHOW_INVISIBLES_ATTR,
} from '@labre/std/inline';
import {
  computed,
  effect,
  type ReadonlySignal,
  signal,
} from '@preact/signals-core';

import { EditPropsStore } from './edit-props-store.js';
import { EditorSettingProvider } from './editor-setting-service.js';

/**
 * "Show special characters" as THIS viewer sees it (`text.invisibles.toggle`),
 * modelled on `CanvasGrid` minus the document level: a display preference
 * writes nothing to the document, so a reader may toggle it too.
 *
 * Nearest decision first: the viewer's own toggle (an `EditPropsStore`
 * `localStorage` prop, the same for every document, a writer's habit), the
 * host's default (`EditorSettingProvider`'s `showInvisibles`), off.
 *
 * Read by every `v-text` under the editor host through
 * `InvisibleCharactersDisplayIdentifier` (`@labre/std/inline`), which marks
 * spaces, tabs, no-break spaces and invisible characters; the line ends are
 * drawn from {@link SHOW_INVISIBLES_ATTR}, which this service keeps on the
 * host while `visible$` holds. The document title sits outside the host and
 * shows no marks.
 */
export class InvisibleCharacters extends LifeCycleWatcher {
  static override key = 'invisible-characters';

  static override setup(di: Container) {
    super.setup(di);
    di.addImpl(InvisibleCharactersDisplayIdentifier, provider =>
      provider.get(InvisibleCharacters)
    );
  }

  private readonly _local$ = signal<boolean | undefined>(undefined);

  /** Whether this viewer sees the special characters. */
  readonly visible$: ReadonlySignal<boolean> = computed(
    () =>
      this._local$.value ??
      this.std.getOptional(EditorSettingProvider)?.setting$.value
        .showInvisibles ??
      false
  );

  /** What `v-text` reads. */
  readonly showInvisibles$ = this.visible$;

  private _stopHostAttribute: (() => void) | null = null;

  /** Flip the display for this viewer. Answers the new state. */
  toggle(): boolean {
    const visible = !this.visible$.peek();
    this._local$.value = visible;
    this.std.getOptional(EditPropsStore)?.setStorage('showInvisibles', visible);
    return visible;
  }

  override mounted() {
    super.mounted();
    const stored = this.std
      .getOptional(EditPropsStore)
      ?.getStorage('showInvisibles');
    this._local$.value = stored ?? undefined;
    const host = this.std.host;
    this._stopHostAttribute = effect(() => {
      host.toggleAttribute(SHOW_INVISIBLES_ATTR, this.visible$.value);
    });
  }

  override unmounted() {
    super.unmounted();
    this._stopHostAttribute?.();
    this._stopHostAttribute = null;
  }
}
